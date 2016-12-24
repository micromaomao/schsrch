module.exports = (db, mongoose) => {
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true},
    time: {type: 'String', index: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true},
    variant: {type: 'Number', index: true},
    doc: {type: Buffer},
    fileType: {type: 'String', default: 'pdf'},
    numPages: 'Number'
  })
  let indexSchema = new mongoose.Schema({
    doc: 'ObjectId',
    page: 'Number', // starts from 0
    content: 'String'
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
  indexSchema.static('search', query => new Promise((resolve, reject) => {
    query = query.replace(/["'\+\-]/g, '')
    PastPaperIndex.find({$text: {$search: query}}, {score: {$meta: 'textScore'}}).sort({score: {$meta: 'textScore'}}).limit(30).exec((err, res) => {
      if (err) {
        reject(err)
        return
      }
      Promise.all(res.map(rs => new Promise((resolve, reject) => {
        PastPaperDoc.findOne({_id: rs.doc}, {doc: false}, (err, doc) => {
          if (err) {
            reject(err)
          } else if (!doc) {
            resolve(null)
          } else {
            rs.content = rs.content.replace(/\.{3,}/g, '...').replace(/\s{1,}/g, ' ')
            resolve({index: rs, doc: doc})
          }
        })
      }))).then(rst => resolve(rst.filter(a => a !== null)), reject)
    })
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
  return {PastPaperDoc, PastPaperIndex, PastPaperFeedback}
}
