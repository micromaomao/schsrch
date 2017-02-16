const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

module.exports = (schsrch, dbModel) =>
  describe('Getting the document', function () {
    const {PastPaperDoc, PastPaperIndex} = dbModel
    it('fetchDoc', function (done) {
      PastPaperDoc.find({subject: '0610', time: 's17', paper: 1, variant: 1, type: 'qp'}).then(docs => {
        if (!docs || docs.length !== 1) {
          done(new Error(`There should be one and only one 0610_s17_1_1_qp in the testing database (there are currently ${docs.length}).`))
          return
        }
        let tDoc = docs[0]
        let hash = crypto.createHash('sha256')
        supertest(schsrch)
          .get('/fetchDoc/' + encodeURIComponent(tDoc._id) + '/')
          .set('Host', 'schsrch.xyz')
          .expect(200)
          .expect('Content-Type', /pdf/)
          .expect(res => res.header['content-length'].should.be.above(0))
          .buffer()
          .parse((res, callback) => {
            res.setEncoding('binary')
            res.on('data', chunk => {
              hash.write(chunk)
            })
            res.on('end', () => {
              hash.end()
              callback(null, null)
            })
          })
          .end(err => {
            if (err) {
              done(err)
              return
            }
            hash.on('readable', () => {
              try {
                hash.read().toString('hex').should.equal('00a2562f321e764b70a69fa4d374f8ac5aee20731e4a788f2ce4a898f41f262b') // sha256sum test/pastpapers/0610_s17_qp_11.pdf
                done()
              } catch (e) {
                done(e)
              }
            })
          })
        })
    })
    it('fetchDoc with 000000000000000000000000', function (done) {
      supertest(schsrch)
        .get('/fetchDoc/000000000000000000000000/')
        .set('Host', 'schsrch.xyz')
        .expect(404)
        .end(done)
    })
    let sspdfTestDoc = null
    function sspdfTestBody (done) {
      PastPaperDoc.find({subject: '0610', time: 's16', paper: 2, variant: 0, type: 'qp'}).then(docs => {
        if (!docs || docs.length !== 1) {
          done(new Error(`There should be one and only one 0610_s16_2_0_qp in the testing database (there are currently ${docs.length}).`))
          return
        }
        let tDoc = docs[0]
        sspdfTestDoc = tDoc
        supertest(schsrch)
          .get('/sspdf/' + encodeURIComponent(tDoc._id) + '/0')
          .set('Host', 'schsrch.xyz')
          .expect(200)
          .expect('Content-Type', /json/)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.doc.should.be.an.Object())
          .expect(res => ['subject', 'time', 'paper', 'variant', 'type', 'numPages', 'fileType'].forEach(p => res.body.doc[p].should.equal(tDoc[p])))
          .expect(res => res.body.doc._id.should.equal(tDoc._id.toString()))
          .expect(res => ['width', 'height'].forEach(p => res.body[p].should.be.a.Number().and.above(0)))
          .expect(res => res.body.pageNum.should.equal(tDoc.numPages))
          .expect(res => should.not.exist(res.body.doc.doc))
          .expect(res => res.body.svg.should.be.a.String().and.match(/^<svg/))
          .end(done)
        })
    }
    it('sspdf', sspdfTestBody)
    it('sspdf (second time on the same document)', sspdfTestBody)
    it('sspdf (third time on the same document)', sspdfTestBody)
    it('sspdf (multi-thread)', function (done) {
      Promise.all([1,1,1,1,1].map(x => new Promise((resolve, reject) => {
        sspdfTestBody(function (err) {
          console.log('    ' + (err ? 'x' : '✓'))
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }))).then(() => done(), err => done(err))
    })
    function testPage404 (page, done) {
      let tDoc = sspdfTestDoc
      supertest(schsrch)
        .get('/sspdf/' + encodeURIComponent(tDoc._id) + '/' + page)
        .set('Host', 'schsrch.xyz')
        .expect(404)
        .end(done)
    }
    it('404 for sspdf with page -1', function (done) {
      testPage404(-1, done)
    })
    it('404 for sspdf with page 1 (out of range)', function (done) {
      testPage404(1, done)
    })
    it('404 for sspdf with page NaN', function (done) {
      testPage404('NaN', done)
    })
    it('404 for 000000000000000000000000', function (done) {
      supertest(schsrch)
        .get('/sspdf/000000000000000000000000/0')
        .set('Host', 'schsrch.xyz')
        .expect(404)
        .end(done)
    })
    it('should cached sspdf preview', function (done) {
      PastPaperIndex.findOne({doc: sspdfTestDoc._id, page: 0}).then(idx => {
        if (!idx) {
          done(new Error('Index not exist.'))
          return
        }
        try {
          idx.sspdfCache.should.be.an.Object()
          idx.sspdfCache.svg.should.be.a.String().and.match(/^<svg/)
          idx.sspdfCache.rects.should.be.an.Array()
          idx.sspdfCache.rects.forEach(x => x.should.be.an.Object())
          done()
        } catch (e) {
          done(e)
        }
      })
    })
  })
