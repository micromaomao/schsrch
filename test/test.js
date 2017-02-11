const supertest = require('supertest')
const should = require('should')
const _schsrch = require('../index')
const express = require('express')
let schsrch = null
const mongoose = require('mongoose')
const PaperUtils = require('../view/paperutils.js')
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
  const {PastPaperRequestRecord, PastPaperDoc} = require('../lib/dbModel.js')(db, mongoose)
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
  describe('Basic pages', function () {
    it('200 for schsrch.xyz/', function (done) {
      supertest(schsrch)
        .get('/')
        .set('Host', 'schsrch.xyz')
        .expect('Content-Type', /html/)
        .expect(200)
        .end(done)
    })
    it('200 for beta.schsrch.xyz/', function (done) {
      supertest(schsrch)
        .get('/')
        .set('Host', 'beta.schsrch.xyz')
        .expect('Content-Type', /html/)
        .expect(200)
        .end(done)
    })
    it('beta.schsrch.xyz/robots.txt', function (done) {
      supertest(schsrch)
        .get('/robots.txt')
        .set('Host', 'beta.schsrch.xyz')
        .expect('Content-Type', /text\/plain/)
        .expect(200)
        .expect(res => res.text.should.match(/Disallow: \//))
        .end(done)
    })
  })
  describe('Search for specific paper', function () {
    function pplTest (query, expect) {
      it(query, function (done) {
        expect = expect.sort().map(x => `0610_${x}`)
        supertest(schsrch)
          .get('/search/' + encodeURIComponent(query))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('pp', 'Response should be "pp" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(expect.length, `Response should have ${expect.length} results returned.`))
          .expect(res => res.body.list = res.body.list.map(x => `${PaperUtils.setToString(x)}_${x.type}`))
          .expect(res => res.body.list = res.body.list.sort())
          .expect(res => res.body.list.forEach((x, idx) => x.should.equal(expect[idx])))
          .end(done)
      })
    }
    pplTest('0609', [])
    pplTest('0609 s16', [])
    pplTest('0609s16', [])
    ;['0610 ', '0610'].forEach(s => {
      pplTest(s, ['s16_1_0_ms', 's16_1_0_qp', 's16_2_0_ms', 's16_2_0_qp', 's17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp', 'w16_1_1_qp', 'w16_1_1_ms'])

      pplTest(s + 's16', ['s16_1_0_ms', 's16_1_0_qp', 's16_2_0_ms', 's16_2_0_qp'])
      pplTest(s + 's17', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's18', [])
      pplTest(s + 'w16', ['w16_1_1_qp', 'w16_1_1_ms'])
      pplTest(s + 'w17', [])
      pplTest(s + 'y17', [])

      pplTest(s + 'y17 11', [])
      pplTest(s + 's16 13', [])
      pplTest(s + 's16 3', [])
      pplTest(s + 'w16 3', [])
      pplTest(s + 's16 1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's161', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's1610', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's17 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's1711', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's171', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])

      pplTest(s + 'y17 paper 11', [])
      pplTest(s + 's16 paper 13', [])
      pplTest(s + 's16 paper 3', [])
      pplTest(s + 'w16 paper 3', [])
      pplTest(s + 's16 paper 1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 'y17 paper11', [])
      pplTest(s + 's16 paper13', [])
      pplTest(s + 's16 paper3', [])
      pplTest(s + 'w16 paper3', [])
      pplTest(s + 's16 paper1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 'y17paper 11', [])
      pplTest(s + 's16paper 13', [])
      pplTest(s + 's16paper 3', [])
      pplTest(s + 'w16paper 3', [])
      pplTest(s + 's16paper 1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 'y17paper11', [])
      pplTest(s + 's16paper13', [])
      pplTest(s + 's16paper3', [])
      pplTest(s + 'w16paper3', [])
      pplTest(s + 's16paper1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16p1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 p1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 paper 10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 paper10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16paper 10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16paper10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16p10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 p10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's17 paper 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 paper11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17paper 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17paper11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17p11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 p11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17 paper 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17 paper1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17paper 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17paper1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17p1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17 p1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])

      pplTest(s + 's16 1 ms', ['s16_1_0_ms'])
      pplTest(s + 's161qp', ['s16_1_0_qp'])
      pplTest(s + 's16 10 ms', ['s16_1_0_ms'])
      pplTest(s + 's1610qp', ['s16_1_0_qp'])
      pplTest(s + 's17 11 ms', ['s17_1_1_ms'])
      pplTest(s + 's1711qp', ['s17_1_1_qp'])
      pplTest(s + 's17 1 ms', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's171qp', ['s17_1_1_qp', 's17_1_2_qp'])

      pplTest(s + 's16 paper 1 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 paper1 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 p1qp', ['s16_1_0_qp'])
      pplTest(s + 's16 paper 10 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 paper10 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 p10qp', ['s16_1_0_qp'])
      pplTest(s + 's17 paper 11 ms', ['s17_1_1_ms'])
      pplTest(s + 's17 paper11 ms', ['s17_1_1_ms'])
      pplTest(s + 's17 p11qp', ['s17_1_1_qp'])
      pplTest(s + 's17 paper 1 ms', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's17 paper1 ms', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's17 p1qp', ['s17_1_1_qp', 's17_1_2_qp'])

      pplTest(s + 's16 ms 1', ['s16_1_0_ms'])
      pplTest(s + 's16qp1', ['s16_1_0_qp'])
      pplTest(s + 's16 ms 10', ['s16_1_0_ms'])
      pplTest(s + 's16qp10', ['s16_1_0_qp'])
      pplTest(s + 's17 ms 11', ['s17_1_1_ms'])
      pplTest(s + 's17qp11', ['s17_1_1_qp'])
      pplTest(s + 's17 ms 1', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's17qp1', ['s17_1_1_qp', 's17_1_2_qp'])

    })

    pplTest('0610/11/M/J/17', ['s17_1_1_ms', 's17_1_1_qp'])
    pplTest('0610/01/M/J/16', ['s16_1_0_ms', 's16_1_0_qp'])
    pplTest('0610/10/M/J/16', ['s16_1_0_ms', 's16_1_0_qp'])
    pplTest('0610/11/M/J/16', [])
    pplTest('0610/11/O/N/16', ['w16_1_1_qp', 'w16_1_1_ms'])
    pplTest('0610/10/O/N/16', [])
    pplTest('0610/01/O/N/16', [])
  })
  run()
}
