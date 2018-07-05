const supertest = require('supertest')
const should = require('should')

module.exports = (schsrch, dbModel) =>
  describe('Feedback collector', function () {
    const {PastPaperFeedback} = dbModel
    before(function (done) {
      PastPaperFeedback.count({}).then(ct => {
        if (ct !== 0) {
          done(new Error(`There are ${ct} existing feedback items.`))
        } else {
          done()
        }
      })
    })

    it('should not accept non-json content-type', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('a=1')
        .expect(415)
        .end(done)
    })
    it('should not accept invalid json', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send('{a:1}')
        .expect(403)
        .end(done)
    })
    it('should not accept invalid json', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send('')
        .expect(403)
        .end(done)
    })
    it('should not accept invalid json', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send('0')
        .expect(403)
        .end(done)
    })
    it('should not accept json array', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send([1, 2, 3])
        .expect(403)
        .end(done)
    })
    it('should not accept empty test', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({email: '', text: '', search: null})
        .expect(403)
        .expect(res => res.text.should.match(/content/i))
        .expect(res => res.text.should.match(/required/i))
        .end(done)
    })
    it('should not accept too long', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({email: '', text: 'x'.repeat(5001), search: null})
        .expect(403)
        .expect(res => res.text.should.match(/more than/i))
        .end(done)
    })
    it('should not accept invalid email', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({email: 'm@', text: 'stub!', search: null})
        .expect(403)
        .expect(res => res.text.should.match(/email/i))
        .end(done)
    })
    it('should not accept too long email', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({email: 'm'.repeat(5000) + '@maowtm.org', text: 'stub!', search: null})
        .expect(403)
        .expect(res => res.text.should.match(/email/i))
        .end(done)
    })
    it('should not accept too long search', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({email: 'm@maowtm.org', text: 'stub!', search: 'x'.repeat(5001)})
        .expect(403)
        .end(done)
    })
    function assertStub1 (fbs) {
      fbs.should.have.length(1)
      fbs[0].time.should.be.approximately(Date.now(), 1000)
      fbs[0].ip.should.be.a.String()
      fbs[0].ip.length.should.be.above(0)
      fbs[0].email.should.be.a.String().and.have.length(0)
      should.not.exist(fbs[0].search)
    }
    it('should store feedback with no email and no search', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({text: 'stub1', email: '', search: null})
        .expect(200)
        .end(function (err) {
          if (err) {
            done(err)
            return
          }
          PastPaperFeedback.find({text: 'stub1'}).then(fbs => {
            try {
              assertStub1(fbs)
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
    it('should store feedback with null email (convert to empty string) and no search', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({text: 'stub2', email: null, search: null})
        .expect(200)
        .end(function (err) {
          if (err) {
            done(err)
            return
          }
          PastPaperFeedback.find({text: 'stub2'}).then(fbs => {
            try {
              assertStub1(fbs)
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
    it('should store feedback with email and no search', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({text: 'stub3', email: 'mao@example.com', search: null})
        .expect(200)
        .end(function (err) {
          if (err) {
            done(err)
            return
          }
          PastPaperFeedback.find({text: 'stub3'}).then(fbs => {
            try {
              fbs.should.have.length(1)
              fbs[0].time.should.be.approximately(Date.now(), 1000)
              fbs[0].ip.should.be.a.String()
              fbs[0].ip.length.should.be.above(0)
              fbs[0].email.should.equal('mao@example.com')
              should.not.exist(fbs[0].search)
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
    it('should store feedback with no email and a search', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({text: 'stub4', email: '', search: 'whateverquery'})
        .expect(200)
        .end(function (err) {
          if (err) {
            done(err)
            return
          }
          PastPaperFeedback.find({text: 'stub4'}).then(fbs => {
            try {
              fbs.should.have.length(1)
              fbs[0].time.should.be.approximately(Date.now(), 1000)
              fbs[0].ip.should.be.a.String()
              fbs[0].ip.length.should.be.above(0)
              fbs[0].email.should.be.a.String().and.have.length(0)
              fbs[0].search.should.equal('whateverquery')
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
    it('should store feedback with an email and a search', function (done) {
      supertest(schsrch)
        .post('/feedback/')
        .set('Content-Type', 'application/json')
        .send({text: 'stub5', email: 'm@example.com', search: 'whateverquery'})
        .expect(200)
        .end(function (err) {
          if (err) {
            done(err)
            return
          }
          PastPaperFeedback.find({text: 'stub5'}).then(fbs => {
            try {
              fbs.should.have.length(1)
              fbs[0].time.should.be.approximately(Date.now(), 1000)
              fbs[0].ip.should.be.a.String()
              fbs[0].ip.length.should.be.above(0)
              fbs[0].email.should.equal('m@example.com')
              fbs[0].search.should.equal('whateverquery')
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
  })
