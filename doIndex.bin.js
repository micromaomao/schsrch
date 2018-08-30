#!/usr/bin/env node
const { MONGODB: DB, ES, QUICK, DEBUG } = process.env
let noCacheSSPDF = QUICK === '1'
let debug = DEBUG === '1'

const mongoose = require('mongoose')
mongoose.Promise = global.Promise
let db = mongoose.createConnection(DB)

const fs = require('fs')
const path = require('path')
const PaperUtils = require('./view/paperutils.js')
const sspdf = require('./lib/sspdf.js')
const sspdfLock = require('./lib/singlelock.js')()
const Recognizer = require('./lib/recognizer.js')
const elasticsearch = require('elasticsearch')

let raceLock = {}

db.on('error', err => {
  console.error(err)
  process.exit(1)
})
let es = new elasticsearch.Client({
  host: ES
})
db.on('open', () => {
  require('./lib/dbModel.js')(db, es).then(({PastPaperIndex, PastPaperDoc, PastPaperPaperBlob}) => {
    function storeData (data, doc) {
      let chunks = []
      let chunkLength = 10 * 1024 * 1024 // 10 MiB
      for (let cOffset = 0; cOffset < data.length; cOffset += chunkLength) {
        let slice = data.slice(cOffset, Math.min(data.length, cOffset + chunkLength))
        chunks.push(new PastPaperPaperBlob({
          docId: doc._id,
          offset: cOffset,
          data: slice
        }))
      }
      if (chunks.length > 1 && debug) {
        process.stderr.write(`${chunks.length} chunks for ${path} (${Math.round(data.length / 1024 / 1024 * 10) / 10} MiB)        \n`)
      }
      return Promise.all(chunks.map(c => c.save()))
    }
    function removeDoc (doc) {
      return PastPaperIndex.remove({docId: doc._id}).exec().then(() => doc.remove())
    }

    const indexPdf = path => new Promise((resolve, reject) => {
      const fname = path.split('/').slice(-1)[0]
      if (debug) {
        process.stderr.write(`Reading ${path}\n`)
      }
      fs.readFile(path, (err, data) => {
        if (err) {
          reject(err)
          return
        }

        let doc = new PastPaperDoc({
          // New format with PaperBlob.
          fileBlob: null,
          // Will add numPages later.
          fileType: 'pdf'
        })
        sspdf.getPDFContentAll(data).then(pdfContents => storeData(data, doc).then(() => Promise.resolve(pdfContents))).then(pdfContents => {
          if (debug) {
            process.stderr.write(`Loading cover page in ${path}\n`)
          }
          doc.set('numPages', pdfContents.numPages)
          let idxes = []
          for (let pn = 0; pn < pdfContents.numPages; pn ++) {
            let idx = new PastPaperIndex({
              docId: doc._id,
              page: pn,
              content: pdfContents.pageTexts[pn],
              sspdfCache: null
            })
            idxes.push(idx)
          }
          if (debug) {
            process.stderr.write(`All page done creating index in ${path}\n`)
          }
          let subject
          let time
          let type
          let paper
          let variant = 0
          let specimen = false
          try {
            let nameMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)_(\d{1,2})\.pdf$/)
            let nameErMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)\.pdf$/)
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
          if (debug) {
            process.stderr.write(`Metadata detected: ${JSON.stringify(mt)} in ${path}\n`)
          }
          Object.assign(doc, mt)
          let setStr = PaperUtils.setToString(mt)
          if (raceLock[setStr] && raceLock[setStr][mt.type]) {
            if (debug) {
              process.stderr.write(`Couldn't obtain duplicate raceLock for ${path}, discarding data...\n`)
            }
            resolve()
            return
          } else {
            let lt = raceLock[setStr] || (raceLock[setStr] = {})
            lt[mt.type] = true
          }
          if (debug) {
            process.stderr.write(`Perpare to process ${path}\n`)
          }
          Promise.all(idxes.map(idx => {
            return idx.save().then(() => idx.indexToElastic(doc))
          })).then(() => PastPaperDoc.find(mt, {_id: true}).exec())
            .then(docs => Promise.all(docs.map(doc => removeDoc(doc)))).then(() => doc.save(), reject).then(a => {
              if (debug) {
                process.stderr.write(`Saved ${path}\n`)
              }
              return Promise.resolve(a)
            }).then(resolve, err => reject(new Error("Can't save document: " + err)))
        }, err => reject(err))
      })
    })

    const indexBlob = path => new Promise((resolve, reject) => {
      const fname = path.split('/').slice(-1)[0]
      let nameMatch = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)_(\d{1,2})\.(\w+)$/)
      let nameMetaMatch = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)\.(\w+)$/)
      let doc = null
      if (nameMatch) {
        let pv = nameMatch[4]
        let paper = '0'
        let variant = '0'
        if (pv.length === 1) {
          paper = pv[0]
        } else {
          if (pv[0] === '0') {
            paper = pv[1]
          } else {
            paper = pv[0]
            variant = pv[1]
          }
        }
        paper = parseInt(paper)
        variant = parseInt(variant)
        if (!Number.isSafeInteger(paper) || !Number.isSafeInteger(variant)) {
          return void reject(new Error('Invalid pv ' + pv))
        }
        doc = new PastPaperDoc({
          subject: nameMatch[1],
          time: nameMatch[2],
          type: nameMatch[3],
          paper,
          variant,
          fileBlob: null,
          fileType: nameMatch[5],
          numPages: null
        })
      } else if (nameMetaMatch) {
        doc = new PastPaperDoc({
          subject: nameMetaMatch[1],
          time: nameMetaMatch[2],
          type: nameMetaMatch[3],
          paper: 0,
          variant: 0,
          fileBlob: null,
          fileType: nameMetaMatch[4],
          numPages: null
        })
      } else {
        return void reject(new Error(`Unrecognized file name ${fname}`))
      }
      if (debug) {
        process.stderr.write(`Reading ${path}\n`)
      }
      fs.readFile(path, (err, data) => {
        if (err) {
          return void reject(err)
        }

        storeData(data, doc).then(() => {
          return PastPaperDoc.find({
            subject: doc.subject,
            time: doc.time,
            paper: doc.paper,
            variant: doc.variant,
            type: doc.type
          }).then(docs => Promise.all(docs.map(d => removeDoc(d))))
        }).then(() => doc.save()).then(resolve, reject)
      })
    })

    function doIndex (path) {
      if (path.endsWith('.pdf')) return indexPdf(path)
      else return indexBlob(path)
    }

    let queue = process.argv.slice(2)
    let total = () => queue.length + done
    let left = () => queue.length
    let done = 0
    let failure = 0
    let ended = false
    let processing = 0
    let lastShowProgress = 0
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
        process.stderr.write(`[${n}] ${total() - left()}/${total()}, ${Math.round((1 - (left() / total())) * 1000) / 10}% finish... ${queue[queue.length - 1]}        \r`)
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
      }).then(doit => doit ? doIndex(task) : Promise.resolve(false)).then(() => {
        if (debug) {
          process.stderr.write(`Done ${task}\n`)
        }
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
  }, err => {
    console.error(err)
    process.exit(1)
  })
})
