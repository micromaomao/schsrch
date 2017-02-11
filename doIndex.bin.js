#!/usr/bin/env node
const { MONGODB: DB, QUICK } = process.env
let noCacheSSPDF = QUICK === '1'

const mongoose = require('mongoose')
mongoose.Promise = global.Promise
let db = mongoose.createConnection(DB)

const fs = require('fs')
const path = require('path')
const PaperUtils = require('./view/paperutils.js')
const sspdf = require('./lib/sspdf.js')

let raceLock = {}

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

      let doc = new PastPaperDoc({
        doc: data,
        // Will add numPages later.
        fileType: 'pdf'
      })
      let loadPage = (pIndex, returnNumPages = false) => new Promise((resolve, reject) => {
        new Promise((resolve, reject) => {
          sspdf.getPage(data, pIndex, function (err, pageData) {
            if (err) return reject(err)
            resolve(pageData)
          })
        }).then(pageData => {
          function ok (sspdfCache) {
            let idx = new PastPaperIndex({
              doc: doc._id,
              page: pIndex,
              content: pageData.text,
              sspdfCache
            })
            resolve(returnNumPages ? [idx, pageData.pageNum] : idx)
          }
          if (noCacheSSPDF) {
            ok(null)
          } else {
            sspdf.preCache(pageData, sspdfCache => {
              ok(sspdfCache)
            })
          }
        }).catch(reject)
      })
      loadPage(0, true).then(([idx0, numPages]) => {
        doc.set('numPages', numPages)
        let pagePromises = [Promise.resolve(idx0)]
        for (let pn = 1; pn < numPages; pn++) {
          pagePromises.push(loadPage(pn))
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
              // Detect paper "identity" (metadata) based on the first page.
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
          let setStr = PaperUtils.setToString(mt)
          if (raceLock[setStr] && raceLock[setStr][mt.type]) {
            resolve()
            return
          } else {
            let lt = raceLock[setStr] || (raceLock[setStr] = {})
            lt[mt.type] = true
          }
          let removeDoc = doc => PastPaperIndex.remove({doc: doc._id}).exec().then(() => doc.remove())
          Promise.all(idxes.map(idx => idx.save())).then(() => PastPaperDoc.find(mt, {_id: true}).exec())
            .then(docs => Promise.all(docs.map(doc => removeDoc(doc)))).then(() => doc.save(), reject).then(resolve, err => reject(new Error("Can't save document: " + err)))
        })).then(resolve, reject)
      }, err => {
        reject(err)
      })
    })
  })

  let queue = process.argv.slice(2)
  let total = () => queue.length + done
  let left = () => queue.length
  let done = 0
  let failure = 0
  let ended = false
  let processing = 0
  let lastShowProgress = Date.now()
  function end () {
    ended = true
    process.stderr.write(`\nDone. ${total() - failure} documents indexed. ( ${failure} failed. )\n`)
    process.exit(0)
  }
  function thread (n) {
    if (left() <= 0) {
      if (processing === 0) {
        ended || end()
      } else {
        setTimeout(() => thread(n), 100)
      }
      return
    }
    if (Date.now() - lastShowProgress >= 100) {
      process.stderr.write(`[${n}] ${total() - left()}/${total()}, ${Math.round((1 - (left() / total())) * 1000) / 10}% finish...         \r`)
      lastShowProgress = Date.now()
    }
    let doneThis = () => {
      done++
      processing --
      thread(n)
    }
    let task = queue.pop()
    processing ++
    new Promise((resolve, reject) => {
      console.log(task)
      fs.stat(task, (err, stats) => {
        if (err) {
          reject(err)
        } else if (stats.isDirectory()) {
          fs.readdir(task, (err, files) => {
            if (err) {
              reject(err)
            } else {
              Array.prototype.push.apply(queue, files.map(f => path.join(task, f)))
              resolve(false)
            }
          })
        } else {
          resolve(true)
        }
      })
    }).then(doit => doit ? indexPdf(task) : Promise.resolve(false)).then(() => {
      doneThis()
    }, err => {
      failure++
      process.stdout.write('\n' + task + '\n')
      process.stderr.write('  -- Ignoring: ' + err.message + '\n')
      doneThis()
    })
  }

  // for(let i = 0; i < 3; i ++) {
  //   thread(i)
  // }
  thread(0)
})
