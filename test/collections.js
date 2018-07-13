const supertest = require('supertest')
const should = require('should')
const crypto = require('crypto')

module.exports = (schsrch, dbModel) =>
  describe('Collections', function () {
    const {PastPaperId, PastPaperCollection} = dbModel

    function getNewId () {
      let newId = new PastPaperId({
        username: 'test-user-collections-' + Math.floor(Math.random() * 10000000),
        creationTime: Date.now()
      })
      return newId.save().then(() => {
        return PastPaperAuthSession.newSession(newId._id, '::1')
      })
      .then(token => {
        return Promise.resolve({tokenHex: token.toString('hex'), id: newId._id})
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
              .get(`/collection/${testee._id.toString()}/content/`)
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
                    .get(`/collection/${testee._id.toString()}/content/`)
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
                    .get(`/collection/${testee._id.toString()}/content/`)
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
              .get(`/collection/${testee._id.toString()}/content/`)
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
                .get(`/collection/${testee._id.toString()}/content/`)
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
            .get(`/collection/${testee._id.toString()}/content/`)
            .expect(200)
            .expect(res => res.body.should.be.an.Object())
            .expect(res => res.body.name.should.be.a.String())
            .expect(res => res.body.name.should.equal(contentName))
            .end(done)
        }, err => done(err))
      }, err => done(err))
    })

    it('should not allow non-authenticated client to create collections.', function (done) {
      PastPaperCollection.count().then(oldNum => {
        supertest(schsrch)
          .post('/collections/new/')
          .expect(401)
          .end(err => {
            if (err) {
              done(err)
              return
            }
            PastPaperCollection.count().then(newNum => {
              try {
                newNum.should.equal(oldNum)
                done()
              } catch (e) {
                done(e)
              }
            }, err => done(err))
          })
      }, err => done(err))
    })
    it('should create collections', function (done) {
      let createdCollectionId
      getNewId().then(newId => {
        supertest(schsrch)
          .post('/collections/new/')
          .set('Authorization', 'Bearer ' + newId.tokenHex)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => (createdCollectionId = res.body.id).should.be.a.String())
          .end(err => {
            if (err) {
              done(err)
              return
            }
            PastPaperCollection.findOne({_id: createdCollectionId}).then(collectionDoc => {
              try {
                should.exist(collectionDoc, 'should have created the collection.')
                collectionDoc.should.be.an.Object()
                collectionDoc.creationTime.should.equal(collectionDoc.ownerModifyTime)
                collectionDoc.owner.equals(newId.id).should.be.true()
                done()
              } catch (e) {
                done(e)
              }
            }, err => done(err))
          })
      }, err => done(err))
    })
    
    it('should be able to write to own collection', function (done) {
      getNewId().then(owner => {
        let col = new PastPaperCollection({
          creationTime: Date.now(),
          ownerModifyTime: Date.now(),
          content: {},
          owner: owner.id,
          allowedWrite: []
        })
        let testContent = {name: 'test set name'}
        col.save(() => {
          supertest(schsrch)
            .put(`/collection/${col._id}/content/`)
            .set('Authorization', 'Bearer ' + owner.tokenHex)
            .set('Content-Type', 'application/json')
            .send(testContent)
            .expect(200)
            .end(err => {
              if (err) {
                done(err)
                return
              }
              PastPaperCollection.findOne({_id: col._id}).then(col => {
                try {
                  should.exist(col)
                  col.should.be.an.Object()
                  col.content.should.deepEqual(testContent)
                  done()
                } catch (e) {
                  done(e)
                }
              }, err => done(err))
            })
        }, err => done(err))
      }, err => done(err))
    })

    it('should not be able to write to collection if body contain $-beginning object keys', function (done) {
      getNewId().then(owner => {
        let col = new PastPaperCollection({
          creationTime: Date.now(),
          ownerModifyTime: Date.now(),
          content: {},
          owner: owner.id,
          allowedWrite: []
        })
        let testContent = {name: 'test set name', $mongodb: 'handle this'}
        col.save(() => {
          supertest(schsrch)
            .put(`/collection/${col._id}/content/`)
            .set('Authorization', 'Bearer ' + owner.tokenHex)
            .set('Content-Type', 'application/json')
            .send(testContent)
            .expect(403)
            .end(err => {
              if (err) {
                done(err)
                return
              }
              PastPaperCollection.findOne({_id: col._id}).then(col => {
                try {
                  should.exist(col)
                  col.should.be.an.Object()
                  col.content.should.deepEqual({})
                  done()
                } catch (e) {
                  done(e)
                }
              }, err => done(err))
            })
        }, err => done(err))
      }, err => done(err))
    })

    function allowedWriteTest (numPeers, testPeer, _antiTest) {
      it(`should ${_antiTest ? 'not ' : ''}allow those ${_antiTest ? 'not ' : ''}in allowedWrite to write to the collection. (${_antiTest ? `outsider,` : `#${testPeer} in`} ${numPeers} peers)`, function (done) {
        getNewId().then(owner => {
          let idPromises = []
          for (let i = 0; i < numPeers; i ++) {
            idPromises.push(getNewId())
          }
          getNewId().then(stranger => {
            Promise.all(idPromises).then(peers => {
              let contentName = `Test ${owner.id.toString()}`
              let originalContent = {name: contentName}
              let testContentEdit = {name: 'Some new name' + contentName, text: 'Some new content ' + contentName}
              let testee = new PastPaperCollection({
                creationTime: Date.now(),
                ownerModifyTime: Date.now(),
                content: originalContent,
                owner: owner.id,
                publicRead: false,
                allowedWrite: peers.map(peer => peer.id)
              })
              if (!_antiTest) {
                testee.save().then(() => {
                  supertest(schsrch)
                    .put(`/collection/${testee._id.toString()}/content/`)
                    .set('Authorization', `Bearer ${peers[testPeer].tokenHex}`)
                    .set('Content-Type', 'application/json')
                    .send(testContentEdit)
                    .expect(200)
                    .end(err => {
                      if (err) {
                        done(err)
                        return
                      }
                      PastPaperCollection.findOne({_id: testee._id}).then(testee => {
                        try {
                          should.exist(testee)
                          testee.should.be.an.Object()
                          testee.content.should.deepEqual(testContentEdit)
                          done()
                        } catch (e) {
                          done(e)
                        }
                      })
                    })
                }, err => done(err))
              } else {
                testee.save().then(() => {
                  supertest(schsrch)
                    .put(`/collection/${testee._id.toString()}/content/`)
                    .set('Authorization', `Bearer ${stranger.tokenHex}`)
                    .set('Content-Type', 'application/json')
                    .send({content: testContentEdit})
                    .expect(401)
                    .expect(res => res.text.should.match(/denied/i))
                    .end(err => {
                      if (err) {
                        done(err)
                        return
                      }
                      PastPaperCollection.findOne({_id: testee._id}).then(testee => {
                        try {
                          should.exist(testee)
                          testee.should.be.an.Object()
                          testee.content.should.deepEqual(originalContent)
                          done()
                        } catch (e) {
                          done(e)
                        }
                      })
                    })
                }, err => done(err))
              }
            })
          })
        }, err => done(err))
      })
      if (!_antiTest && testPeer === 0)
        allowedWriteTest(numPeers, testPeer, true)
    }

    allowedWriteTest(1, 0)
    allowedWriteTest(2, 0)
    allowedWriteTest(2, 1)
    allowedWriteTest(3, 0)
    allowedWriteTest(3, 1)
    allowedWriteTest(3, 2)
    allowedWriteTest(30, 0)
    for (let i = 0; i < 4; i ++)
      allowedWriteTest(30, Math.floor(Math.random() * 30))

    for (let visitor of ['guest', 'other', 'owner']) {
      it(`/collections/by/... should show user's all collections where the visitor is allowed to read in order of modify time desc, when viewed by ${visitor}.`, function (done) {
        let now = Date.now()
        function createCollections ([owner, otherUser]) {
          return new Promise((resolve, reject) => {
            let collectionQueue = []
            let returns = []
            for (let allowedReadIncludeOther of [true, false]) {
              for (let allowedWriteIncludeOther of [true, false]) {
                for (let publiclyVisiable of [true, false]) {
                  let col = new PastPaperCollection({
                    creationTime: now - collectionQueue.length,
                    ownerModifyTime: now - collectionQueue.length,
                    content: null,
                    owner: owner.id,
                    publicRead: publiclyVisiable,
                    allowedRead: allowedReadIncludeOther ? [otherUser.id] : [],
                    allowedWrite: allowedWriteIncludeOther ? [otherUser.id] : []
                  })
                  let shouldPresent = false
                  if (publiclyVisiable) shouldPresent = true
                  else if (visitor === 'owner') shouldPresent = true
                  else if (visitor === 'other' && (allowedReadIncludeOther || allowedWriteIncludeOther)) shouldPresent = true
                  collectionQueue.push(col)
                  if (shouldPresent) {
                    returns.push(col._id.toString())
                  }
                }
              }
            }
            Promise.all(collectionQueue.map(x => x.save())).then(() => resolve({
              collectionsToExpect: returns,
              owner, otherUser
            }), reject)
          })
        }
        function doTest ({collectionsToExpect, owner, otherUser}) {
          let req = supertest(schsrch)
          req = req.get(`/collections/by/${owner.id.toString()}/`)
          if (visitor === 'other') {
            req = req.set('Authorization', 'Bearer ' + otherUser.tokenHex)
          } else if (visitor === 'owner') {
            req = req.set('Authorization', 'Bearer ' + owner.tokenHex)
          }
          req = req.expect(200).expect('Content-Type', /application\/json/)
          req = req.expect(res => res.body.should.be.an.Object())
                  .expect(res => res.body.list.should.be.an.Array())
                  .expect(res => {
                    let list = res.body.list
                    list.length.should.be.exactly(collectionsToExpect.length)
                    list.forEach((col, i) => {
                      col._id.should.be.a.String()
                      col._id.should.be.exactly(collectionsToExpect[i])
                    })
                  })
                  .expect(res => res.body.count.should.be.exactly(collectionsToExpect.length))
                  .end(done)
        }
        Promise.all([getNewId(), getNewId()]).then(createCollections).then(doTest).catch(done)
      })
    }

    it('/collections/by/non-existing-user/ should return 404', function (done) {
      supertest(schsrch)
        .get('/collections/by/000000000000000000000000/')
        .expect(404)
        .end(done)
    })

    for (let allowPublicRead of [true, false]) {
      for (let deleteBy of ['owner', 'other', 'guest']) {
        it(`${deleteBy} ${deleteBy === 'owner' ? 'can' : "can't"} delete ${deleteBy === 'owner' ? 'their ' : (deleteBy === 'other' ? "other's " : '')}${allowPublicRead ? 'public' : 'private'} collections`, function (done) {
          Promise.all([getNewId(), getNewId()]).then(([owner, other]) => {
            let now = Date.now()
            let col = new PastPaperCollection({
              creationTime: now,
              ownerModifyTime: now,
              owner: owner.id,
              publicRead: allowPublicRead,
              allowedRead: [],
              allowedWrite: []
            })
            col.save().then(() => {
              let req = supertest(schsrch)
                .delete(`/collection/${col._id}/`)
              if (deleteBy === 'owner') {
                req = req.set('Authorization', 'Bearer ' + owner.tokenHex)
              } else if (deleteBy === 'other') {
                req = req.set('Authorization', 'Bearer ' + other.tokenHex)
              }
              if (deleteBy === 'owner') {
                req = req.expect(200)
              } else {
                req = req.expect(401)
              }
              req = req.end(err => {
                if (err) {
                  done(err)
                  return
                }
                PastPaperCollection.findOne({_id: col._id}).then(doc => {
                  try {
                    if (deleteBy === 'owner') {
                      should.not.exist(doc)
                    } else {
                      should.exist(doc)
                    }
                    done()
                  } catch (e) {
                    done(e)
                  }
                })
              })
            }, err => done(err))
          }, err => done(err))
        })
      }
    }
  })
