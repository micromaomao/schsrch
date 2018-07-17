#!/usr/bin/env node
const express = require('express')
const mongoose = require('mongoose')
const elasticsearch = require('elasticsearch')
const http = require('http')

let { MONGODB: DB, ES, SITE_ORIGIN: siteOrigin, BIND_ADDR } = process.env

try {
  if (!DB || !ES) throw new Error()
  if (!siteOrigin) {
    siteOrigin = 'https://paper.sc'
  }
  if (!BIND_ADDR) {
    BIND_ADDR = '0.0.0.0'
  }
} catch (e) {
  console.log('You need to provide env MONGODB and ES. E.g. MONGODB=mongodb://127.0.0.1/ ES=127.0.0.1')
  process.exit(1)
}

let db = mongoose.createConnection()
db.openUri(DB).catch(err => {
  console.error(err)
  process.exit(1)
})
db.on('error', function (err) {
  console.error(err)
  process.exit(1)
})
let es = new elasticsearch.Client({
  host: ES
})
es.ping({
  requestTimeout: 1000
}, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
db.on('open', function () {
  let SchSrch = require('./index')({mongodb: db, elasticsearch: es, siteOrigin})
  let app = express()
  app.use(SchSrch)
  app.use(function (err, req, res, next) {
    console.error(err)
    res.status(500)
    res.send('The server encountered an unexpected error - ' + err.message)
  })
  http.createServer(app).listen(80, BIND_ADDR)
  setTimeout(() => {
    process.setgid('www')
    process.setuid('www')
    console.log('set uid and gid to www.')
  }, 100)
})
