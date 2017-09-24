#!/usr/bin/env node
const { MONGODB: DB, ES } = process.env
const mongoose = require('mongoose')
const PaperUtils = require('./view/paperutils')
const fs = require('fs')
const path = require('path')
const outputDir = process.cwd()
const elasticsearch = require('elasticsearch')
const sspdf = require('./lib/sspdf')
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
        if (parseInt(doc.time.substr(1)) < 10) {
          doDoc(i + 1)
          return
        }
        let setName = PaperUtils.setToString(doc)
        let fname = `${setName}_${doc.type}.pdf`
        fs.writeFileSync(path.join(outputDir, fname), doc.fileBlob, {encoding: null})
        process.stdout.write(`Extracted ${i + 1} out of ${docs.length} total. (${Math.round(((i + 1) / docs.length) * 1000) / 10}%)   \r`)
        if (doc.type !== 'qp' && doc.type !== 'sp') {
          doDoc(i + 1)
          return
        }
        let texBk = texStr
        texStr += `\\paper{${setName.replace(/_/g, ' ')}}\n`
        doc.ensureDir().then(dir => {
          if (!dir.dirs || dir.dirs.length === 0) {
            texStr += `\\error{${setName}}{Empty dir}\n`
            doDoc(i + 1)
            return
          }
          let qs = dir.dirs
          let qAdded = 0
          function doQi (qi) {
            if (qi >= qs.length) {
              if (qAdded === 0) {
                texStr = texBk
              }
              doDoc(i + 1)
              return
            }
            let q = qs[qi]
            if (q.qN > 20) return doQi(qi + 1)
            let seenBeforeQ = seenQuestions.get(q.qT.trim())
            if (seenBeforeQ) {
              texStr += `\\duplicateskipped{${q.qN}}{${q.qT.replace(/[^A-Za-z0-9\-\s]/g, '').split(/\s+/).slice(0, 5).join(' ')}\\ldots}{${seenBeforeQ}}\n`
              doQi(qi + 1)
              return
            }
            seenQuestions.set(q.qT, 'q' + totalQNumber)
            new Promise((resolve, reject) => {
              if (qi < qs.length - 1) {
                let nextQ = qs[qi + 1]
                if (nextQ.page === q.page) {
                  resolve(nextQ.qNRect.y1 - 16.56)
                } else {
                  findSfw()
                }
              } else {
                findSfw()
              }
              function findSfw () {
                sspdf.getPage(doc.fileBlob, q.page, function(err, ssResult) {
                  if (err) {
                    process.stderr.write(err.toString())
                    resolve(782.24)
                    return
                  }
                  let sfw = ssResult.text.lastIndexOf('Space for working')
                  if (sfw >= 0) {
                    resolve(ssResult.rects[sfw].y1 - 5)
                  } else {
                    process.stderr.write(`\nResorting to page bottom for ${fname}...\n`)
                    resolve(782.24)
                  }
                })
              }
            }).then(nextY1 => {
              texStr += `\\labelq{q${totalQNumber}}\\includegraphics[page=${q.page + 1},trim=1cm ${(pageHeightInternal - nextY1) * scale}cm 1cm ${q.qNRect.y1 * scale}cm,clip,width=\\textwidth]{${fname}}\n`
              totalQNumber ++
              qAdded ++
              doQi(qi + 1)
            })
          }
          doQi(0)
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
