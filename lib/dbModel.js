const sspdf = require('./sspdf.js')
const Recognizer = require('./recognizer.js')
const mongoose = require.main.require('mongoose')
const crypto = require('crypto')
const scrypt = require('scrypt')

const scryptParam = scrypt.paramsSync(0.05)

module.exports = (db, es) => {
  let awaiting = []
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true, required: true},
    time: {type: 'String', index: true, required: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true, required: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true, required: true},
    variant: {type: 'Number', index: true, required: true},
    fileBlob: {type: 'Buffer', required: true},
    fileType: {type: 'String', default: 'pdf', required: true},
    numPages: {type: 'Number', required: true},
    dir: {type: 'Object', default: {}, required: false}
  })
  docSchema.index({subject: 1, time: 1, paper: 1, variant: 1})

  docSchema.method('ensureDir', function () {
    if (!this.fileBlob) throw new Error('this.fileBlob must present.')
    return new Promise((resolve, reject) => {
      if (this.dir && this.dir.dirs && this.dir.dirs.length > 0) return resolve(this.dir)
      PastPaperIndex.find({docId: this._id}).sort({page: 1}).exec().then(idxes => {
        return Promise.all(idxes.map(idx =>
          new Promise((resolve, reject) => {
            sspdf.getPage(this.fileBlob, idx.page, function (err, pageData) {
              if (err) return reject(err)
              resolve(pageData)
            })
          }).then(pageData => Promise.resolve(Object.assign(idx, {
            rects: pageData.rects,
            content: pageData.text
          })))
        )).then(idxes => {
          this.set('dir', Recognizer.dir(idxes))
          return Promise.resolve(this)
        }).then(nDoc => nDoc.save().then(() => Promise.resolve(nDoc.dir)))
      }).then(resolve, reject)
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
    if (err.body && err.body.error && err.body.error.type === 'index_already_exists_exception') return Promise.resolve()
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
        size: 40
      }
    }).then(res => {
      if (!res.hits || !res.hits.hits || res.hits.hits.length === 0) {
        return Promise.resolve([])
      }
      return Promise.all(res.hits.hits.map(hit => PastPaperDoc.find({_id: hit._source.docId}, {fileBlob: false}).then(doc => Promise.resolve({
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

  idSchema.method('granterReplace', function (challenge) {
    return new Promise((resolve, reject) => {
      let userId = this._id
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
          .then(() => {
            resolve()
          })
          .catch(err => reject(err))
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

  let sessionGranterSchema = new mongoose.Schema({
    userId: {type: 'ObjectId', required: true, index: true},
    type: {type: 'String', required: true}, // scrypt, google-authenticator, google-oauth, twitter-oauth, etc.
    challenge: {type: 'Buffer', required: true}
  })

  sessionGranterSchema.static('verify', function (userId, challengeResponse) {
    return new Promise((resolve, reject) => {
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
            if (!pass) return Promise.reject(new Error('password incorrect.'))
            return Promise.resolve()
          }).catch(err => reject(err))
      } else {
        reject(new Error('Unknow challenge ' + challengeResponse.type))
      }
    })
  })

  let PastPaperIndex
  let PastPaperDoc
  let PastPaperFeedback
  let PastPaperRequestRecord
  let PastPaperCollection
  let PastPaperId

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
  PastPaperFeedback = registerDBModel('pastPaperFeedback', feedbackSchema)
  PastPaperRequestRecord = registerDBModel('pastPaperRequestRecord', requestRecordSchema)
  PastPaperCollection = registerDBModel('pastPaperCollection', collectionSchema)
  PastPaperId = registerDBModel('pastPaperId', idSchema)
  PastPaperAuthSession = registerDBModel('pastPaperAuthSession', authSessionSchema)
  PastPaperSessionGranter = registerDBModel('pastPaperSessionGranter', sessionGranterSchema)
  return Promise.all(awaiting).then(() => Promise.resolve({PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord, PastPaperCollection, PastPaperId, PastPaperAuthSession, PastPaperSessionGranter}))
}
