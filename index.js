const express = require('express')
const pug = require('pug')
const path = require('path')
const appManifest = require('./view/appmanifest')
const os = require('os')

let pageIndex = pug.compileFile(path.join(__dirname, 'view/index.pug'))

module.exports = db => {
  const {PastPaperDoc, PastPaperIndex} = require('./lib/dbModel.js')(db)
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
    let query = req.params.query.toString()
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
      // TODO
      res.send({
        response: 'text, unimplemented'
      })
    }

    function fetchPP (subject, time, paper, variant, type) {
      let finder = {}
      subject && (finder.subject = subject)
      time && (finder.time = time)
      paper && (finder.paper = parseInt(paper))
      variant && (finder.variant = parseInt(variant))
      type && (finder.type = type)
      PastPaperDoc.find(finder, {doc: false, __v: false}).limit(51).then(rst => {
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
  return rMain
}
