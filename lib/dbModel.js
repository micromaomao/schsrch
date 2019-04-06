const sspdf = require('./sspdf.js')
const Recognizer = require('./recognizer.js')
const mongoose = require.main.require('mongoose')
const crypto = require('crypto')
const scrypt = require('scrypt')
const { Fido2Lib } = require('fido2-lib')
const scryptParam = scrypt.paramsSync(0.05)
const SITE_ORIGIN = process.env.SITE_ORIGIN
const rpId = new (require('url').URL)(SITE_ORIGIN).hostname
const f2l = new Fido2Lib({
  timeout: 5 * 60 * 1000,
  rpId,
  rpName: rpId,
  attestation: "none"
})

module.exports = (db, es) => {
  let awaiting = []
  // A doc document dosen't necessarily need to be PDF! It can, for example, be mp3 in the case of listening files, or be zip in the case of CS source files.
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true, required: true},
    time: {type: 'String', index: true, required: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true, required: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true, required: true},
    variant: {type: 'Number', index: true, required: true},
    fileBlob: {type: 'Buffer', required: false}, // Remain for legacy reason.
    /*
      If fileBlob !== null, it will contain the *entire* pdf. Otherwise, see PaperBlobs.
    */
    fileType: {type: 'String', default: 'pdf', required: true},
    numPages: {type: 'Number', required: false, default: null}, // For fileType !== 'pdf', null.
    dir: {type: 'Object', default: {}, required: false},
    gs_optimized: {type: 'Boolean', default: false, required: false, index: true}
  })
  docSchema.index({subject: 1, time: 1, paper: 1, variant: 1})
  docSchema.index({subject: 1, type: 1})

  let paperBlobSchema = new mongoose.Schema({
    docId: {type: 'ObjectId', required: true},
    offset: {type: 'Number', required: true}, // Byte offset
    data: {type: 'Buffer', required: true}
  })
  paperBlobSchema.index({docId: 1, offset: 1})

  docSchema.method('ensureDir', async function () {
    if (this.fileType !== 'pdf') {
      return {
        type: 'blob',
        fileType: this.fileType
      }
    }
    if (!this.fileBlob && this.fileBlob !== null) throw new Error('this.fileBlob must present.')

    const postProcess = async (dir) => {
      // Add docid to er dir pv entries.
      if (this.type !== 'er' || dir.type !== 'er' || dir.papers.length === 0) return dir
      let qps = await PastPaperDoc.find({subject: this.subject, time: this.time, type: 'qp'}, {fileBlob: false, dir: false})
      dir.papers = dir.papers.map(p => {
        let paper = parseInt(p.pv[0])
        let variant = parseInt(p.pv[1])
        let qpr = qps.filter(p => p.paper === paper && p.variant === variant)
        if (qpr.length > 0) {
          p.docid = qpr[0]._id
        }
        return p
      })
      return dir
    }

    if (this.dir && Recognizer.meaningfulDir(this.dir)) return await postProcess(this.dir)
    let blob = await this.getFileBlob()
    let pageDatas = await sspdf.getPDFContentAll(blob)
    let recognizerArg = []
    for (let p = 0; p < pageDatas.numPages; p ++) {
      let pageObj = {}
      pageObj.rects = pageDatas.pageRects[p]
      pageObj.content = pageDatas.pageTexts[p]
      pageObj.docId = this._id
      pageObj.page = p
      recognizerArg[p] = pageObj
    }
    let dir = Recognizer.dir(recognizerArg)
    this.set('dir', dir)
    await this.save()
    return await postProcess(dir)
  })

  docSchema.method('getFileBlob', function (_det) {
    if (typeof _det !== 'undefined') throw new Error('Expected 0 arguments.')
    if (Buffer.isBuffer(this.fileBlob)) return Promise.resolve(this.fileBlob)
    if (this.fileBlob !== null) throw new Error('Need fileBlob present. (Can be null)')
    return PastPaperPaperBlob.find({docId: this._id}).sort({offset: 1}).exec().then(chunks => {
      if (chunks.length === 0) return Promise.resolve(Buffer.from(''))
      let cOffset = 0
      let buffers = []
      for (let ch of chunks) {
        if (ch.offset !== cOffset) {
          return Promise.reject(new Error(`Expected ch.offset = ${cOffset}, but got ${ch.offset}.`))
        }
        if (!Buffer.isBuffer(ch.data)) return Promise.reject(new Error('ch.data must be a Buffer.'))
        cOffset += ch.data.length
        buffers.push(ch.data)
      }
      return Promise.resolve(Buffer.concat(buffers))
    })
  })

  let indexSchema = new mongoose.Schema({
    docId: {type: 'ObjectId', required: true},
    content: {type: 'String', required: false, default: '', index: false},
    page: {type: 'Number', required: true},
    sspdfCache: {type: 'Object', default: null}
  })
  indexSchema.index({docId: 1, page: 1})

  awaiting.push(es.indices.create({
    index: 'pastpaper',
    body: {
      mappings: {
        PastPaperIndex: {
          _all: {
            enabled: false
          },
          properties: {
            "docId": { type: 'keyword', index: true },
            "subject": { type: 'keyword', index: true },
            "paper": { type: 'keyword', index: true },
            "content": { type: 'text', index: true },
            "page": { type: 'integer', index: true }
          }
        }
      }
    }
  }).then(() => Promise.resolve(), err => {
    if (err.body && err.body.error && /^[a-z]+_already_exists_exception$/.test(err.body.error.type)) return Promise.resolve()
    else return Promise.reject(err)
  }))

  indexSchema.method('indexToElastic', function (doc) {
    if (!Number.isSafeInteger(this.page)) throw new Error('this.page needed.')
    if (!this.docId && !doc) throw new Error('this.docId needed.')
    if (typeof this.content !== 'string') throw new Error('this.content needed.')
    else if (!this.docId && doc._id) this.docId = doc._id
    let gotDocs = doc => {
      if (!doc) return Promise.reject(new Error('Corrosponding doc not find.'))
      let esDoc = {
        docId: this.docId.toString(),
        subject: doc.subject,
        paper: doc.paper.toString(),
        content: this.content,
        page: this.page
      }
      return es.update({
        index: 'pastpaper',
        type: 'PastPaperIndex',
        id: this._id.toString(),
        body: {
          doc: esDoc,
          upsert: esDoc
        }
      })
    }
    if (doc) return gotDocs(doc)
    return PastPaperDoc.findOne({_id: this.docId}, {fileBlob: false}).then(gotDocs)
  })

  indexSchema.static('search', function (query) {
    let dslQuery
    let queryPerfixMatch = query.trim().match(/^(\d{4})\s+(.+)$/)
    if (!queryPerfixMatch) {
      dslQuery = {
        match: {
          content: query
        }
      }
    } else {
      let subject = queryPerfixMatch[1]
      let remainingQuery = queryPerfixMatch[2]
      let queryPaperMatch = remainingQuery.trim().match(/^pa?p?e?r?\s*(\d)\s+(.+)$/)
      if (queryPaperMatch) {
        dslQuery = {
          bool: {
            must: [
              {
                match: {
                  content: queryPaperMatch[2]
                }
              },
              {
                term: {
                  subject: subject
                }
              },
              {
                term: {
                  paper: queryPaperMatch[1]
                }
              }
            ]
          }
        }
      } else {
        dslQuery = {
          bool: {
            must: [
              {
                match: {
                  content: remainingQuery
                }
              },
              {
                term: {
                  subject: subject
                }
              }
            ]
          }
        }
      }
    }

    return es.search({
      index: 'pastpaper',
      body: {
        query: dslQuery,
        sort: [
          '_score'
        ],
        from: 0,
        size: 99
      }
    }).then(res => {
      if (!res.hits || !res.hits.hits || res.hits.hits.length === 0) {
        return Promise.resolve([])
      }
      return Promise.all(res.hits.hits.map(hit => PastPaperDoc.find({_id: hit._source.docId}, {fileBlob: false, dir: false}).then(doc => Promise.resolve({
        doc: doc[0],
        index: {
          _id: hit._id,
          content: hit._source.content,
          page: hit._source.page,
          docId: hit._source.docId
        },
      })))).then(arr => Promise.resolve(arr.filter(x => x.doc)))
    })
  })

  let feedbackSchema = new mongoose.Schema({
    time: {type: 'Number', index: true, required: true},
    ip: {type: 'String', required: true},
    email: {type: 'String', index: true, required: false, validate: {
      validator: v => {
        return typeof v === 'string' && (v === '' || /.+@.+\..+/i.test(v)) && v.length <= 5000
      },
      message: 'Check your email address for typos'
    }},
    text: {type: 'String', required: [true, 'Feedback content required'], validate: {
      validator: v => {
        return typeof v === 'string' && (v.length > 0 && v.length <= 5000)
      },
      message: 'Your feedback must not be empty, and it must not contain more than 5000 characters'
    }},
    search: {type: 'String', required: false, validate: {
      validator: v => {
        return (v === null) || (typeof v === 'string' && v.length > 0 && v.length <= 5000)
      }
    }}
  })

  let requestRecordSchema = new mongoose.Schema({
    ip: {type: 'String', index: true, required: true},
    time: {type: 'Number', index: true, required: true},
    requestType: {type: 'String', index: true},
    search: {type: 'String', default: null},
    format: {type: 'String', default: 'json', required: false},
    targetId: {type: 'ObjectId', default: null},
    targetPage: {type: 'Number', default: null},
    targetFormat: {type: 'String', default: null}
  })

  let collectionSchema = new mongoose.Schema({
    creationTime: {type: 'Number', index: true, required: true},
    ownerModifyTime: {type: 'Number', index: true, required: true},
    content: {type: 'Object', required: false, default: {}},
    owner: {type: 'ObjectId', index: true, required: true},
    publicRead: {type: 'Boolean', index: true, required: false, default: true},
    allowedRead: {type: ['ObjectId'], required: false, default: []},
    allowedWrite: {type: ['ObjectId'], required: false, default: []}
  })

  let idSchema = new mongoose.Schema({
    creationTime: {type: 'Number', index: true, required: true},
    username: {type: 'String', required: true}
  })
  idSchema.index({username: 1}, {unique: true})

  let sessionGranterSchema = new mongoose.Schema({
    userId: {type: 'ObjectId', required: true, index: true},
    type: {type: 'String', required: true}, // scrypt or fido2
    challenge: {type: 'Buffer', required: false}, // for scrypt
    fido2: {
      type: {
        pubKey: 'String',
        credId: 'Buffer',
        signCount: 'Number'
      }, required: false
    }
  })

  let fidoChallengeSchema = new mongoose.Schema({
    challenge: {type: 'Buffer', required: true, index: true},
    time: {type: 'Number', required: true} // generation timestamp.
  })

  sessionGranterSchema.static('verify', function (userId, challengeResponse) {
    return new Promise((resolve, reject) => {
      if (challengeResponse.type) challengeResponse.type = challengeResponse.type.toString()
      if (challengeResponse.type === 'password') {
        let { password } = challengeResponse
        if (typeof password !== 'string' || password.length === 0) {
          reject(new Error('Invalid password.'))
          return
        }
        PastPaperSessionGranter.find({userId, type: 'scrypt'})
          .then(granters => {
            if (granters.length > 10) {
              granters = granters.slice(-10) // Avoid DoS attack
            }
            return Promise.all(granters.map(g => scrypt.verifyKdf(g.challenge, password))).then(arr => Promise.resolve(arr.filter(x => x).length > 0))
          })
          .then(pass => {
            if (!pass) return Promise.reject(new Error('Password incorrect.'))
            resolve()
          }).catch(err => reject(err))
      } else if (challengeResponse.type == 'fido2') {
        (async function () {
          let clientDataJson = challengeResponse.clientDataJSON
          if (typeof clientDataJson !== 'string') throw new Error(`clientDataJSON should be a string.`)
          let clientData = null
          try {
            clientData = JSON.parse(clientDataJson)
          } catch (e) {
            throw new Error(`Error parsing clientDataJSON: ${e.message}`)
          }
          let signingChallenge = Buffer.from(clientData.challenge.replace(/-/g, "+").replace(/_/g, "/"), 'base64')
          await PastPaperFidoChallenge.verify(signingChallenge)
          let granter = await PastPaperSessionGranter.findOne({userId, type: 'fido2'})
          if (!granter) throw new Error('No registered fido2 keys for this user.')
          if (typeof challengeResponse.authenticatorData !== 'string' || typeof challengeResponse.signature !== 'string' || typeof challengeResponse.userHandle !== 'string') {
            throw new Error('Invalid challengeResponse.')
          }
          let authenticatorData = Buffer.from(challengeResponse.authenticatorData, 'base64')
          let signature = Buffer.from(challengeResponse.signature, 'base64')
          let userHandle = Buffer.from(challengeResponse.userHandle, 'base64')
          let aResult = await f2l.assertionResult({
            rawId: bufferToArrayBuffer(granter.fido2.credId.buffer), // granter.fido2.credId.buffer is the real Buffer.
            response: {
              clientDataJSON: bufferToArrayBuffer(Buffer.from(clientDataJson, 'utf8')),
              authenticatorData: bufferToArrayBuffer(authenticatorData),
              signature: bufferToArrayBuffer(signature),
              userHandle: undefined
            }
          }, {
            challenge: clientData.challenge, // verified before.
            origin: SITE_ORIGIN,
            factor: 'either',
            publicKey: granter.fido2.pubKey,
            prevCounter: granter.fido2.signCount,
            userHandle: null
          })
          let newCounter = aResult.authnrData.get('counter')
          granter.fido2.signCount = newCounter
          await granter.save()
        })().then(resolve, reject)
      } else {
        reject(new Error('Unknow challenge ' + challengeResponse.type))
      }
    })
  })

  fidoChallengeSchema.static('generate', function () {
    return new Promise((resolve, reject) => {
      let ch = new PastPaperFidoChallenge({
        challenge: Buffer.allocUnsafe(64),
        time: Date.now()
      })
      crypto.randomFill(ch.challenge, (err, buf) => {
        if (err) {
          return void reject(err)
        }
        ch.challenge = buf
        ch.save().then(() => {
          resolve(ch.challenge)
        }, reject)
      })
    })
  })

  fidoChallengeSchema.static('verify', function (challenge) {
    if (!Buffer.isBuffer(challenge)) return Promise.reject(new TypeError())
    return PastPaperFidoChallenge.findOne({challenge}).then(ch => {
      if (!ch) {
        return Promise.reject(new Error("Challenge not found."))
      }
      if (ch.time < Date.now() - 5 * 60 * 1000) {
        ch.remove()
        return Promise.reject(new Error("Challenge expired."))
      }
      ch.remove()
      return Promise.resolve()
    })
  })

  function bufferToArrayBuffer(buf) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)
  }

  idSchema.method('granterReplace', function (challenge) {
    return new Promise((resolve, reject) => {
      let userId = this._id
      if (challenge.type) challenge.type = challenge.type.toString()
      if (challenge.type === 'password') {
        PastPaperSessionGranter.remove({userId, type: 'scrypt'})
          .then(() => {
            let { password } = challenge
            if (typeof password !== 'string' || password.length === 0) {
              return Promise.reject(new Error('password invalid.'))
            }
            return scrypt.kdf(password, scryptParam)
          })
          .then(kdf => {
            let sg = new PastPaperSessionGranter({
              userId,
              type: 'scrypt',
              challenge: kdf
            })
            return sg.save()
          })
          .then(resolve, reject)
      } else if (challenge.type === 'fido2') {
        PastPaperSessionGranter.remove({userId, type: 'fido2'})
          .then(async function () {
            let { clientDataJson } = challenge
            if (typeof clientDataJson !== 'string') {
              throw new Error('Expected challenge.clientDataJson to be a string.')
            }
            let clientData = null
            try {
              clientData = JSON.parse(clientDataJson)
            } catch (e) {
              throw new Error(`Error parsing clientDataJson: ${e.message}`)
            }
            if (clientData.type !== 'webauthn.create' ||
                typeof clientData.challenge !== 'string' ||
                clientData.origin !== SITE_ORIGIN) throw new Error('Invalid clientData.')
            let signChallenge = null
            signChallenge = Buffer.from(clientData.challenge.replace(/-/g, "+").replace(/_/g, "/"), 'base64')
            await PastPaperFidoChallenge.verify(signChallenge)
            if (typeof challenge.credId !== 'string') throw new Error('Expected challenge.credId to be a string.')
            let credId = Buffer.from(challenge.credId, 'base64')
            if (typeof challenge.attestationObject !== 'string') throw new Error('Expected challenge.attestationObject to be a string.')
            let attestationObject = Buffer.from(challenge.attestationObject, 'base64')
            let aResult = await f2l.attestationResult({
              rawId: bufferToArrayBuffer(credId),
              response: {
                clientDataJSON: bufferToArrayBuffer(Buffer.from(clientDataJson, 'utf8')),
                attestationObject: bufferToArrayBuffer(attestationObject),
              }
            }, {
              challenge: clientData.challenge, // verified before.
              origin: SITE_ORIGIN,
              factor: 'either'
            })
            let authnrData = aResult.authnrData
            let sg = new PastPaperSessionGranter({
              userId,
              type: 'fido2',
              fido2: {
                pubKey: authnrData.get('credentialPublicKeyPem'),
                credId,
                signCount: authnrData.get('counter')
              }
            })
            await sg.save()
          }).then(resolve, reject)
      } else {
        reject(new Error('Unsupported challenge type ' + challenge.type))
      }
    })
  })

  let authSessionSchema = new mongoose.Schema({
    authToken: {type: 'Buffer', required: true}, // A 16 byte token that needs to be sent to the server with every private API request.
    userId: {type: 'ObjectId', required: true, index: true},
    loginIp: {type: 'String', required: true},
    loginTime: {type: 'Number', required: true},
    valid: {type: 'Boolean', required: false, default: true}
  })
  authSessionSchema.index({authToken: 1}, {unique: true})
  authSessionSchema.static('newSession', function (userId, ip, token = null) {
    return new Promise((resolve, reject) => {
      new Promise((resolve, reject) => {
        if (token) {
          if (Buffer.isBuffer(token) && token.length === 16) {
            resolve(token)
          } else {
            reject(new Error('provided token is invalid.'))
          }
        } else {
          crypto.randomBytes(16, function (err, tok) {
            if (err) {
              reject(err)
            } else {
              resolve(tok)
            }
          })
        }
      }).then(token => {
        let session = new PastPaperAuthSession({
          authToken: token,
          userId,
          loginIp: ip,
          loginTime: Date.now(),
          valid: true
        })
        session.save().then(() => {
          resolve(token)
        }, reject)
      }, err => reject(err))
    })
  })

  let PastPaperIndex
  let PastPaperDoc
  let PastPaperPaperBlob
  let PastPaperFeedback
  let PastPaperRequestRecord
  let PastPaperCollection
  let PastPaperId
  let PastPaperFidoChallenge

  function registerDBModel (name, schema) {
    let model
    try {
      model = db.model(name, schema)
    } catch (e) {
      model = db.model(name)
    }
    if (!model) throw new Error(`model of ${name} undefined.`)
    model.on('index', err => {
      if (err) {
        console.error(`Error building index for ${name}: `)
        console.error(err)
      } else {
        console.log(`Building index for ${name}.`)
      }
    })
    return model
  }
  PastPaperIndex = registerDBModel('pastPaperIndex', indexSchema)
  PastPaperDoc = registerDBModel('pastPaperDoc', docSchema)
  PastPaperPaperBlob = registerDBModel('pastPaperPaperBlob', paperBlobSchema)
  PastPaperFeedback = registerDBModel('pastPaperFeedback', feedbackSchema)
  PastPaperRequestRecord = registerDBModel('pastPaperRequestRecord', requestRecordSchema)
  PastPaperCollection = registerDBModel('pastPaperCollection', collectionSchema)
  PastPaperId = registerDBModel('pastPaperId', idSchema)
  PastPaperAuthSession = registerDBModel('pastPaperAuthSession', authSessionSchema)
  PastPaperSessionGranter = registerDBModel('pastPaperSessionGranter', sessionGranterSchema)
  PastPaperFidoChallenge = registerDBModel('pastPaperFidoChallenge', fidoChallengeSchema)
  return Promise.all(awaiting).then(() => Promise.resolve({PastPaperDoc, PastPaperIndex, PastPaperPaperBlob, PastPaperFeedback, PastPaperRequestRecord, PastPaperCollection, PastPaperId, PastPaperAuthSession, PastPaperSessionGranter, PastPaperFidoChallenge}))
}
