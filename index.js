const express = require('express')
const path = require('path')
const os = require('os')
const PaperUtils = require('./view/paperutils')
const CIESubjects = require('./view/CIESubjects')
const sspdf = require('./lib/sspdf')
const fs = require('fs')
const SVGO = require('svgo')
const cheerio = require('cheerio')
require('./dist-server/serverrender')
const serverRender = global.serverRender
global.serverRender = null

const svgo = new SVGO()

let indexPath = path.join(__dirname, 'dist/index.html')
let indexHtml = fs.readFileSync(indexPath)
if (process.env.NODE_ENV !== 'production') {
  fs.watch(indexPath, list => {
    fs.readFile(indexPath, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        console.log(err)
        process.exit(1)
      } else {
        indexHtml = data
      }
    })
  })
}

module.exports = (db, mongoose) => {
  const {PastPaperDoc, PastPaperIndex, PastPaperFeedback} = require('./lib/dbModel.js')(db, mongoose)
  let rMain = express.Router()

  function statusInfo () {
    return Promise.all([PastPaperDoc.count({}), PastPaperIndex.count({}), Promise.resolve(os.loadavg())])
      .then(([docCount, indexCount, loadAvg]) => {
        return Promise.resolve({docCount, indexCount, loadAvg: loadAvg.map(num => Math.round(num * 100) / 100)})
      }, err => Promise.reject(err))
  }

  rMain.get('/', function (req, res) {
    res.type('html')
    let $ = cheerio.load(indexHtml)
    $('.react-root').html(serverRender({})) // We want this to be static so that service worker don't end up caching old data
    res.send($.html())
  })
  rMain.use('/resources', express.static(path.join(__dirname, 'dist')))
  // rMain.use('/resources', express.static(path.join(__dirname, 'view/public')))
  rMain.get('/sw.js', function (req, res) {
    res.set('cache-control', 'max-age=0')
    res.sendFile(path.join(__dirname, 'dist/sw.js'))
  })

  rMain.get('/status/', function (req, res, next) {
    statusInfo().then(rst => res.send(rst), err => next(err))
  })

  function doSearch (query) {
    function findRelated (doc) {
      return PastPaperDoc.find({subject: doc.subject, time: doc.time, paper: doc.paper, variant: doc.variant}, {_id: true, type: true, fileType: true, numPages: true})
        .then(rst => Promise.resolve(rst.filter(x => x.type !== doc.type)))
    }
    return new Promise((resolve, reject) => {
      let match
      if ((match = query.match(/^!!index!([0-9a-f]+)$/))) {
        let id = match[1]
        PastPaperIndex.findOne({_id: id}).then(rstIndex => {
          if (!rstIndex) {
            resolve({
              response: 'text',
              list: []
            })
          } else {
            PastPaperDoc.findOne({_id: rstIndex.doc}).then(rstDoc => {
              if (!rstDoc) {
                resolve({
                  response: 'text',
                  list: []
                })
              } else {
                findRelated(rstDoc).then(rstRelated => {
                  resolve({
                    response: 'text',
                    list: [{doc: rstDoc, index: rstIndex, related: rstRelated}]
                  })
                }, err => resolve(({ response: 'text', list: [{doc: rstDoc, index: rstIndex, related: []}] })))
              }
            }, err => reject({response: 'error', err: err.toString()}))
          }
        }, err => reject({response: 'error', err: err.toString()}))
      } else if (query.match(/^\d{4}$/)) {
        fetchPP(query, null, null, null, null)
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})$/))) {
        fetchPP(match[1], match[2])
      } else if ((match = query.match(/^(\d{4})[_ ](\d)$/))) {
        fetchPP(match[1], null, match[2], null, null)
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]+)$/))) {
        fetchPP(match[1], null, null, null, match[2])
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})[_ ]([a-z]+)$/))) {
        fetchPP(match[1], match[2], null, null, match[3])
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})[_ ]*(paper[_ ]*)?(\d)$/))) {
        fetchPP(match[1], match[2], match[4], null, null)
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})[_ ]*(paper[_ ]*)?(\d)[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], match[5], null)
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})[_ ]([a-z]+)[_ ](\d)[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], match[5], match[3])
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})[_ ](\d)(\d)[_ ]([a-z]+)$/))) {
        fetchPP(match[1], match[2], match[3], match[4], match[5])
      } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{1,2})[_ ]([a-z]+)[_ ](\d)$/))) {
        fetchPP(match[1], match[2], match[4], null, match[3])
      } else if ((match = query.toUpperCase().match(/^(\d{4})\/(\d{2})\/([A-Z]\/[A-Z]|SP)\/(\d{2})$/))) {
        let month = PaperUtils.odashMonthToMyMonth(match[3])
        let time = month + match[4]
        let [paper, variant] = match[2].split('')
        fetchPP(match[1], time, paper, variant, null)
      } else {
        PastPaperIndex.search(query).then(results => {
          Promise.all(results.map(rst => new Promise((resolve, reject) => {
            findRelated(rst.doc).then(related => {
              resolve({doc: rst.doc, index: rst.index, related: related})
            }, err => {
              resolve({doc: rst.doc, index: rst.index, related: []})
            })
          }))).then(rst => resolve({
            response: 'text',
            list: rst
          }), err => reject({response: 'error', err: err.toString()}))
        }).catch(err => {
          reject({response: 'error', err: err.toString()})
        })
      }

      function fetchPP (subject, time, paper, variant, type) {
        let finder = {}
        subject && (finder.subject = subject)
        let tMat = null
        if (time && (tMat = time.match(/^([a-z])(\d)$/))) {
          let mo = tMat[1]
          let yr = '0' + tMat[2]
          time = mo + yr
        }
        time && (finder.time = time.toLowerCase())
        if (parseInt(paper) === 0 && Number.isSafeInteger(parseInt(variant)) && parseInt(variant) !== 0) {
          paper = variant
          variant = '0'
        }
        paper && (finder.paper = parseInt(paper))
        variant && (finder.variant = parseInt(variant))
        type && (finder.type = type.toLowerCase())
        PastPaperDoc.find(finder, {__v: false, doc: false}).limit(51).then(rst => {
          if (rst.length >= 50) {
            resolve({
              response: 'overflow'
            })
            return
          }
          resolve({
            response: 'pp',
            list: rst
          })
        }, err => {
          reject({response: 'error', err: err.toString()})
        })
      }
    })
  }

  rMain.get('/search/:query', function (req, res, next) {
    let query = req.params.query.toString().trim()
    doSearch(query).then(rst => res.send(rst), err => {
      res.status(500)
      res.send(err)
    })
  })
  rMain.get('/disclaim/', function (req, res, next) {
    res.type('html')
    let $ = cheerio.load(indexHtml)
    $('.react-root').html(serverRender({view: 'disclaim'}))
    res.send($.html())
  })
  rMain.get('/formsearch/', function (req, res, next) {
    let query = req.query.query.toString().trim()
    if (query.length === 0) {
      res.redirect('/')
      return
    }
    doSearch(query).then(rst => {
      res.type('html')
      let $ = cheerio.load(indexHtml)
      $('.react-root').html(serverRender({query: {query, result: JSON.parse(JSON.stringify(rst))}}))
      res.send($.html())
    }, err => {
      next(err.err || err)
    }).catch(err => next(err))
  })

  rMain.get('/fetchDoc/:id', function (req, res, next) {
    PastPaperDoc.findOne({_id: req.params.id}).then(doc => {
      if (!doc) {
        next()
        return
      }
      let fname = `${PaperUtils.setToString(doc)}_${doc.type}.${doc.fileType}`
      res.set('Content-Disposition', `inline; filename=${JSON.stringify(fname)}`)
      res.type(doc.fileType)
      res.send(doc.doc)
    }).catch(err => next(err))
  })
  rMain.get('/sspdf/:docid/:page', function (req, res, next) {
    let pn = parseInt(req.params.page)
    if (!Number.isSafeInteger(pn) || pn < 0) {
      next()
      return
    }
    PastPaperDoc.findOne({_id: req.params.docid}, {_v: false}).then(doc => {
      if (!doc) {
        next()
        return
      }
      let buff = doc.doc
      sspdf.getPage(buff, pn, function (err, result) {
        if (err) {
          next(err)
        } else {
          result.rects = result.rects.map(rect => {
            function round (n) {
              return Math.round(n * 100) / 100
            }
            rect.x1 = round(rect.x1)
            rect.x2 = round(rect.x2)
            rect.y1 = round(rect.y1)
            rect.y2 = round(rect.y2)
            return rect
          })
          res.set('Cache-Control', 'max-age=31556926')
          result.svg = result.svg.toString('utf-8')
          doc.doc = null
          result.doc = doc
          // svgo.optimize(result.svg, rSvgo => {
          //   result.svg = rSvgo.data
          //   res.send(result)
          // })
          res.send(result)
        }
      })
    }).catch(err => next(err))
  })

  rMain.post('/feedback/', function (req, res, next) {
    let ctype = req.get('Content-Type')
    let done = false
    if (ctype !== 'application/json') {
      res.status(415)
      res.send('Content type incorrect.')
      done = true
      return
    }
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      if (done) return
      body += chunk
    })
    req.on('end', () => {
      if (done) return
      done = true
      body = body.trim()
      if (body.length === 0) {
        res.status(403)
        res.send('Content is empty.')
        return
      }
      let parsed = null
      try {
        parsed = JSON.parse(body)
        if (typeof parsed !== 'object') {
          throw new Error()
        }
      } catch (e) {
        res.status(403)
        res.send('Content is not valid JSON.')
        return
      }
      let fb = new PastPaperFeedback({
        time: Date.now(),
        ip: req.ip,
        email: parsed.email,
        text: parsed.text,
        search: parsed.search
      })
      fb.save().then(() => {
        res.status(200)
        res.end()
      }, err => {
        res.status(403)
        res.send(err.toString())
      })
    })
  })
  rMain.get('/robots.txt', function (req, res) {
    if (req.hostname.match(/^beta\./)) {
      res.sendFile(path.join(__dirname, 'view/betaRobots.txt'))
    } else {
      res.type('txt')
      res.send('')
    }
  })

  return rMain
}
