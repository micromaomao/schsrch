#!/usr/bin/env node
/* eslint-disable no-unused-vars, prefer-const, object-curly-spacing, space-unary-ops, no-void */
const DB = process.env.MONGODB || 'mongodb://127.0.0.1/schsrch'
const ES = process.env.ES || '127.0.0.1:9200'
const QUICK = process.env.QUICK
const DEBUG = process.env.DEBUG
let noCacheSSPDF = QUICK === '1'
let debug = DEBUG === '1'

const mongoose = require('mongoose')
mongoose.Promise = global.Promise
let db = mongoose.createConnection(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
})

const fs = require('fs')
const path = require('path')
const PaperUtils = require('./view/paperutils.js')
const sspdf = require('./lib/sspdf.js')
const sspdfLock = require('./lib/singlelock.js')()
const Recognizer = require('./lib/recognizer.js')
const elasticsearch = require('elasticsearch')
const CIESubjects = require('./view/CIESubjects.data.js')
const crypto = require('crypto')
const storage = require('./storage/index.js')

function extractMetadataFromPath (filePath) {
  const fname = path.basename(filePath)
  const dirName = path.dirname(filePath)

  let subject, time, type, paper, variant

  let nameMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)_(\d{1,2})\.\w+$/)
  let nameErMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9_]+)\.\w+$/)
  let specimenMat = fname.match(/^(\d+)-(\d{4})-specimen-paper-(\d+)(?:-(.*))?\.pdf$/)

  if (specimenMat) {
    let year = specimenMat[2]
    time = 'y' + year.substring(2)
    paper = parseInt(specimenMat[3])
    variant = 0
    let subType = specimenMat[4]
    if (!subType) {
      type = 'sp'
    } else if (subType.includes('mark-scheme')) {
      type = 'sm'
    } else if (subType.includes('confidential-instruction')) {
      type = 'sr'
    } else if (subType.includes('insert')) {
      type = 'si'
    } else {
      type = 'sp'
    }

    let dirs = dirName.split(path.sep)
    for (let dir of dirs) {
      let subjMatch = CIESubjects.find(s => s.name === dir || s.id === dir)
      if (subjMatch) {
        subject = subjMatch.id
        break
      }
    }
    if (!subject) throw new Error('Could not determine subject from path: ' + dirName)

    return { subject, time, type, paper, variant }
  } else if (nameMat) {
    let pv
    [, subject, time, type, pv] = nameMat
    paper = parseInt(pv[0])
    if (pv.length === 2) {
      variant = parseInt(pv[1])
    } else {
      variant = 0
    }
    return { subject, time, type, paper, variant }
  } else if (nameErMat) {
    let t = nameErMat[3]
    subject = nameErMat[1]
    time = nameErMat[2]
    let typeMatch = t.match(/([a-z]+)$/i)
    if (typeMatch) {
      type = typeMatch[1]
    } else {
      type = t
    }
    paper = 0
    variant = 0
    return { subject, time, type, paper, variant }
  }
  return null
}

let raceLock = {}

