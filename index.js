const express = require.main.require('express')
const path = require('path')
const os = require('os')
const PaperUtils = require('./view/paperutils')
const sspdf = require('./lib/sspdf')
const fs = require('fs')
const cheerio = require('cheerio')
require('./dist-server/serverrender')
const serverRender = global.serverRender
global.serverRender = null
const mongoose = require.main.require('mongoose')

let indexPath = path.join(__dirname, 'dist/index.html')
let indexHtml = fs.readFileSync(indexPath)
if (process.env.NODE_ENV !== 'production') {
  fs.watch(indexPath, list => {
    fs.readFile(indexPath, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        console.error(err)
        process.exit(1)
      } else {
        indexHtml = data
      }
    })
  })
}

module.exports = ({mongodb: db}) => {
  const {PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord} = require('./lib/dbModel.js')(db)
  let rMain = express.Router()

  function statusInfo () {
    return Promise.all([PastPaperDoc.count({}), PastPaperIndex.count({}), Promise.resolve(os.loadavg())])
      .then(([docCount, indexCount, loadAvg]) => {
        return Promise.resolve({docCount, indexCount, loadAvg: loadAvg.map(num => Math.round(num * 100) / 100)})
      }, err => Promise.reject(err))
  }

  rMain.use(function (req, res, next) {
    if (req.hostname.match(/^www\./)) {
      res.redirect('https://schsrch.xyz' + req.path)
    } else {
      next()
    }
  })
  function saveRecord (rec) {
    return rec.save().then(() => {}, err => console.log('Error saving record: ' + err))
  }
  rMain.get('/', function (req, res) {
    res.type('html')
    let $ = cheerio.load(indexHtml)
    $('.react-root').html(serverRender({})) // We want this to be static so that service worker don't end up caching old data
    res.send($.html())
    let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/'})
    saveRecord(rec)
  })
  rMain.use('/resources', express.static(path.join(__dirname, 'dist')))
  // rMain.use('/resources', express.static(path.join(__dirname, 'view/public')))
  rMain.get('/sw.js', function (req, res) {
    res.set('cache-control', 'max-age=0')
    res.sendFile(path.join(__dirname, 'dist/sw.js'))
  })
  rMain.get('/opensearch.xml', function (req, res) {
    res.set('cache-control', 'max-age=0')
    res.set()
    res.sendFile(path.join(__dirname, 'view/opensearch.xml'), {
      headers: {
        'content-type': 'application/opensearchdescription+xml'
      }
    })
  })

  rMain.get('/status/', function (req, res, next) {
    statusInfo().then(rst => res.send(rst), err => next(err))
  })

  let doSearch = require('./lib/doSearch.js')(db, mongoose)

  rMain.get('/search/:query', function (req, res, next) {
    let query = req.params.query.toString().trim()
    doSearch(query).then(rst => res.send(rst), err => {
      res.status(500)
      next(err)
    })
    let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/search/', search: query})
    saveRecord(rec)
  })
  rMain.get('/disclaim/', function (req, res, next) {
    res.type('html')
    let $ = cheerio.load(indexHtml)
    $('.react-root').html(serverRender({view: 'disclaim'}))
    res.send($.html())
  })
  rMain.get('/formsearch/', function (req, res, next) {
    let query = (req.query.query || '').toString().trim()
    if (query.length === 0) {
      res.redirect('/')
      return
    }
    doSearch(query).then(rst => {
      res.type('html')
      let $ = cheerio.load(indexHtml)
      let querying = {query, error: null, result: JSON.parse(JSON.stringify(rst))}
      $('.react-root').html(serverRender({querying})).attr('data-querying', JSON.stringify(querying))
      res.send($.html())
    }, err => {
      next(err.err || err)
    }).catch(err => next(err))
  })

  rMain.get('/fetchDoc/:id', function (req, res, next) {
    PastPaperDoc.findOne({_id: req.params.id}).then(doc => {
      let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/fetchDoc/', targetId: req.params.id})
      saveRecord(rec)
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
    PastPaperDoc.findOne({_id: req.params.docid}).then(doc => {
      if (!doc || doc.numPages <= pn) {
        next()
        return
      }
      processSSPDF(doc, pn).then(sspdf => {
        res.set('Cache-Control', 'max-age=' + (10 * 24 * 60 * 60).toString())
        res.send(sspdf)
        let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/sspdf/', targetId: doc._id, targetPage: pn})
        saveRecord(rec)
      }, err => {
        next(err)
      })
    }).catch(err => next(err))
  })

  function processSSPDF (doc, pn) {
    return new Promise((resolve, reject) => {
      function postCache (stuff) {
        let result = stuff
        delete result.text // Not used for now.
        delete result.rects // Not used for now.
        result.doc = doc
        result.doc.doc = null
        return result
      }

      PastPaperIndex.find({doc: doc._id, page: pn}).then(ppIdxes => {
        if (!ppIdxes || ppIdxes.length < 1) {
          reject(null)
          return
        }
        let ppIdx = ppIdxes[0]
        // FIXME: Race condition result in duplicate works
        if (ppIdx.sspdfCache) {
          resolve(postCache(ppIdx.sspdfCache))
        } else {
          console.log(`Building sspdf for ${doc._id}::${pn} (idx//${ppIdx._id})`)
          let buff = doc.doc
          sspdf.getPage(buff, pn, function (err, result) {
            if (err) {
              reject(err)
            } else {
              sspdf.preCache(result, nResult => {
                ppIdx.sspdfCache = nResult
                result = null
                ppIdx.save(err => {
                  if (err) {
                    console.error('Unable to save sspdfCache: ' + err)
                  }
                  resolve(postCache(nResult))
                })
              })
            }
          })
        }
      }).catch(reject)
    })
  }

  rMain.get('/docdir/:docid', function (req, res, next) {
    let docid = req.params.docid.toString()
    PastPaperDoc.findOne({_id: docid}).then(doc => {
      if (!doc) {
        next()
        return
      }
      doc.ensureDir().then(dir => {
        res.send(dir)
        let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/docdir/', targetId: docid})
        saveRecord(rec)
      }, err => next(err))
    }, err => next(err))
  })
  rMain.get('/msdir/:docid', function (req, res, next) {
    let docid = req.params.docid.toString()
    PastPaperDoc.findOne({_id: docid}).then(doc => {
      if (!doc) {
        next()
        return
      }
      PastPaperDoc.findOne({subject: doc.subject, time: doc.time, paper: doc.paper, variant: doc.variant, type: doc.type === 'ms' ? 'qp' : 'ms'}).then(msdoc => {
        if (!msdoc) {
          res.send({dir: {}, docid: null})
        } else {
          msdoc.ensureDir().then(dir => {
            res.send({dir, docid: msdoc._id.toString()})
            let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/msdir/', targetId: docid})
            saveRecord(rec)
          }, err => next(err))
        }
      }, err => next(err))
    }, err => next(err))
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
        if (parsed.email === null) {
          parsed.email = ''
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
  rMain.get('/redbook', function (req, res) {
    res.redirect('https://static.maowtm.org/redbook.pdf')
  })

  return rMain
}
