const sspdf = require('./sspdf.js')
const Recognizer = require('./recognizer.js')
const mongoose = require.main.require('mongoose')

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

  let PastPaperIndex
  let PastPaperDoc
  let PastPaperPaperBlob
  let PastPaperFeedback

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
  return Promise.all(awaiting).then(() => Promise.resolve({PastPaperDoc, PastPaperIndex, PastPaperPaperBlob, PastPaperFeedback}))
}
