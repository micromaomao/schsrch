const fs = require('fs')

function parseArguments (args) {
  let options = {
    startsAt: null,
    help: false,
    downloadDir: null,
    dlThreads: 4,
    headers: {}
  }
  for (let i = 0; i < args.length; i ++) {
    let c = args[i]
    if (c === '--help') {
      options.help = true
      continue
    }

    const dashDownloadThreads = '--download-threads='
    if (c.startsWith(dashDownloadThreads)) {
      let ts = parseInt(c.substr(dashDownloadThreads.length))
      if (!Number.isSafeInteger(ts) || ts <= 0) throw new Error(`Invalid thread number ${ts}`)
      options.dlThreads = ts
      continue
    }

    const dashHeader = '--header='
    if (c.startsWith(dashHeader)) {
      let hd = c.substr(dashHeader.length).match(/^([^:]+): ?(.+)$/)
      if (!hd) throw new Error(`Malformatted header ${c.substr(dashHeader.length)}`)
      options.headers[hd[0]] = hd[1]
    }

    if (!c.startsWith('-')) {
      if (options.startsAt === null) {
        options.startsAt = c
        continue
      } else if (options.downloadDir === null) {
        options.downloadDir = c
        let stat = fs.statSync(options.downloadDir)
        if (!stat.isDirectory()) throw new Error(`${options.downloadDir} is not a directory.`)
        fs.accessSync(options.downloadDir, fs.constants.W_OK)
        continue
      }
    }

    throw new Error(`Unrecognized argument ${c}`)
  }

  if (options.help) return options
  if (options.downloadDir === null || options.startsAt === null) {
    options.help = true
  }
  return options
}

module.exports = parseArguments
