const mongoose = require('mongoose')
const db = mongoose.createConnection('mongodb://127.0.0.1/schsrch', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
})
db.on('open', async () => {
  const count = await db.collection('pastpaperdocs').countDocuments()
  console.log(`Docs count in schsrch: ${count}`)
  process.exit(0)
})
