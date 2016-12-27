const express = require('express')
const pug = require('pug')
const path = require('path')
const appManifest = require('./view/appmanifest')
const os = require('os')
const PaperUtils = require('./view/paperutils')
const sspdf = require('./lib/sspdf')

let pageIndex = pug.compileFile(path.join(__dirname, 'view/index.pug'))

module.exports = (db, mongoose) => {
  const {PastPaperDoc, PastPaperIndex, PastPaperFeedback} = require('./lib/dbModel.js')(db, mongoose)
  let rMain = express.Router()

  rMain.get('/', function (req, res) {
    res.send(pageIndex({}))
  })
  rMain.use('/resources', express.static(path.join(__dirname, 'dist')))
  rMain.use('/resources', express.static(path.join(__dirname, 'view/public')))
  rMain.get('/sw.js', function (req, res) {
    res.sendFile(path.join(__dirname, 'dist/sw.js'))
  })
  rMain.get('/manifest.json', function (req, res) {
    res.send(appManifest)
  })

  rMain.get('/status/', function (req, res, next) {
    Promise.all([PastPaperDoc.count({}), PastPaperIndex.count({}), Promise.resolve(os.loadavg())])
      .then(([docCount, indexCount, loadAvg]) => {
        res.send({docCount, indexCount, loadAvg: loadAvg.map(num => Math.round(num * 100) / 100)})
      }, err => next(err))
  })

  rMain.get('/search/:query', function (req, res, next) {
    let query = req.params.query.toString().trim()
    let match
    if (query.match(/^\d{4}$/)) {
      fetchPP(query, null, null, null, null)
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{2})$/))) {
      fetchPP(match[1], match[2])
    } else if ((match = query.match(/^(\d{4})[_ ](\d)$/))) {
      fetchPP(match[1], null, match[2], null, null)
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]+)$/))) {
      fetchPP(match[1], null, null, null, match[2])
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{2})[_ ]([a-z]+)$/))) {
      fetchPP(match[1], match[2], null, null, match[3])
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{2})[_ ]*(paper[_ ]*)?(\d)$/))) {
      fetchPP(match[1], match[2], match[4], null, null)
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{2})[_ ]*(paper[_ ]*)?(\d)(\d)$/))) {
      fetchPP(match[1], match[2], match[4], match[5], null)
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{2})[_ ]([a-z]+)[_ ](\d)(\d)$/))) {
      fetchPP(match[1], match[2], match[4], match[5], match[3])
    } else if ((match = query.match(/^(\d{4})[_ ]([a-z]\d{2})[_ ]([a-z]+)[_ ](\d)$/))) {
      fetchPP(match[1], match[2], match[4], null, match[3])
    } else {
      PastPaperIndex.search(query).then(results => {
        Promise.all(results.map(rst => new Promise((resolve, reject) => {
          PastPaperDoc.find({subject: rst.doc.subject, time: rst.doc.time, paper: rst.doc.paper, variant: rst.doc.variant}, {_id: true, type: true, fileType: true, numPages: true}, (err, res) => {
            if (err) {
              resolve({doc: rst.doc, index: rst.index, related: []})
            } else {
              resolve({doc: rst.doc, index: rst.index, related: res.filter(x => x.type !== rst.doc.type)})
            }
          })
        }))).then(rst => res.send({
          response: 'text',
          list: rst
        })).catch(e => next(e))
      }).catch(err => {
        next(err)
      })
    }

    function fetchPP (subject, time, paper, variant, type) {
      let finder = {}
      subject && (finder.subject = subject)
      time && (finder.time = time)
      paper && (finder.paper = parseInt(paper))
      variant && (finder.variant = parseInt(variant))
      type && (finder.type = type)
      PastPaperDoc.find(finder, {__v: false, doc: false}).limit(51).then(rst => {
        if (rst.length >= 50) {
          res.send({
            response: 'overflow'
          })
          return
        }
        res.send({
          response: 'pp',
          list: rst
        })
      }, err => {
        res.status(500)
        res.send({response: 'error', err: err})
      })
    }
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
      // TODO: In-browser viewing
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
          result.svg = result.svg.toString('utf-8')
          res.set('Cache-Control', 'max-age=31556926')
          doc.doc = null
          result.doc = doc
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

  return rMain
}
