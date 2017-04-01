module.exports = (db, mongoose) => {
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true, required: true},
    time: {type: 'String', index: true, required: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true, required: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true, required: true},
    variant: {type: 'Number', index: true, required: true},
    doc: {type: Buffer, required: true},
    fileType: {type: 'String', default: 'pdf', required: true},
    numPages: {type: 'Number', required: true},
    dir: {type: [new mongoose.Schema({
      qN: {type: 'Number', required: true},
      page: {type: 'Number', required: true},
      qT: {type: 'String', required: false}
    })], default: [], required: false}
  })
  let indexSchema = new mongoose.Schema({
    doc: {type: 'ObjectId', required: true},
    page: {type: 'Number', required: true}, // starts from 0
    content: {type: 'String', required: true},
    sspdfCache: {type: 'Object', default: null}
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
    targetPage: {type: 'Number', default: null}
  })
  let PastPaperIndex
  let PastPaperDoc
  let PastPaperFeedback
  let PastPaperRequestRecord
  indexSchema.static('search', query => new Promise((resolve, reject) => {
    query = query.replace(/["'\+\-]/g, '')
    let aggreArray
    let queryPerfixMatch = query.match(/^(\d{4})\s+(.+)$/)
    if (queryPerfixMatch) {
      aggreArray = [{$match: {$text: {$search: queryPerfixMatch[2]}}}]
    } else {
      aggreArray = [{$match: {$text: {$search: query}}}]
    }
    aggreArray.push({$addFields: {sspdfCache: null}})
    aggreArray.push({$sort: {mgScore: {$meta: 'textScore'}}})
    aggreArray.push({$limit: queryPerfixMatch ? 50 : 30})
    aggreArray.push({$lookup: {from: 'pastpaperdocs', localField: 'doc', foreignField: '_id', as: 'doc'}})
    aggreArray.push({$addFields: {tDoc: {$arrayElemAt: ['$doc', 0]}}})
    aggreArray.push({$project: {doc: false, 'tDoc.doc': false}})
    if (queryPerfixMatch) {
      aggreArray.push({$match: {'tDoc.subject': queryPerfixMatch[1]}})
      aggreArray.push({$limit: 15})
    }
    PastPaperIndex.aggregate(aggreArray).allowDiskUse(true).then(res => {
      resolve(res.map(mgDoc => (mgDoc.tDoc ? {
        doc: mgDoc.tDoc,
        index: {
          _id: mgDoc._id,
          content: mgDoc.content,
          page: mgDoc.page,
          doc: mgDoc.tDoc._id
        }
      } : null)).filter(x => x !== null))
    }, reject)
  }))
  indexSchema.index({content: 'text'})
  docSchema.index({subject: true, time: true, paper: true, variant: true})
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
  return {PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord}
}
