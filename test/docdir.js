const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

const expectedDirs1 = require('./data/expecteddirs-0470.json')
const expectedDirs2 = require('./data/expecteddirs-9699.json')
const expectedDirs3 = require('./data/expecteddirs-0450.json')

module.exports = (schsrch, dbModel) =>
  describe('Getting the dir of the document', function () {
    const {PastPaperDoc} = dbModel
    let paper1
    let ms1
    let MCQms1
    let MCQms2
    let paper2
    let ms2
    let paper3
    let ms4
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'qp'}).then(doc => {
        doc.should.be.an.Object()
        paper1 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms', paper: 3}).then(doc => {
        doc.should.be.an.Object()
        ms1 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms', paper: 1, variant: 1}).then(doc => {
        doc.should.be.an.Object()
        MCQms1 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0470', type: 'ms', paper: 1, variant: 2}).then(doc => {
        doc.should.be.an.Object()
        MCQms2 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '9699', type: 'qp', time: 's17', paper: 1, variant: 3}).then(doc => {
        doc.should.be.an.Object()
        paper2 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '9699', type: 'ms', time: 's17', paper: 1, variant: 3}).then(doc => {
        doc.should.be.an.Object()
        ms2 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '0450', type: 'qp', time: 'w15', paper: 1, variant: 2}).then(doc => {
        doc.should.be.an.Object()
        paper3 = doc
        done()
      }).catch(err => done(err))
    })
    before(function (done) {
      PastPaperDoc.findOne({subject: '9701', type: 'ms', time: 's17', paper: 4, variant: 2}).then(doc => {
        doc.should.be.an.Object()
        ms4 = doc
        done()
      }).catch(err => done(err))
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
              dirs[i].qNRect.x1.should.be.below(90)
              dirs[i].qNRect.x2.should.be.below(110)
              lastY = dirs[i].qNRect.y2
            }
          }
        })
    }
    it('/doc/?as=dir', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper1._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs1))
        .end(done)
    })
    it('/doc/?as=dir&page=1', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper1._id + '/?as=dir&page=1')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs1.filter(x => x.p === 1)))
        .end(done)
    })
    it('/doc/?as=dir&page=2', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper1._id + '/?as=dir&page=2')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs1.filter(x => x.p === 2)))
        .end(done)
    })
    it('/doc/?as=dir for ms', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + ms1._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.length.should.equal(expectedDirs1.length))
        .end(done)
    })
    it('/doc/?as=dir (2017 layout)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper2._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs2))
        .end(done)
    })
    it('/doc/?as=dir for ms (2017 layout)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + ms2._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.length.should.equal(expectedDirs2.length))
        .end(done)
    })
    it('/doc/?as=dir (0450 w15 12)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper3._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs3))
        .end(done)
    })
    it('/doc/?as=dir for ms (9701_s17_4_2_ms)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + ms4._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.length.should.equal(8))
        .end(done)
    })
    it('should cache dir result', function (done) {
      PastPaperDoc.findOne({_id: paper1}, {fileBlob: false}).then(doc => {
        if (!doc) return Promise.reject(new Error('No doc found in database.'))
        try {
          doc.dir.should.be.an.Object()
          doc.dir.dirs.map(di => ({p: di.page, t: di.qT})).should.deepEqual(expectedDirs1)
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
