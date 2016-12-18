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

  return rMain
}
