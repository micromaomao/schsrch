const mongoose = require('mongoose')
const elasticsearch = require('elasticsearch')
const db = mongoose.createConnection('mongodb://127.0.0.1/schsrch', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
})
const es = new elasticsearch.Client({ host: '127.0.0.1:9200' })
require('./lib/dbModel.js')(db, es).then(models => {
  models.PastPaperIndex.search("glycolsys").then(results => {
    console.log("Fuzzy Search for 'glycolsys':")
    results.slice(0, 3).forEach(r => {
      console.log(`- ${r.doc.subject} ${r.doc.paper} page ${r.doc.page}: _score=${r._score}`)
    })
    process.exit(0)
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
})
