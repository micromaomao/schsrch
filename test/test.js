const supertest = require('supertest')
const should = require('should')
const _schsrch = require('../index')
const express = require('express')
let schsrch = null
let dbModel = null
const mongoose = require('mongoose')
const elasticsearch = require('elasticsearch')
mongoose.Promise = global.Promise

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection: ' + reason)
  console.error(reason.stack)
  process.exit(1)
})

const { MONGODB: DB, ES } = process.env

try {
  DB.should.be.a.String().and.should.not.be.empty()
  ES.should.be.a.String().and.should.not.be.empty()
} catch (e) {
  console.log('You need to provide env MONGODB. E.g. MONGODB=127.0.0.1')
  process.exit(1)
}

let db = mongoose.createConnection(DB)
let es = new elasticsearch.Client({
  host: ES
})
db.on('error', function (err) {
  console.error(err)
  process.exit(1)
})
db.on('open', function () {
  schsrch = express()
  schsrch.use(function (req, res, next) {
    console.log(`    ${req.method.toUpperCase()} ${req.path}`)
    next()
  })
  schsrch.use(_schsrch({mongodb: db, elasticsearch: es}))
  schsrch.use(function (err, req, res, next) {
    console.error(err)
    next()
  })
  require('../lib/dbModel.js')(db, es).then(_dbModel => {
    dbModel = _dbModel
    const {PastPaperRequestRecord, PastPaperDoc} = dbModel
    PastPaperRequestRecord.count().then(ct => {
      if (ct !== 0) {
        console.error('Unclean database. Run test/perpareDatabase.sh before testing.')
        process.exit(1)
        return
      }
      PastPaperDoc.count().then(ct => {
        if (ct === 0) {
          console.error('No testing paper present. Run test/perpareDatabase.sh before testing.')
          process.exit(1)
          return
        }
        doTests()
      })
    }, err => {
      console.error(err)
      process.exit(1)
    })
  })
})

function doTests () {
  require('./server-basic.js')(schsrch)
  require('./direct-search.js')(schsrch)
  require('./text-search.js')(schsrch, dbModel)
  require('./getdoc.js')(schsrch, dbModel)
  require('./docdir.js')(schsrch, dbModel)
  require('./feedback.js')(schsrch, dbModel)
  require('./ciesubjects.js')()
  require('./paperutils.js')()
  require('./index-content.js')()
  run()
}
