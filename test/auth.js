const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

module.exports = (schsrch, dbModel) =>
  describe('Authentication', function () {
    const {PastPaperId} = dbModel
    it('should not accept requests with no Authorization header.', function (done) {
      supertest(schsrch)
        .get('/auth/')
        .expect(401)
        .expect(res => res.text.should.match(/need/i))
        .end(done)
    })

    function getNewToken () {
      let newid = new PastPaperId({
        creationTime: Date.now(),
        username: 'test-user-' + Math.floor(Math.random() * 10000000)
      })
      return newid.save().then(() => {
        return PastPaperAuthSession.newSession(newid._id, '::1')
      })
      .then(token => Promise.resolve(token.toString('hex')))
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
      let username = 'test-user-valid-token-' + Math.floor(Math.random() * 1000000)
      let newId = new PastPaperId({
        username,
        creationTime: Date.now()
      })
      newId.save().then(() => PastPaperAuthSession.newSession(newId, '::1')).then(token => {
        supertest(schsrch)
          .get('/auth/')
          .set('Authorization', 'Bearer ' + token.toString('hex'))
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body._id.should.be.a.String())
          .expect(res => res.body.username.should.be.a.String())
          .expect(res => res.body.username.should.equal(username))
          .end(done)
      }, err => done(err))
    })

    it('should create user', function (done) {
      let newUserId
      supertest(schsrch)
        .post('/auth/maowtm')
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.authToken.should.be.a.String())
        .expect(res => (newUserId = res.body.userId).should.be.a.String())
        .end(err => {
          if (err) {
            done(err)
            return
          }
          PastPaperId.find({_id: newUserId}).then(newIds => {
            try {
              newIds.length.should.equal(1)
              newIds[0].username.should.equal('maowtm')
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
    it('should not create existing user', function (done) {
      supertest(schsrch)
        .post('/auth/maowtm')
        .expect(400)
        .expect(res => res.text.should.match(/existed/i))
        .end(err => {
          if (err) {
            done(err)
            return
          }
          PastPaperId.find({username: 'maowtm'}).then(existingIds => {
            try {
              existingIds.length.should.equal(1, 'Should not have created user with conflicting username.')
              done()
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })

    function testInvalidUsername (username) {
      it('should not accept invalid username ' + JSON.stringify(username), function (done) {
        let newTokenHex
        supertest(schsrch)
          .post('/auth/' + encodeURIComponent(username))
          .expect(400)
          .expect(res => res.text.should.match(/invalid/i))
          .end(err => {
            if (err) {
              done(err)
              return
            }
            PastPaperId.find({username}).then(existingIds => {
              try {
                existingIds.length.should.equal(0, 'Should not have created the user.')
                done()
              } catch (e) {
                done(err)
              }
            }, err => done(err))
          })
      })
    }
    testInvalidUsername('mao\nwtm')
    testInvalidUsername('mao wtm')
  })