db.on('error', err => {
  console.error(err)
  process.exit(1)
})
let es = new elasticsearch.Client({
  host: ES
})
db.on('open', () => {
  require('./lib/dbModel.js')(db, es).then(({PastPaperIndex, PastPaperDoc}) => {
    async function saveToStorage (filePath, data, doc) {
      const hash = crypto.createHash('sha256').update(data).digest('hex')

      let relativePath
      const absoluteFilePath = require('path').resolve(filePath)
      const storageRoot = require('path').resolve(storage.root)

      if (absoluteFilePath.startsWith(storageRoot)) {
        relativePath = require('path').relative(storageRoot, absoluteFilePath)
      } else {
        const existingDoc = await PastPaperDoc.findOne({ fileHash: hash, relativePath: { $exists: true } })

        if (existingDoc && existingDoc.relativePath) {
          relativePath = existingDoc.relativePath
        } else {
          const fname = `${PaperUtils.setToString(doc)}_${doc.type}.${doc.fileType}`
          relativePath = `new_imports/${doc.subject}/${doc.time}/${fname}`
          await storage.save(relativePath, data)
        }
      }

      doc.fileHash = hash
      doc.relativePath = relativePath
    }
    function removeDoc (doc) {
      return PastPaperIndex.deleteMany({docId: doc._id}).exec().then(() => doc.deleteOne())
    }

    const indexPdf = filePath => new Promise((resolve, reject) => {
      const fname = filePath.split('/').slice(-1)[0]
      if (debug) {
        process.stderr.write(`Reading ${filePath}\n`)
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err)
          return
        }

        let doc = new PastPaperDoc({
          // Will add numPages later.
          fileType: 'pdf'
        })
        sspdf.getPDFContentAll(data).then(pdfContents => Promise.resolve(pdfContents)).then(pdfContents => {
          if (debug) {
            process.stderr.write(`Loading cover page in ${filePath}\n`)
          }
          doc.set('numPages', pdfContents.numPages)
          let idxes = []
          let recognizerArg = []
          for (let pn = 0; pn < pdfContents.numPages; pn ++) {
            let idx = new PastPaperIndex({
              docId: doc._id,
              page: pn,
              content: pdfContents.pageTexts[pn],
              sspdfCache: null
            })
            idxes.push(idx)
            
            recognizerArg[pn] = {
              rects: pdfContents.pageRects[pn],
              content: pdfContents.pageTexts[pn],
              docId: doc._id,
              page: pn
            }
          }
          doc.set('dir', Recognizer.dir(recognizerArg))

          if (debug) {
            process.stderr.write(`All page done creating index in ${path}\n`)
          }
          let subject
          let time
          let type
          let paper
          let variant = 0
          let specimen = false

          let parsedMeta = extractMetadataFromPath(filePath)
          if (parsedMeta) {
            subject = parsedMeta.subject
            time = parsedMeta.time
            type = parsedMeta.type
            paper = parsedMeta.paper
            variant = parsedMeta.variant
          } else {
            try {
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
            } catch (e) {
              reject(e)
              return
            }
          }
          let mt = {
            subject,
            time,
            type,
            paper: parseInt(paper),
            variant: parseInt(variant)
          }
          if (debug) {
            process.stderr.write(`Metadata detected: ${JSON.stringify(mt)} in ${filePath}\n`)
          }
          Object.assign(doc, mt)
          let setStr = PaperUtils.setToString(mt)
          if (raceLock[setStr] && raceLock[setStr][mt.type]) {
            if (debug) {
              process.stderr.write(`Couldn't obtain duplicate raceLock for ${filePath}, discarding data...\n`)
            }
            resolve()
            return
          } else {
            let lt = raceLock[setStr] || (raceLock[setStr] = {})
            lt[mt.type] = true
          }
          if (debug) {
            process.stderr.write(`Perpare to process ${filePath}\n`)
          }
          Promise.all(idxes.map(idx => {
            return idx.save().then(() => idx.indexToElastic(doc))
          })).then(() => PastPaperDoc.find(mt, {_id: true}).exec())
            .then(docs => Promise.all(docs.map(d => removeDoc(d)))).then(() => saveToStorage(filePath, data, doc)).then(() => doc.save(), reject).then(a => {
              if (debug) {
                process.stderr.write(`Saved ${filePath}\n`)
              }
              return Promise.resolve(a)
            }).then(resolve, err => reject(new Error("Can't save document: " + err)))
        }, err => reject(err))
      })
    })

    const indexBlob = filePath => new Promise((resolve, reject) => {
      const fname = filePath.split('/').slice(-1)[0]
      let doc = null
      let parsedMeta = extractMetadataFromPath(filePath)
      if (parsedMeta) {
        let fileTypeMatch = fname.match(/\.(\w+)$/)
        doc = new PastPaperDoc({
          subject: parsedMeta.subject,
          time: parsedMeta.time,
          type: parsedMeta.type,
          paper: parsedMeta.paper,
          variant: parsedMeta.variant,
          fileType: fileTypeMatch ? fileTypeMatch[1] : 'unknown',
          numPages: null
        })
      } else {
        return void reject(new Error(`Unrecognized file name ${fname}`))
      }
      if (debug) {
        process.stderr.write(`Reading ${filePath}\n`)
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return void reject(err)
        }

        saveToStorage(filePath, data, doc).then(() => {
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

    function doIndex (filePath) {
      if (filePath.endsWith('.pdf')) return indexPdf(filePath)
      else return indexBlob(filePath)
    }

    let queue = process.argv.slice(2)
    let total = () => queue.length + done
    let left = () => queue.length
    let done = 0
    let directoriesScanned = 0
    let pdfsIndexed = 0
    let failure = 0
    let ended = false
    let processing = 0
    let lastShowProgress = 0
    function end () {
      ended = true
      process.stderr.write(`\nFilesystem objects scanned: ${total()}
PDFs indexed: ${pdfsIndexed}
Directories traversed: ${directoriesScanned}
Failed: ${failure}\n`)
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
            directoriesScanned++
            fs.readdir(task, (err, files) => {
              if (err) {
                reject(err)
              } else {
                Array.prototype.push.apply(queue, files.map(f => path.join(task, f)))
                resolve(false)
              }
            })
          } else {
            pdfsIndexed++
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
