const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

const expectedDirs = require('./data/expecteddirs-0470.json')

module.exports = (schsrch, dbModel) =>
  describe('Getting the dir of the document', function () {
    const {PastPaperDoc} = dbModel
    let thePaper
    let theMarkScheme
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'qp'}).then(doc => {
        doc.should.be.an.Object()
        thePaper = doc
        done()
      }, err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms'}).then(doc => {
        doc.should.be.an.Object()
        theMarkScheme = doc
        done()
      }, err => done(err))
    })
    function expectBasicDir (st) {
      return st
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => {
          let dirs = res.body.dirs
          dirs.should.be.an.Array()
          let lastY = 0
          let lastPage = 0
          for (let i = 0; i < dirs.length; i ++) {
            dirs[i].qNRect.should.be.an.Object()
            if (lastPage === dirs[i].page) {
              dirs[i].qNRect.y1.should.be.above(lastY)
              dirs[i].qNRect.y2.should.be.above(lastY)
            } else {
              lastPage = dirs[i].page
            }
            dirs[i].qNRect.x1.should.be.below(70)
            dirs[i].qNRect.x2.should.be.below(70)
            lastY = dirs[i].qNRect.y2
          }
        })
    }
    it('/doc/?as=dir', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + thePaper._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs))
        .end(done)
    })
    it('/doc/?as=dir&page=1', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + thePaper._id + '/?as=dir&page=1')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs.filter(x => x.p === 1)))
        .end(done)
    })
    it('/doc/?as=dir&page=2', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + thePaper._id + '/?as=dir&page=2')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs.filter(x => x.p === 2)))
        .end(done)
    })
    it('/doc/?as=dir for ms', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + theMarkScheme._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.length.should.equal(expectedDirs.length))
        .end(done)
    })
  })
