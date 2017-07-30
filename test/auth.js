const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')
const scrypt = require('scrypt')

const scryptParam = scrypt.paramsSync(0.05)

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
      let newUserId, newToken
      supertest(schsrch)
        .post('/auth/maowtm')
        .send({})
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => (newToken = res.body.authToken).should.be.a.String())
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
              PastPaperAuthSession.findOne({authToken: newToken}).then(session => done((typeof session === 'object') ? null : new Error('token returned is invalid.')), err => done(err))
            } catch (e) {
              done(err)
            }
          }, err => done(err))
        })
    })
    it('should not create existing user', function (done) {
      supertest(schsrch)
        .post('/auth/maowtm')
        .send({})
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
    it('should allow client to generate token', function (done) {
      crypto.randomBytes(16, function (err, token) {
        if (err) {
          done(err)
          return
        }
        supertest(schsrch)
          .post('/auth/maowtm2')
          .send({authToken: token.toString('hex')})
          .expect(200)
          .expect(res => res.body.authToken.should.equal(token.toString('hex'), 'returned token incorrect'))
          .end(err => {
            if (err) {
              done(err)
              return
            }
            PastPaperAuthSession.findOne({authToken: token}).then(session => done((typeof session === 'object') ? null : new Error('token is invalid.')), err => done(err))
          })
      })
    })

    it('should allow replace challenge', function (done) {
      let user = new PastPaperId({
        creationTime: Date.now(),
        username: 'test-user-' + Math.floor(Math.random() * 1000000)
      })
      let password = Math.random().toString()
      user.save().then(() => {
        return PastPaperAuthSession.newSession(user._id, '::1')
      })
      .then(token => {
        return new Promise((resolve, reject) => {
          supertest(schsrch)
            .post('/auth/challenges/replace/')
            .set('Authorization', 'Bearer ' + token.toString('hex'))
            .send({
              type: 'password',
              password: password
            })
            .expect(200)
            .end(err => err ? reject(err) : resolve())
        })
      })
      .then(() => {
        return PastPaperSessionGranter.find({userId: user._id, type: 'scrypt'})
      })
      .then(granters => {
        granters.should.be.an.Array()
        granters.length.should.equal(1, 'Only 1 granter should be present.')
        return Promise.resolve(granters[0])
      })
      .then(g => {
        Buffer.isBuffer(g.challenge).should.be.true()
        return scrypt.verifyKdf(g.challenge, password).then(result => {
          if (result) return Promise.resolve()
          else return Promise.reject(new Error('Stored password is wrong.'))
        })
      })
      .then(() => done(), err => done(err))
    })

    function passwordLoginTest (mode) {
      return function (done) {
        let user = new PastPaperId({
          creationTime: Date.now(),
          username: 'test-user-' + Math.floor(Math.random() * 1000000)
        })
        let password = Math.random().toString()
        user.save().then(() => {
          return scrypt.kdf(password, scryptParam)
        })
        .then(kdf => {
          let sg = new PastPaperSessionGranter({
            userId: user._id,
            type: 'scrypt',
            challenge: kdf
          })
          return sg.save()
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            let newToken = null
            let challengeResponse = null
            if (mode === 'correct') {
              challengeResponse = {
                type: 'password',
                password
              }
            } else if (mode === 'incorrect') {
              challengeResponse = {
                type: 'password',
                password: password + ' '
              }
            } else if (mode === 'non-password') {
              challengeResponse = {
                type: 'test'
              }
            } else if (mode === 'empty') {
              challengeResponse = {
              }
            }
            let req = supertest(schsrch)
              .post(`/auth/${user.username}/newSession/`)
              .send(challengeResponse)
            if (mode === 'correct') {
              req = req.expect(200)
                .expect(res => res.body.should.be.an.Object())
                .expect(res => (newToken = res.body.authToken).should.be.a.String())
                .end(err => {
                  if (err) reject(err)
                  else resolve(newToken)
                })
            } else {
              req = req.expect(403)
                .end(err => {
                  if (err) reject(err)
                  else resolve()
                })
            }
          })
        })
        .then(tokenHex => {
          if (mode === 'correct') {
            let token = Buffer.from(tokenHex, 'hex')
            return PastPaperAuthSession.find({authToken: token, userId: user._id, valid: true})
              .then(ss => {
                ss.length.should.equal(1)
                return Promise.resolve()
              })
          } else {
            return PastPaperAuthSession.find({userId: user._id})
              .then(ss => {
                ss.length.should.equal(0)
                return Promise.resolve()
              })
          }
        })
        .then(() => done(), err => done(err))
      }
    }

    it('should allow login with password challenge', passwordLoginTest('correct'))
    it('should not allow login with wrong password', passwordLoginTest('incorrect'))
    it('should not allow login with unknow challenge type', passwordLoginTest('non-password'))
    it('should not allow login with empty challenge response', passwordLoginTest('empty'))

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

    it('should be able to invalid session', function (done) {
      getNewToken().then(tokenHex => {
        supertest(schsrch)
          .delete('/auth/session/')
          .set('Authorization', 'Bearer ' + tokenHex)
          .expect(200)
          .end(err => {
            if (err) {
              done(err)
              return
            }
            PastPaperAuthSession.find({authToken: Buffer.from(tokenHex, 'hex')}).then(ass => {
              if (ass.length > 1 || (ass.length === 1 && ass[0].valid)) {
                done(new Error('Session still present.'))
                return
              }
              supertest(schsrch)
                .get('/auth/')
                .set('Authorization', 'Bearer ' + tokenHex)
                .expect(401)
                .expect(res => res.text.should.match(/token invalid/))
                .end(done)
            }, err => done(err))
          })
      }, err => done(err))
    })
  })
