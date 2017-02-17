const supertest = require('supertest')
const should = require('should')
const _schsrch = require('../index')
const express = require('express')
let schsrch = null
let dbModel = null
const mongoose = require('mongoose')
mongoose.Promise = global.Promise

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection: ' + reason)
  console.error(reason.stack)
  process.exit(1)
})

const DB = process.env.MONGODB

try {
  DB.should.be.a.String().and.should.not.be.empty()
} catch (e) {
  console.log('You need to provide env MONGODB. E.g. MONGODB=127.0.0.1')
  process.exit(1)
}

let db = mongoose.createConnection(DB)
db.on('error', function (err) {
  console.error(err)
  process.exit(1)
})
db.on('open', function () {
  schsrch = express()
  schsrch.use(_schsrch(db, mongoose))
  dbModel = require('../lib/dbModel.js')(db, mongoose)
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

function doTests () {
  require('./server-basic.js')(schsrch)
  require('./direct-search.js')(schsrch)
  require('./text-search.js')(schsrch, dbModel)
  require('./getdoc.js')(schsrch, dbModel)
  require('./feedback.js')(schsrch, dbModel)
  require('./ciesubjects.js')()
  require('./paperutils.js')()
  run()
}
