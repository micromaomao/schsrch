const mongoose = require('mongoose')
mongoose.Promise = global.Promise

module.exports = db => {
  let docSchema = new mongoose.Schema({
    subject: {type: 'String', index: true},
    time: {type: 'String', index: true}, // Eg. s12, w15, y16 (i.e. for speciman paper)
    type: {type: 'String', index: true}, // Eg. qp, ms, sp, sm etc.
    paper: {type: 'Number', index: true},
    variant: {type: 'Number', index: true},
    doc: 'Buffer',
    fileType: {type: 'String', default: 'pdf'},
    numPages: 'Number'
  })
  let indexSchema = new mongoose.Schema({
    doc: 'ObjectId',
    page: 'Number', // starts from 0
    content: 'String'
  })
  let PastPaperIndex
  let PastPaperDoc
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
  return {PastPaperDoc, PastPaperIndex}
}
