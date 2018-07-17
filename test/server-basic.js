const supertest = require('supertest')
const should = require('should')
const fs = require('fs')
const path = require('path')
const CIESubjects = require('../view/CIESubjects.js')

module.exports = schsrch =>
  describe('Basic pages', function () {
    it('200 for /', function (done) {
      supertest(schsrch)
        .get('/')
        .expect('Content-Type', /html/)
        .expect(200)
        .end(done)
    })
    it('200 for beta.siteOrigin/', function (done) {
      supertest(schsrch)
        .get('/')
        .set('Host', 'beta.schsrch.xyz')
        .expect('Content-Type', /html/)
        .expect(200)
        .end(done)
    })
    it('beta.siteOrigin/robots.txt', function (done) {
      supertest(schsrch)
        .get('/robots.txt')
        .set('Host', 'beta.schsrch.xyz')
        .expect('Content-Type', /text\/plain/)
        .expect(200)
        .expect(res => res.text.should.have.length(0))
        .end(done)
    })
    it('siteOrigin/robots.txt', function (done) {
      supertest(schsrch)
        .get('/robots.txt')
        .set('Host', 'schsrch.xyz')
        .expect('Content-Type', /text\/plain/)
        .expect(200)
        .expect(res => res.text.should.have.length(0))
        .end(done)
    })
    it('www.siteOrigin', function (done) {
      supertest(schsrch)
        .get('/whatever')
        .set('Host', 'www.schsrch.xyz')
        .expect(302)
        .expect('Location', 'https://schsrch.xyz/whatever')
        .end(done)
    })
    it('/status', function (done) {
      supertest(schsrch)
        .get('/status')
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.docCount.should.be.a.Number())
        .expect(res => res.body.indexCount.should.be.a.Number())
        .expect(res => res.body.requestCount.should.be.a.Number())
        .end(done)
    })
    it('/sw.js', function (done) {
      fs.readFile(path.join(__dirname, '../dist/sw.js'), {encoding: 'utf-8'}, (err, data) => {
        if (err) return done(err)
        supertest(schsrch)
          .get('/sw.js')
          .expect(200)
          .expect('Content-Type', /javascript/)
          .expect(res => res.text.should.equal(data))
          .end(done)
      })
    })
    it('/opensearch.xml', function (done) {
      fs.readFile(path.join(__dirname, '../view/opensearch.xml'), {encoding: 'utf-8'}, (err, data) => {
        if (err) return done(err)
        supertest(schsrch)
          .get('/opensearch.xml')
          .expect(200)
          .expect('Content-Type', /opensearchdescription\+xml/)
          .expect(res => res.text.should.equal(data))
          .end(done)
      })
    })
    it('/disclaim/', function (done) {
      supertest(schsrch)
        .get('/disclaim/')
        .expect(200)
        .expect('Content-Type', /html/)
        .expect(res => res.text.length.should.be.above(0))
        .end(done)
    })
    it('/help/', function (done) {
      supertest(schsrch)
        .get('/help/')
        .expect(200)
        .expect('Content-Type', /html/)
        .expect(res => res.text.length.should.be.above(0))
        .end(done)
    })
    it('/search/?as=page', function (done) {
      const tQuery = `whateverqueryhere${Math.random()}`
      supertest(schsrch)
        .get('/search/?as=page&query=' + encodeURIComponent(tQuery))
        .expect(200)
        .expect('Content-Type', /html/)
        .expect(res => res.text.indexOf(`<input type="text" class="querybox border" value=${JSON.stringify(tQuery)} name="query" autocomplete="off"`).should.be.aboveOrEqual(0))
        .end(done)
    })
    it('/search/?as=page&query=(empty)', function (done) {
      supertest(schsrch)
        .get('/search/?as=page&query=')
        .expect(302)
        .expect('Location', '/')
        .end(done)
    })
    it('/search/?as=page&query=(space)', function (done) {
      supertest(schsrch)
        .get('/search/?as=page&query=%20')
        .expect(302)
        .expect('Location', '/')
        .end(done)
    })
    it('/redbook', function (done) {
      supertest(schsrch)
        .get('/redbook')
        .expect(302)
        .expect('Location', 'https://static.maowtm.org/redbook.pdf')
        .end(done)
    })
    it('/subjects/', function (done) {
      supertest(schsrch)
        .get('/subjects/?as=json')
        .expect(200)
        .expect(res => {
          res.body.should.be.an.Array()
          res.body.map(x => x._id).sort().should.deepEqual(['0417', '0450', '0470', '0610', '0611', '0612', '9699', '9700', '9701', '9702', '9703', '9708', '9709'])
          let deepTested = false
          res.body.forEach(s => {
            s.times.should.be.an.Array()
            let cSubj = CIESubjects.findExactById(s._id)
            if (cSubj) {
              if (!s.name || !s.level) {
                throw new Error(`Expected s.name and s.level to exist for subject ${JSON.stringify(cSubj)}. Got ${s.name} and ${s.level}.`)
              }
              s.name.should.equal(cSubj.name)
              s.level.should.equal(cSubj.level)
            }
            if (s._id === '9709') {
              s.times.slice().sort().should.deepEqual(['s10', 'w11'])
              s.totalPaper.should.equal(2)
              deepTested = true
            }
          })
          deepTested.should.be.true()
        })
        .end(done)
    })
  })
