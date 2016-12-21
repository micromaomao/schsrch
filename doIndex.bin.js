#!/usr/bin/env node
const DB = process.env.MONGODB

const mongoose = require('mongoose')
mongoose.Promise = global.Promise
let db = mongoose.createConnection(DB)

const PDFJS = require('pdfjs-dist')
const fs = require('fs')

db.on('error', err => {
  console.error(err)
  process.exit(1)
})
db.on('open', () => {
  const {PastPaperIndex, PastPaperDoc} = require('./lib/dbModel.js')(db, mongoose)

  const indexPdf = path => new Promise((resolve, reject) => {
    const fname = path.split('/').slice(-1)[0]
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err)
        return
      }

      let pagePromises = []

      PDFJS.getDocument(new Uint8Array(data)).then(pdfDoc => new Promise((resolve, reject) => {
        let doc = new PastPaperDoc({
          doc: data,
          numPages: pdfDoc.numPages,
          fileType: 'pdf'
        })
        let loadPage = page => new Promise((resolve, reject) => {
          let pIndex = page.pageIndex
          page.getTextContent().then(ct => {
            let textContent = ct.items.map(x => x.str).join('\n\n')
            let idx = new PastPaperIndex({
              doc: doc._id,
              page: pIndex,
              content: textContent
            })
            resolve(idx)
          }).catch(reject)
        })
        for (let pn = 1; pn <= pdfDoc.numPages; pn++) {
          pagePromises.push(pdfDoc.getPage(pn).then(page => loadPage(page)))
        }
        Promise.all(pagePromises).then(idxes => new Promise((resolve, reject) => {
          let subject
          let time
          let type
          let paper
          let variant = 0
          let specimen = false
          try {
            let nameMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-z]+)_(\d{1,2})\.pdf$/)
            let nameErMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-z]+)\.pdf$/)
            if (!nameMat && !nameErMat) {
              // Detect paper "identity" (metadata) by its first page.
              if (idxes.length === 0) {
                throw new Error("No page => can't identify paper")
              }
              let coverPage = idxes[0].content.split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim())
              let idtStr = coverPage.filter(a => /^\d{4}\/\d{2}$/.test(a))
              if (idtStr.length === 1) {
                let spt = idtStr[0].split('/')
                subject = spt[0]
                if (spt[1][0] === '0') {
                  paper = parseInt(spt[1][1])
                } else {
                  paper = parseInt(spt[1][0])
                  variant = parseInt(spt[1][1])
                }
              } else if (idtStr.length === 0) {
                throw new Error("No xxxx/xx in first page => can't identify paper.")
              } else {
                throw new Error('Compound.')
              }
              let timeStr = coverPage.map(a => {
                let mt
                if ((mt = a.match(/(\S+ \S+) series/))) {
                  return mt[1]
                }
                return a
              }).filter(a => /^[A-Z][a-z]+\/ ?[A-Z][a-z]+ 20\d\d$/.test(a))
              if (timeStr.length > 1 && timeStr.filter(x => x !== timeStr[0]).length === 0) {
                timeStr = [timeStr[0]]
              }
              if (timeStr.length === 1) {
                let tsr = timeStr[0].split(' ')
                if (tsr.length === 3) {
                  tsr = [tsr[0] + tsr[1], tsr[2]]
                }
                let pTime
                switch (tsr[0]) {
                  case 'May/June':
                    pTime = 's'
                    break
                  case 'October/November':
                    pTime = 'w'
                    break
                  case 'February/March':
                    pTime = 'm'
                    break
                  default:
                    throw new Error(`Invalid pTime: ${tsr[0]}`)
                }
                let year = tsr[1].substr(2)
                time = pTime + year
              } else {
                let spTimeStr = coverPage.map(a => a.match(/^For Examination from 20(\d\d)/)).filter(a => Array.isArray(a)).map(a => a[1])
                if (spTimeStr.length === 1) {
                  time = 'y' + spTimeStr
                  specimen = true
                } else {
                  throw new Error("No Xxxx/Xxxx 20xx in first page => can't identify paper.")
                }
              }
              if (coverPage.find(a => /READ THESE INSTRUCTIONS FIRST/i.test(a))) {
                // FIXME: Identify insert
                if (!specimen) {
                  type = 'qp'
                } else {
                  type = 'sp'
                }
              } else if (coverPage.find(a => /MARK SCHEME/i.test(a))) {
                if (!specimen) {
                  type = 'ms'
                } else {
                  type = 'sm'
                }
              } else if (coverPage.find(a => /CONFIDENTIAL INSTRUCTIONS/i.test(a))) {
                if (!specimen) {
                  type = 'ir'
                } else {
                  type = 'sr'
                }
              } else {
                throw new Error('No type identifier in paper.')
              }
            } else if (nameMat) {
              // Detect identity its name
              let pv
              [, subject, time, type, pv] = nameMat
              paper = parseInt(pv[0])
              if (pv.length === 2) {
                variant = parseInt(pv[1])
              }
            } else if (nameErMat) {
              // xxxx_xxx_er/gt/... .pdf
              [, subject, time, type] = nameErMat
              paper = variant = 0
            }
          } catch (e) {
            reject(e)
            return
          }
          let mt = {
            subject,
            time,
            type,
            paper: parseInt(paper),
            variant: parseInt(variant)
          }
          Object.assign(doc, mt)
          let removeDoc = doc => PastPaperIndex.remove({doc: doc._id}).exec().then(() => doc.remove())
          Promise.all(idxes.map(idx => idx.save())).then(() => PastPaperDoc.find(mt, {_id: true}).exec())
            .then(docs => Promise.all(docs.map(doc => removeDoc(doc)))).then(() => doc.save()).then(resolve, reject)
        })).then(resolve, reject)
      })).then(resolve, reject)
    })
  })

  let queue = process.argv.slice(2)
  let total = queue.length
  let left = total
  let failure = 0
  let ended = false
  let lastShowProgress = Date.now()
  function end () {
    ended = true
    console.error(`Done. ${total - failure} documents indexed. ( ${failure} failed. )`)
    process.exit(0)
  }
  function thread (n) {
    if (left <= 0) {
      ended || end()
      return
    }
    if (queue.length === 0) {
      return
    }
    if (Date.now() - lastShowProgress >= 10000) {
      console.error(`[${n}] ${total - left}/${total}, ${Math.round((1 - (left / total)) * 1000) / 10}% finish...`)
      lastShowProgress = Date.now()
    }
    let doneThis = () => {
      left--
      thread(n)
    }
    let task = queue.pop()
    indexPdf(task).then(() => {
      doneThis()
    }, err => {
      failure++
      console.log(task)
      console.error('  -- Ignoring: ' + err.message)
      doneThis()
    })
  }

  // for(let i = 0; i < 5; i ++) {
  //   thread(i)
  // }
  thread(0)

  // Promise.all(process.argv.slice(2).map(path => indexPdf(path))).then(() => process.exit(0)).catch(err => {
  //   console.error(err)
  //   process.exit(1)
  // })
})
