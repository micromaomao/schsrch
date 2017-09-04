const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

const expectedDirs = require('./data/expecteddirs-0470.json')

module.exports = (schsrch, dbModel) =>
  describe('Getting the dir of the document', function () {
    const {PastPaperDoc} = dbModel
    let thePaper
    let theMarkScheme
    let MCQms1
    let MCQms2
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'qp'}).then(doc => {
        doc.should.be.an.Object()
        thePaper = doc
        done()
      }, err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms', paper: 3}).then(doc => {
        doc.should.be.an.Object()
        theMarkScheme = doc
        done()
      }, err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms', paper: 1, variant: 1}).then(doc => {
        doc.should.be.an.Object()
        MCQms1 = doc
        done()
      })
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms', paper: 1, variant: 2}).then(doc => {
        doc.should.be.an.Object()
        MCQms2 = doc
        done()
      })
    })
    function expectBasicDir (st, mcq = false) {
      return st
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => {
          let dirs = res.body.dirs
          dirs.should.be.an.Array()
          if (!mcq) {
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
          }
        })
    }
    it('/doc/?as=dir', function (done) {
      this.timeout(5000)
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
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + theMarkScheme._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.length.should.equal(expectedDirs.length))
        .end(done)
    })
    it('should cache dir result', function (done) {
      PastPaperDoc.findOne({_id: thePaper}, {fileBlob: false}).then(doc => {
        if (!doc) return Promise.reject(new Error('No doc found in database.'))
        try {
          doc.dir.should.be.an.Object()
          doc.dir.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs)
        } catch (e) {
          return Promise.reject(e)
        }
      }).then(() => done(), err => done(err))
    })
    it('should work for MCQ Mark Scheme (type 1)', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + MCQms1._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'), true)
        .expect(res => res.body.mcqMs.should.be.true())
        .expect(res => res.body.dirs.map(x => x.qT).join('').should.equal('DCBCB BCACD BDADD BDCDC BCCDA ABCDB BBACB CDBBC'.replace(/ /g, '')))
        .end(done)
    })
    it('should work for MCQ Mark Scheme (type 2)', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + MCQms2._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'), true)
        .expect(res => should.ok(res.body.mcqMs))
        .expect(res => res.body.dirs.map(x => x.qT).join('').should.equal('DDADC BBCDA ADCAA CCDAD ABBBC BCCAA BACAC BCABC'.replace(/ /g, '')))
        .end(done)
    })
  })
