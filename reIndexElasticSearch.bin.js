#!/usr/bin/env node
const { MONGODB: DB, ES, QUICK, DEBUG } = process.env
let noCacheSSPDF = QUICK === '1'
let debug = DEBUG === '1'

const mongoose = require('mongoose')
mongoose.Promise = global.Promise
let db = mongoose.createConnection(DB)

const elasticsearch = require('elasticsearch')

db.on('error', err => {
  console.error(err)
  process.exit(1)
})
let es = new elasticsearch.Client({
  host: ES
})
db.on('open', () => {
  es.indices.delete({
    index: 'pastpaper'
  }).then(() => Promise.resolve(), err => {
    if (err.body && err.body.error && err.body.error.type === 'index_already_exists_exception') return Promise.resolve()
    else return Promise.reject(err)
  }).then(() => {
    process.stderr.write('Index deleted.\n')
    require('./lib/dbModel.js')(db, es).then(({PastPaperIndex, PastPaperDoc}) => {
      let i = 0
      PastPaperIndex.count().then(t => {
        if (t === 0) {
          process.exit(0)
        }
        PastPaperIndex.find({}).cursor().eachAsync(idx => idx.indexToElastic().then(() => {
          process.stderr.write(`\r ${++i} documents indexed, ${t} total. ${Math.round(i / t * 1000) / 10}%...`)
          if (i >= t) {
            process.stderr.write(`\r ${i} documents indexed.\n`)
            process.exit(0)
          }
        }, err => {
          process.stderr.write(`\nError for ${idx._id.toString()}: ${err}\n`)
          i++
        }))
      }, err => {
        console.error(err)
        console.error('Unable to count index.')
        process.exit(1)
      })
    }, err => {
      console.error(err)
      process.exit(1)
    })
  }, err => {
    console.error(err)
    console.error('Unable to delete index.')
    process.exit(1)
  })
})
