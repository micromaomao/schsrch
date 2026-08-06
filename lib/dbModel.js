/* eslint-disable prefer-const, object-curly-spacing, space-unary-ops, quote-props, quotes, object-shorthand, comma-dangle, object-curly-newline, object-property-newline */
const sspdf = require('./sspdf.js')
const Recognizer = require('./recognizer.js')
const mongoose = require.main.require('mongoose')
const storage = require('../storage/index.js')
module.exports = (db, es) => {
  let awaiting = []
  // A doc document dosen't necessarily need to be PDF! It can, for example, be mp3 in the case of listening files, or be zip in the case of CS source files.
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true, required: true},
    time: {type: 'String', index: true, required: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true, required: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true, required: false, default: 0},
    variant: {type: 'Number', index: true, required: false, default: 0},
    fileType: {type: 'String', default: 'pdf', required: true},
    numPages: {type: 'Number', required: false, default: null}, // For fileType !== 'pdf', null.
    dir: {type: 'Object', default: {}, required: false},
    gs_optimized: {type: 'Boolean', default: false, required: false, index: true},
    fileHash: {type: 'String', required: false, index: true},
    relativePath: {type: 'String', required: false}
  })

  docSchema.set('toJSON', { virtuals: true })
  docSchema.set('toObject', { virtuals: true })
  docSchema.virtual('fileUrl').get(function () {
    if (this.relativePath) {
      return '/papers/' + this.relativePath
    }
    return null
  })

  docSchema.index({subject: 1, time: 1, paper: 1, variant: 1})
  docSchema.index({subject: 1, type: 1})

  docSchema.method('ensureDir', async function () {
    if (this.fileType !== 'pdf') {
      return {
        type: 'blob',
        fileType: this.fileType
      }
    }

    const postProcess = async (dir) => {
      // Add docid to er dir pv entries.
      if (this.type !== 'er' || dir.type !== 'er' || dir.papers.length === 0) return dir
      let qps = await PastPaperDoc.find({subject: this.subject, time: this.time, type: 'qp'}, {dir: false})
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
    let blob = await storage.read(this.relativePath)
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
    return PastPaperDoc.findOne({_id: this.docId}).then(gotDocs)
  })

  /**
   * Executes a full-text search against the Elasticsearch 'pastpaper' index using fuzzy string matching.
   * Leverages multi-match metadata boosting (subject, paper) and phrase match boosting to prioritize relevance.
   *
   * @param {string} query - The search query term.
   * @param {Object} [filters] - Filters for metadata (subject, time, paper, variant, type) to narrow down the query.
   * @param {string} [sort] - The sorting algorithm requested (relevance, oldest, session).
   * @returns {Promise<Array<Object>>} Resolves with an array of {doc, index} hits ranked by _score.
   */
  indexSchema.static('search', function (query, filters, sort) {
    let getFuzzyQuery = q => ({
      bool: {
        must: {
          match: {
            content: { 
              query: q, 
              fuzziness: 'AUTO:4,7'
            }
          }
        },
        should: [
          {
            match: {
              content: { 
                query: q, 
                boost: 2 
              }
            }
          },
          {
            match_phrase: {
              content: {
                query: q,
                boost: 4
              }
            }
          },
          {
            multi_match: {
              query: q,
              fields: ['subject^3', 'paper^3'],
              type: 'best_fields'
            }
          }
        ]
      }
    })

    let dslQuery
    let queryPerfixMatch = query.trim().match(/^(\d{4})\s+(.+)$/)
    if (!queryPerfixMatch) {
      dslQuery = getFuzzyQuery(query)
    } else {
      let subject = queryPerfixMatch[1]
      let remainingQuery = queryPerfixMatch[2]
      let queryPaperMatch = remainingQuery.trim().match(/^pa?p?e?r?\s*(\d)\s+(.+)$/)
      if (queryPaperMatch) {
        dslQuery = {
          bool: {
            must: [
              getFuzzyQuery(queryPaperMatch[2]),
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
              getFuzzyQuery(remainingQuery),
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

    // Apply explicit subject filter to ES query if provided
    if (filters && filters.subject) {
      dslQuery = {
        bool: {
          must: [
            dslQuery,
            { terms: { subject: Array.isArray(filters.subject) ? filters.subject : [filters.subject] } }
          ]
        }
      }
    }
    if (filters && filters.paper) {
      dslQuery = {
        bool: {
          must: [
            dslQuery,
            { terms: { paper: Array.isArray(filters.paper) ? filters.paper.map(p => p.toString()) : [filters.paper.toString()] } }
          ]
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

      let docIds = res.hits.hits.map(hit => hit._source.docId)
      let mongoFinder = {_id: {$in: docIds}}
      if (filters) {
        if (filters.subject) mongoFinder.subject = filters.subject
        if (filters.time) mongoFinder.time = filters.time
        if (filters.paper) mongoFinder.paper = parseInt(filters.paper)
        if (filters.variant) mongoFinder.variant = parseInt(filters.variant)
        if (filters.type) {
          mongoFinder.type = filters.type
        } else {
          mongoFinder.type = { $nin: ['er', 'gt'] }
        }
      } else {
        mongoFinder.type = { $nin: ['er', 'gt'] }
      }
      return PastPaperDoc.find(mongoFinder, {dir: false}).then(docs => {
        let docsMap = {}
        for (let doc of docs) {
          docsMap[doc._id.toString()] = doc
        }

        let result = res.hits.hits.map(hit => {
          let doc = docsMap[hit._source.docId.toString()]
          if (!doc) return null
          return {
            doc: doc,
            index: {
              _id: hit._id,
              content: hit._source.content,
              page: hit._source.page,
              docId: hit._source.docId,
              score: hit._score
            }
          }
        }).filter(x => x !== null)

        if (sort === 'newest') {
          result.sort((a, b) => b.doc.time.localeCompare(a.doc.time))
        } else if (sort === 'oldest') {
          result.sort((a, b) => a.doc.time.localeCompare(b.doc.time))
        } else if (sort === 'subject') {
          result.sort((a, b) => a.doc.subject.localeCompare(b.doc.subject))
        } else if (sort === 'session') {
          result.sort((a, b) => b.doc.time.localeCompare(a.doc.time))
        }

        return Promise.resolve(result)
      })
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
  PastPaperFeedback = registerDBModel('pastPaperFeedback', feedbackSchema)
  return Promise.all(awaiting).then(() => Promise.resolve({PastPaperDoc, PastPaperIndex, PastPaperFeedback}))
}
