const fs = require('fs')
const path = require('path')
// options should have downloadDir, dlThreads and quiet
function downloadPapers (options, req, queue) {
  options.quiet || process.stderr.write(`${queue.length} to download.\n`)
  return new Promise((resolve, reject) => {
    let doneAmount = 0
    let totalAmount = queue.length
    function thread (id) {
      if (totalAmount === doneAmount) return void done()
      if (queue.length === 0) return void setTimeout(() => {
        if (totalAmount === doneAmount) return void done()
        thread(id)
      }, 1000)
      let task = queue.pop()
      req({
        url: task,
        encoding: null,
        timeout: 3000
      }, (err, res, body) => {
        if (err) return void error(task, err, id)
        if (res.statusCode !== 200) return void error(task, new Error(`Got ${res.statusCode} (${res.statusMessage}) from ${task}`), id)
        let urlSplit = res.request.uri.path.split('/')
        let fname = urlSplit[urlSplit.length - 1]
        if (!fname) {
          return void error(task, new Error("No filename returned."), id)
        }
        fs.writeFile(path.join(options.downloadDir, fname), body, {encoding: null, flag: 'w'}, err => {
          if (err) return void error(task, err, id)
          doneAmount ++
          if (doneAmount === totalAmount) return done()
          options.quiet || process.stderr.write(`[${id}]: ${task} ... (${totalAmount - doneAmount} left / ${totalAmount})             \r`)
          thread(id)
        })
      }, 500)
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
      process.stderr.write(`Error: ${error.message}. Retrying later...\n`)
      queue.push(task)
      thread(tid)
    }
  })
}

module.exports = downloadPapers
