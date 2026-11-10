const mongoose = require('mongoose');

const DB_URI = process.env.MONGODB || 'mongodb://127.0.0.1/schsrch';

async function count() {
  const db = mongoose.createConnection(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
  });
  
  db.on('open', async () => {
    const { PastPaperDoc } = await require('./lib/dbModel.js')(db, null);
    const total = await PastPaperDoc.countDocuments({});
    const withRel = await PastPaperDoc.countDocuments({ relativePath: { $exists: true } });
    console.log('Total Docs:', total);
    console.log('Docs with relativePath:', withRel);
    process.exit(0);
  });
}
count();
