const sspdf = require('./sspdf.js')
const Recognizer = require('./recognizer.js')
const mongoose = require.main.require('mongoose')

module.exports = (db, es) => {
  let awaiting = []
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true, required: true},
    time: {type: 'String', index: true, required: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true, required: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true, required: true},
    variant: {type: 'Number', index: true, required: true},
    fileBlob: {type: Buffer, required: true},
    fileType: {type: 'String', default: 'pdf', required: true},
    numPages: {type: 'Number', required: true},
    dir: {type: 'Object', default: {}, required: false}
  })
  let indexSchema = new mongoose.Schema({
    docId: {type: 'ObjectId', required: true},
    content: {type: 'String', required: true, index: false},
    page: {type: 'Number', required: true},
    sspdfCache: {type: 'Object', default: null}
  })
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
  let PastPaperIndex
  let PastPaperDoc
  let PastPaperFeedback
  let PastPaperRequestRecord
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
  docSchema.index({subject: true, time: true, paper: true, variant: true})
  indexSchema.index({docId: true, page: true})
  try {
    PastPaperIndex = db.model('pastPaperIndex', indexSchema)
  } catch (e) {
    PastPaperIndex = db.model('pastPaperIndex')
  }
  try {
    PastPaperDoc = db.model('pastPaperDoc', docSchema)
  } catch (e) {
    PastPaperDoc = db.model('pastPaperDoc')
  }
  try {
    PastPaperFeedback = db.model('pastPaperFeedback', feedbackSchema)
  } catch (e) {
    PastPaperFeedback = db.model('pastPaperFeedback')
  }
  try {
    PastPaperRequestRecord = db.model('pastPaperRequestRecord', requestRecordSchema)
  } catch (e) {
    PastPaperRequestRecord = db.model('pastPaperRequestRecord')
  }
  return Promise.all(awaiting).then(() => Promise.resolve({PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord}))
}
