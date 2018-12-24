#!/usr/bin/env node
const { MONGODB: DB, ES } = process.env
const child_process = require('child_process')
const fs = require('fs')
const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const elasticsearch = require('elasticsearch')
let es = new elasticsearch.Client({
  host: ES
})
let db = mongoose.createConnection(DB)

db.on('error', err => {
  console.error(err)
  process.exit(1)
})
db.on('open', () => {
  require('./lib/dbModel.js')(db, es).then(({PastPaperDoc, PastPaperPaperBlob}) => {
    PastPaperDoc.find({}).cursor().eachAsync(async function (doc) {
      try {
        console.log('Processing ' + doc._id)
        if (doc.gs_optimized) {
          return
        }
        let pdfBlob = await doc.getFileBlob()
        let newBlob = null
        newBlob = await doOptimize(pdfBlob)
        doc.fileBlob = null
        await PastPaperPaperBlob.remove({docId: doc._id})
        let chunkSize = 10 * 1024 * 1024
        for (let off = 0; off < newBlob.length; off += chunkSize) {
          let slice = newBlob.slice(off, off + chunkSize)
          let dbBlobFrag = new PastPaperPaperBlob({
            docId: doc._id,
            offset: off,
            data: slice
          })
          await dbBlobFrag.save()
        }
        doc.set('gs_optimized', true)
        doc.markModified('gs_optimized')
        await doc.save()
      } catch (e) {
        process.stderr.write(`Error when processing ${doc._id}: ${e.toString()}\n`)
        return
      }
    }).then(() => {
      process.exit()
    })
  }, err => {
    console.error(err)
    process.exit(1)
  })
})

function doOptimize (pdfBlob) {
  return new Promise((resolve, reject) => {
    // For some reason if we want gs to write to any file in /dev/fd, it segfaults.
    // let cp = child_process.spawn('gs',
    //                              ['-sDEVICE=pdfwrite', '-dFastWebView', '-dNOPAUSE', '-dBATCH', '-sOutputFile=| cat - >&3', '-'],
    //                              {
    //                                cwd: '/tmp/',
    //                                stdio: [
    //                                  'pipe', // input from stdin
    //                                  'inherit', // stdout
    //                                  'inherit', // stderr
    //                                  'pipe' // fd=3 as pipe
    //                                ]
    //                              })
    // let [sI, _, _2, sO] = cp.stdio
    // let receivedBytes = 0
    // let outBuffer = Buffer.allocUnsafe(1000)
    // sO.on('data', data => {
    //   if (receivedBytes + data.length <= outBuffer.length) {
    //     let len = data.copy(outBuffer, receivedBytes)
    //     receivedBytes += len
    //   } else {
    //     let allocNewSize = Math.max(outBuffer.length * 2, receivedBytes + data.length)
    //     let newBuffer = Buffer.allocUnsafe(allocNewSize)
    //     outBuffer.copy(newBuffer, 0, 0, receivedBytes)
    //     delete outBuffer
    //     outBuffer = newBuffer
    //     let len = data.copy(outBuffer, receivedBytes)
    //     receivedBytes += len
    //   }
    // })
    // let exitCode = null
    // let readDone = false
    // let done = false
    // sO.on('end', () => {
    //   if (exitCode !== null) {
    //     finish()
    //   } else {
    //     readDone = true
    //   }
    // })
    let cp = child_process.spawn('gs',
                                 ['-sDEVICE=pdfwrite', '-dFastWebView', '-dNOPAUSE', '-dBATCH', '-sOutputFile=/tmp/optimize_pdfjs_tmpout.pdf', '-'],
                                 {
                                   cwd: '/tmp/',
                                   stdio: [
                                     'pipe', 'inherit', 'inherit'
                                   ]
                                })
    let sI = cp.stdin
    let done = false
    cp.on('exit', (code, sig) => {
      if (done) return
      if (code === null && sig !== null) {
        done = true
        reject(new Error(`Process killed because ${sig}`))
      }
      if (code !== null && code !== 0) {
        done = true
        reject(new Error(`Process exited with code ${code}`))
      }
      finish()
    })
    cp.on('error', err => {
      if (done) return
      done = true
      reject(err)
    })
    sI.on('error', err => {
      if (done) return
      done = true
      reject(err)
    })
    sI.end(pdfBlob)
    function finish () {
      if (done) return
      done = true
      fs.readFile('/tmp/optimize_pdfjs_tmpout.pdf', {encoding: null, flag: 'r'}, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    }
  })
}
