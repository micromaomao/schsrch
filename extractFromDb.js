#!/usr/bin/env node
const { MONGODB: DB, ES } = process.env
const mongoose = require('mongoose')
const PaperUtils = require('./view/paperutils.js')
const fs = require('fs')
const path = require('path')
const outputDir = process.cwd()
const elasticsearch = require('elasticsearch')
mongoose.Promise = global.Promise
let db = mongoose.createConnection(DB)
let es = new elasticsearch.Client({
  host: ES
})

db.on('error', err => {
  console.error(err)
  process.exit(1)
})
db.on('open', () => {
  let texStr = ''
  const pageHeightInternal = 842
  const scale = 0.0352626749
  let seenQuestions = new Map()
  let totalQNumber = 0
  require('./lib/dbModel.js')(db, es).then(({PastPaperIndex, PastPaperDoc}) => {
    PastPaperDoc.find({subject: '9702', paper: 1, type: 'qp'}).then(docs => {
      docs.sort(PaperUtils.funcSortSet)
      function doDoc(i) {
        if (i >= docs.length) {
          process.stdout.write('\n')
          fs.writeFileSync(path.join(outputDir, 'struct.tex'), texStr, {encoding: 'utf8'})
          process.exit(0)
          return
        }
        let doc = docs[i]
        let setName = PaperUtils.setToString(doc)
        let fname = `${setName}_${doc.type}.pdf`
        fs.writeFileSync(path.join(outputDir, fname), doc.fileBlob, {encoding: null})
        process.stdout.write(`Extracted ${i + 1} out of ${docs.length} total. (${Math.round(((i + 1) / docs.length) * 1000) / 10}%)   \r`)
        if (doc.type !== 'qp' && doc.type !== 'sp') {
          doDoc(i + 1)
          return
        }
        texStr += `\\paper{${setName.replace(/_/g, ' ')}}\n`
        doc.ensureDir().then(dir => {
          if (!dir.dirs || dir.dirs.length === 0) {
            texStr += `\\error{${setName}}{Empty dir}\n`
            doDoc(i + 1)
            return
          }
          let qs = dir.dirs
          for (let qi = 0; qi < qs.length; qi ++) {
            let q = qs[qi]
            let seenBeforeQ = seenQuestions.get(q.qT.trim())
            if (seenBeforeQ) {
              texStr += `\\duplicateskipped{${q.qN}}{${q.qT.replace(/[^A-Za-z0-9\-\s]/g, '').split(/\s+/).slice(0, 5).join(' ')}\\ldots}{${seenBeforeQ}}\n`
              continue
            }
            seenQuestions.set(q.qT, 'q' + totalQNumber)
            let nextY1 = 782.24
            if (qi < qs.length - 1) {
              let nextQ = qs[qi + 1]
              if (nextQ.page === q.page) {
                nextY1 = nextQ.qNRect.y1 - 16.56
              }
            }
            texStr += `\\labelq{q${totalQNumber}}\\includegraphics[page=${q.page + 1},trim=1cm ${(pageHeightInternal - nextY1) * scale}cm 1cm ${q.qNRect.y1 * scale}cm,clip,width=\\textwidth]{${fname}}\n`
            totalQNumber ++
          }
          doDoc(i + 1)
        }, err => {
          texStr += `\\error{${setName}}{Can not generate dir}\n`
          doDoc(i + 1)
        })
      }
      doDoc(0)
    })
  }, err => {
    console.error(err)
    process.exit(1)
  })
})
