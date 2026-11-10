/* eslint-disable prefer-const, no-void, curly, quotes, object-curly-spacing, space-unary-ops */
const fs = require('fs')
const path = require('path')
// options should have downloadDir, dlThreads and quiet
function downloadPapers (options, req, queue) {
  options.quiet || process.stderr.write(`${queue.length} to download.\n`)
  return new Promise((resolve, reject) => {
    let doneAmount = 0
    let totalAmount = queue.length
    let retries = {}

    function thread (id) {
      if (totalAmount === doneAmount) return void done()
      if (queue.length === 0) return void setTimeout(() => {
        if (totalAmount === doneAmount) return void done()
        thread(id)
      }, 1000)
      let task = queue.pop()

      let urlSplit = task.split('/')
      let fname = urlSplit[urlSplit.length - 1]
      let finalPath = path.join(options.downloadDir, fname)
      let partPath = finalPath + '.part'

      fs.stat(finalPath, (err, stats) => {
        if (!err && stats.isFile()) {
          // File already exists, skip download
          doneAmount ++
          if (doneAmount === totalAmount) return done()
          options.quiet || process.stderr.write(`[${id}]: Skipped ${fname} ... (${totalAmount - doneAmount} left / ${totalAmount})             \r`)
          return void thread(id)
        }

        req({
          url: task,
          encoding: null,
          timeout: 30000 // 30 seconds
        }, (err, res, body) => {
          if (err) return void error(task, err, id)
          if (res.statusCode !== 200) return void error(task, new Error(`Got ${res.statusCode} (${res.statusMessage}) from ${task}`), id)
          if (!fname) {
            return void error(task, new Error("No filename returned."), id)
          }
          fs.writeFile(partPath, body, {encoding: null, flag: 'w'}, err => {
            if (err) return void error(task, err, id)
            fs.rename(partPath, finalPath, err => {
              if (err) return void error(task, err, id)
              doneAmount ++
              if (doneAmount === totalAmount) return done()
              options.quiet || process.stderr.write(`[${id}]: ${task} ... (${totalAmount - doneAmount} left / ${totalAmount})             \r`)
              thread(id)
            })
          })
        }, 500)
      })
    }
    for (let ti = 0; ti < options.dlThreads; ti ++) thread(ti)
    let doned = false
    function done () {
      if (doned) return
      doned = true
      options.quiet || process.stderr.write('\nDone\n')
      resolve()
    }
    function error (task, error, tid) {
      retries[task] = (retries[task] || 0) + 1
      if (retries[task] > 3) {
        process.stderr.write(`Error: ${error.message}. Max retries exceeded for ${task}.\n`)
        doneAmount ++
        if (doneAmount === totalAmount) return done()
        thread(tid)
      } else {
        process.stderr.write(`Error: ${error.message}. Retrying later (${retries[task]}/3)...\n`)
        queue.push(task)
        thread(tid)
      }
    }
  })
}

module.exports = downloadPapers
