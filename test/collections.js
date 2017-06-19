const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

module.exports = (schsrch, dbModel) =>
  describe('Collections', function () {
    const {PastPaperId, PastPaperCollection} = dbModel

    function getNewId () {
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
            resolve({tokenHex, id: newId._id})
          }, reject)
        })
      })
    }

    function ownerReadTest (collectionInit, testName, assignAllowedRead) {
      it(`should allow owner read of their ${testName} collections.`, function (done) {
        getNewId().then(owner => {
          let contentName = `Test ${owner.id.toString()}`
          let testeeConstruct = Object.assign({}, collectionInit, {
            creationTime: Date.now(),
            ownerModifyTime: Date.now(),
            content: {
              name: contentName
            },
            owner: owner.id
          })
          if (assignAllowedRead) {
            testeeConstruct.allowedRead = [owner.id]
          }
          let testee = new PastPaperCollection(testeeConstruct)
          testee.save().then(() => {
            supertest(schsrch)
              .get(`/collections/${testee._id.toString()}/cloudstorage/`)
              .set('Authorization', `Bearer ${owner.tokenHex}`)
              .expect(200)
              .expect(res => res.body.should.be.an.Object())
              .expect(res => res.body.name.should.be.a.String())
              .expect(res => res.body.name.should.equal(contentName))
              .end(done)
          }, err => done(err))
        }, err => done(err))
      })
    }

    ownerReadTest({
      publicRead: true
    }, 'public-readable')
    ownerReadTest({
      publicRead: false,
      allowedRead: []
    }, 'private')
    ownerReadTest({
      publicRead: false
    }, 'private', true)

    function allowedReadTest (numPeers, testPeer, _antiTest) {
      it(`should ${_antiTest ? 'not ' : ''}allow those ${_antiTest ? 'not ' : ''}in allowedRead to read private collection. (${_antiTest ? `outsider,` : `#${testPeer} in`} ${numPeers} peers)`, function (done) {
        getNewId().then(owner => {
          let idPromises = []
          for (let i = 0; i < numPeers; i ++) {
            idPromises.push(getNewId())
          }
          getNewId().then(stranger => {
            Promise.all(idPromises).then(peers => {
              let contentName = `Test ${owner.id.toString()}`
              let testee = new PastPaperCollection({
                creationTime: Date.now(),
                ownerModifyTime: Date.now(),
                content: {
                  name: contentName
                },
                owner: owner.id,
                publicRead: false,
                allowedRead: peers.map(peer => peer.id)
              })
              if (!_antiTest) {
                testee.save().then(() => {
                  supertest(schsrch)
                    .get(`/collections/${testee._id.toString()}/cloudstorage/`)
                    .set('Authorization', `Bearer ${peers[testPeer].tokenHex}`)
                    .expect(200)
                    .expect(res => res.body.should.be.an.Object())
                    .expect(res => res.body.name.should.be.a.String())
                    .expect(res => res.body.name.should.equal(contentName))
                    .end(done)
                }, err => done(err))
              } else {
                testee.save().then(() => {
                  supertest(schsrch)
                    .get(`/collections/${testee._id.toString()}/cloudstorage/`)
                    .set('Authorization', `Bearer ${stranger.tokenHex}`)
                    .expect(401)
                    .expect(res => res.text.should.match(/Access denied/i))
                    .end(done)
                }, err => done(err))
              }
            })
          })
        }, err => done(err))
      })
      if (!_antiTest && testPeer === 0)
        allowedReadTest(numPeers, testPeer, true)
    }

    allowedReadTest(1, 0)
    allowedReadTest(2, 0)
    allowedReadTest(2, 1)
    allowedReadTest(3, 0)
    allowedReadTest(3, 1)
    allowedReadTest(3, 2)
    allowedReadTest(30, 0)
    for (let i = 0; i < 4; i ++)
      allowedReadTest(30, Math.floor(Math.random() * 30))

    it(`should allow public read of public-readable collections.`, function (done) {
      getNewId().then(owner => {
        getNewId().then(stranger => {
          let contentName = `Test ${owner.id.toString()}`
          let testee = new PastPaperCollection({
            creationTime: Date.now(),
            ownerModifyTime: Date.now(),
            content: {
              name: contentName
            },
            owner: owner.id,
            publicRead: true
          })
          testee.save().then(() => {
            supertest(schsrch)
              .get(`/collections/${testee._id.toString()}/cloudstorage/`)
              .set('Authorization', `Bearer ${stranger.tokenHex}`)
              .expect(200)
              .expect(res => res.body.should.be.an.Object())
              .expect(res => res.body.name.should.be.a.String())
              .expect(res => res.body.name.should.equal(contentName))
              .end(done)
          }, err => done(err))
        })
      }, err => done(err))
    })

    it(`should allow public read of public-readable collections (even if there is allowedRead).`, function (done) {
      getNewId().then(owner => {
        Promise.all([getNewId(), getNewId(), getNewId()]).then(peers => {
          getNewId().then(stranger => {
            let contentName = `Test ${owner.id.toString()}`
            let testee = new PastPaperCollection({
              creationTime: Date.now(),
              ownerModifyTime: Date.now(),
              content: {
                name: contentName
              },
              owner: owner.id,
              publicRead: true,
              allowedRead: peers.map(peer => peer.id)
            })
            testee.save().then(() => {
              supertest(schsrch)
                .get(`/collections/${testee._id.toString()}/cloudstorage/`)
                .set('Authorization', `Bearer ${stranger.tokenHex}`)
                .expect(200)
                .expect(res => res.body.should.be.an.Object())
                .expect(res => res.body.name.should.be.a.String())
                .expect(res => res.body.name.should.equal(contentName))
                .end(done)
            }, err => done(err))
          })
        })
      }, err => done(err))
    })

    it(`should allow public read of public-readable collections (no authentication).`, function (done) {
      getNewId().then(owner => {
        let contentName = `Test ${owner.id.toString()}`
        let testee = new PastPaperCollection({
          creationTime: Date.now(),
          ownerModifyTime: Date.now(),
          content: {
            name: contentName
          },
          owner: owner.id,
          publicRead: true
        })
        testee.save().then(() => {
          supertest(schsrch)
            .get(`/collections/${testee._id.toString()}/cloudstorage/`)
            .expect(200)
            .expect(res => res.body.should.be.an.Object())
            .expect(res => res.body.name.should.be.a.String())
            .expect(res => res.body.name.should.equal(contentName))
            .end(done)
        }, err => done(err))
      }, err => done(err))
    })
  })
