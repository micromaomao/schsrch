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
    let paper4
    let ms4
    let ms5
    let er1
    let paper6
    let er2
    let er3
    function getDocBeforeHook (query, cb) {
      before(function (done) {
        PastPaperDoc.find(query).then(docs => {
          docs.should.be.an.Array()
          docs.length.should.equal(1, `Should find one ${JSON.stringify(query)}`)
          let doc = docs[0]
          doc.should.be.an.Object()
          cb(doc)
          done()
        }).catch(err => done(err))
      })
    }
    getDocBeforeHook({subject: '0470', time: 's16', type: 'qp', paper: 3}, d => paper1 = d)
    getDocBeforeHook({subject: '0470', time: 's16', type: 'ms', paper: 3}, d => ms1 = d)
    getDocBeforeHook({subject: '0470', type: 'ms', paper: 1, variant: 1}, d => MCQms1 = d)
    getDocBeforeHook({subject: '0470', type: 'ms', paper: 1, variant: 2}, d => MCQms2 = d)
    getDocBeforeHook({subject: '9699', type: 'qp', time: 's17', paper: 1, variant: 3}, d => paper2 = d)
    getDocBeforeHook({subject: '9699', type: 'ms', time: 's17', paper: 1, variant: 3}, d => ms2 = d)
    getDocBeforeHook({subject: '0450', type: 'qp', time: 'w15', paper: 1, variant: 2}, d => paper3 = d)
    getDocBeforeHook({subject: '9701', type: 'qp', time: 's17', paper: 4, variant: 2}, d => paper4 = d)
    getDocBeforeHook({subject: '9701', type: 'ms', time: 's17', paper: 4, variant: 2}, d => ms4 = d)
    getDocBeforeHook({subject: '9709', type: 'ms', time: 's10', paper: 3, variant: 1}, d => ms5 = d)
    getDocBeforeHook({subject: '9709', type: 'er', time: 'w11'}, d => er1 = d)
    getDocBeforeHook({subject: '9702', type: 'qp', time: 's16', paper: 2, variant: 2}, d => paper6 = d)
    getDocBeforeHook({subject: '9702', type: 'er', time: 's16'}, d => er2 = d)
    getDocBeforeHook({subject: '0470', type: 'er', time: 's08'}, d => er3 = d)
    function expectBasicDir (st, mcq = false, xLimit = 90) {
      return st
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => {
          res.body.type.should.equal(mcq ? 'mcqMs' : 'questions')
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
              dirs[i].qNRect.x1.should.be.below(xLimit)
              dirs[i].qNRect.x2.should.be.below(xLimit + 20)
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
          .set('Host', 'schsrch.xyz'), false, 100)
        .expect(res => {
          let dirs = res.body.dirs
          dirs.length.should.equal(3)
          dirs.map(d => ({n: d.qN.toString(), p: d.page})).should.deepEqual([
            {n: '1', p: 1},
            {n: '2', p: 6},
            {n: '3', p: 8}
          ])
        })
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
    it('/doc/?as=dir (9701_s17_4_2_qp)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper4._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.length.should.equal(8))
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
    it('/doc/?as=dir for ms (9709_s10_3_1_ms)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + ms5._id + '/?as=dir')
          .set('Host', 'schsrch.xyz')
        .expect(res => res.body.dirs.length.should.equal(10))
        .end(done)
      )
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
        .expect(res => res.body.dirs.map(x => x.qT).join('').should.equal('DCBCB BCACD BDADD BDCDC BCCDA ABCDB BBACB CDBBC'.replace(/ /g, '')))
        .end(done)
    })
    it('should work for MCQ Mark Scheme (type 2)', function (done) {
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + MCQms2._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'), true)
        .expect(res => res.body.dirs.map(x => x.qT).join('').should.equal('DDADC BBCDA ADCAA CCDAD ABBBC BCCAA BACAC BCABC'.replace(/ /g, '')))
        .end(done)
    })
    it('should work for Examiner Report', function (done) {
      this.timeout(10000)
      supertest(schsrch)
        .get('/doc/' + er1._id + '/?as=dir')
        .set('Host', 'schsrch.xyz')
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.type.should.equal('er'))
        .expect(res => res.body.papers.should.be.an.Array())
        .expect(res => res.body.papers.length.should.equal(3*7))
        .expect(res => {
          let paper11 = res.body.papers[0]
          paper11.should.be.an.Object()
          paper11.pv.should.equal('11')
          paper11.dirs.should.be.an.Array()
          paper11.dirs.map(d => ({p: d.page, n: d.qNs})).should.deepEqual([
            {p: 0, n: [1]},
            {p: 0, n: [2]},
            {p: 0, n: [3]},
            {p: 0, n: [4]},
            {p: 1, n: [5]},
            {p: 1, n: [6]},
            {p: 1, n: [7]},
            {p: 1, n: [8]},
            {p: 1, n: [9]},
            {p: 2, n: [10]},
            {p: 2, n: [11]}
          ])
          let paper13 = res.body.papers[2]
          paper13.should.be.an.Object()
          paper13.pv.should.equal('13')
          paper13.dirs.should.be.an.Array()
          paper13.dirs.map(d => ({p: d.page, n: d.qNs})).should.deepEqual([
            {p: 6, n: [1]},
            {p: 6, n: [2]},
            {p: 6, n: [3]},
            {p: 7, n: [4]},
            {p: 7, n: [5]},
            {p: 7, n: [6]},
            {p: 7, n: [7]},
            {p: 8, n: [8]},
            {p: 8, n: [9]},
            {p: 8, n: [10]}
          ])
          let paper41 = res.body.papers[9]
          paper41.should.be.an.Object()
          paper41.pv.should.equal('41')
          paper41.dirs.should.be.an.Array()
          paper41.dirs.map(d => ({p: d.page, n: d.qNs})).should.deepEqual([
            {p: 27, n: [1]},
            {p: 27, n: [2]},
            {p: 27, n: [3]},
            {p: 27, n: [4]},
            {p: 27, n: [5]},
            {p: 28, n: [6]},
            {p: 28, n: [7]}
          ])
          let lastY = 0
          let lastPage = paper11.dirs[0].page
          for (let d of paper11.dirs) {
            let tRect = d.qNRect
            if (lastPage === d.page) {
              tRect.y1.should.be.above(lastY)
              lastY = tRect.y2
            } else {
              lastPage = d.page
              lastY = tRect.y2
            }
            tRect.x1.should.be.below(90)
          }
        })
        .end(done)
    })
    it('/doc/?as=dir (9702_s16_qp_22)', function (done) {
      this.timeout(5000)
      expectBasicDir(
        supertest(schsrch)
          .get('/doc/' + paper6._id + '/?as=dir')
          .set('Host', 'schsrch.xyz'))
        .expect(res => res.body.dirs.map(d => d.page).should.deepEqual([3, 5, 7, 8, 10, 12, 13, 15]))
        .end(done)
    })
    it('should work for Examiner Report (9702_s16)', function (done) {
      this.timeout(10000)
      supertest(schsrch)
        .get('/doc/' + er2._id + '/?as=dir')
        .set('Host', 'schsrch.xyz')
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.type.should.equal('er'))
        .expect(res => res.body.papers.should.be.an.Array())
        .expect(res => res.body.papers.length.should.equal(17))
        .expect(res => {
          let paper22 = res.body.papers[4]
          paper22.should.be.an.Object()
          paper22.pv.should.equal('22')
          paper22.dirs.should.be.an.Array()
          paper22.dirs.map(d => ({p: d.page, n: d.qNs})).should.deepEqual([
            {p: 10, n: [1]},
            {p: 11, n: [2]},
            {p: 11, n: [3]},
            {p: 11, n: [4]},
            {p: 12, n: [5]},
            {p: 12, n: [6]},
            {p: 12, n: [7]},
            {p: 12, n: [8]}
          ])
        })
        .end(done)
    })
    it('should work for Examiner Report (0470_s08)', function (done) {
      this.timeout(10000)
      debugger
      supertest(schsrch)
        .get('/doc/' + er3._id + '/?as=dir')
        .set('Host', 'schsrch.xyz')
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.type.should.equal('er'))
        .expect(res => res.body.papers.should.be.an.Array())
        .expect(res => res.body.papers.length.should.equal(4))
        .expect(res => {
          res.body.papers.map(x => x.pv).should.deepEqual(['10', '20', '30', '40'])
          let paper1 = res.body.papers[0]
          paper1.dirs.map(x => ({n: x.qNs, p: x.page})).should.deepEqual([
            {n: [1,2,3,4], p: 0},
            {n: [5], p: 0},
            {n: [6], p: 1},
            {n: [7], p: 1},
            {n: [8], p: 1},
            {n: [9], p: 1},
            {n: [10], p: 1},
            {n: [11], p: 1},
            {n: [12], p: 2},
            {n: [13], p: 2},
            {n: [14], p: 2},
            {n: [15,16,17,18,19,20,21,22,23,24,25], p: 2}
          ])
        })
        .end(done)
    })
  })
