const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

module.exports = (schsrch, dbModel) =>
  describe('Authentication', function () {
    const {PastPaperId} = dbModel
    it('should not accept requests with no Authorization header.', function (done) {
      supertest(schsrch)
        .get('/auth/')
        .expect(400)
        .expect(res => res.text.should.match(/authorization/i))
        .expect(res => res.text.should.match(/header/i))
        .end(done)
    })

    function getNewToken () {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, newToken) => {
          if (err) {
            reject(err)
            return
          }
          let tokenHex = newToken.toString('hex')
          let newId = new PastPaperId({
            authToken: newToken,
            creationTime: Date.now(),
            username: tokenHex
          })
          newId.save().then(() => {
            resolve(tokenHex)
          }, reject)
        })
      })
    }

    it('should not accept invalid Authorization header', function (done) {
      getNewToken().then(tokenHex => {
        supertest(schsrch)
          .get('/auth/')
          .set('Authorization', tokenHex)
          .expect(400)
          .expect(res => res.text.should.match(/authorization/i))
          .expect(res => res.text.should.match(/header/i))
          .end(done)
      }, err => done(err))
    })
    it('should not accept invalid Authorization header', function (done) {
      getNewToken().then(tokenHex => {
        supertest(schsrch)
          .get('/auth/')
          .set('Authorization', 'Basic ' + tokenHex)
          .expect(400)
          .expect(res => res.text.should.match(/authorization/i))
          .expect(res => res.text.should.match(/header/i))
          .end(done)
      }, err => done(err))
    })
    it('should not accept invalid token', function (done) {
      crypto.randomBytes(16, (err, fakeToken) => {
        if (err) {
          done(err)
          return
        }
        let fakeTokenHex = fakeToken.toString('hex')
        supertest(schsrch)
          .get('/auth/')
          .set('Authorization', 'Bearer ' + fakeTokenHex)
          .expect(401)
          .expect(res => res.text.should.match(/token/i))
          .end(done)
      })
    })
    it('should accept valid token', function (done) {
      getNewToken().then(tokenHex => {
        supertest(schsrch)
          .get('/auth/')
          .set('Authorization', 'Bearer ' + tokenHex)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body._id.should.be.a.String())
          .expect(res => res.body.username.should.be.a.String())
          .expect(res => res.body.username.should.equal(tokenHex))
          .end(done)
      }, err => done(err))
    })
  })
