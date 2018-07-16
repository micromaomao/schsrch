#!/usr/bin/env node
const request = require('request')
const cheerio = require('cheerio')
const { URL } = require('url')
const downloadPapers = require('./downloadpapers.js')
const parseArguments = require('./genericargumentparser.js')

let options = null

try {
  options = parseArguments(process.argv.slice(2))
} catch (e) {
  process.stderr.write(e.message)
  process.stderr.write('\nFor help, use --help\n')
  process.exit(1)
}

if (options.help) {
  process.stdout.write(
`./pastpapers.papacambridge.com.js [options] <startUrl> <outputDir>

  Options:
    --download-threads=<n>\tUse n connections while downloading.
    --header=Name: Value\tSpecify a http header to use. Can be used multiple times.
`)
  process.exit(0)
}

let req = request.defaults({
  method: 'GET', followRedirect: true, followOriginalHttpMethod: true,
  jar: request.jar(), pool: { maxSockets: Infinity }, strictSSL: true, gzip: true,
  encoding: 'utf-8', headers: options.headers
})

let pageQueue = []
let urlsToDownload = new Set()
let numProcessing = 0
function pageThread () {
  let currentUrl = pageQueue.pop()
  numProcessing ++
  new Promise((resolve, reject) => {
    let urlParse = new URL(currentUrl)
    options.quiet || process.stderr.write(`${currentUrl}                   \n`)
    outputProgress()
    if (urlParse.pathname === '/') {
      let dir = urlParse.searchParams.get('dir')
      if (dir === null) return void resolve()
      req({url: currentUrl}, (err, res, body) => {
        if (err) return void reject(err)
        if (res.statusCode !== 200) {
          process.stderr.write(`Got ${res.statusCode} (${res.statusMessage}) from ${currentUrl}. Ignoring this page.`)
          return void resolve()
        }
        let $ = cheerio.load(body)
        $('a').each((i, el) => {
          let $a = $(el)
          let href = $a.attr('href')
          if (!href) return
          if (href.startsWith('javascript:')) return
          let hrefUrl = new URL(href.split('#')[0], urlParse)
          if (hrefUrl.pathname === '/') {
            let nDir = hrefUrl.searchParams.get('dir')
            if (!nDir) return
            if (nDir.startsWith(dir) && nDir.length > dir.length && !/Resources\/?$/.test(nDir)) {
              pageQueue.push(hrefUrl.href)
            }
          } else if (hrefUrl.pathname === '/view.php') {
            pageQueue.push(hrefUrl.href)
          }
        })
        resolve()
      })
    } else if (urlParse.pathname === '/view.php') {
      let file = urlParse.searchParams.get('id')
      if (file === null) return void resolve()
      if (/sy\.pdf$/.test(file)) return void resolve()
      let fileUrl = new URL(file, urlParse).href.split('#')[0]
      options.quiet || process.stderr.write(`  dl: ${fileUrl}       \n`)
      outputProgress()
      urlsToDownload.add(fileUrl)
      resolve()
    } else {
      resolve()
    }
  }).then(() => {
    numProcessing --
    if (pageQueue.length === 0) {
      if (numProcessing === 0) return void pageDone()
    } else {
      pageThread()
    }
  }, err => {
    numProcessing --
    pageQueue.push(currentUrl)
    pageThread()
  })
}

let pageDoned = false
function pageDone () {
  if (pageDoned) return
  pageDoned = true
  let urlsToDownloadArray = []
  for (let u of urlsToDownload.values()) {
    urlsToDownloadArray.push(u)
  }
  options.quiet || process.stderr.write('Done fetching paper links. Ready for download...         \n')
  downloadPapers(options, req, urlsToDownloadArray).then(() => {
    process.exit(0)
  }, err => {
    err && process.stderr.write(err.message + '\n')
    process.exit(1)
  })
}

function outputProgress () {
  options.quiet || process.stderr.write(`(${pageQueue.length} pages in queue, ${urlsToDownload.size} urls in download list)\r`)
}

pageQueue.push(options.startsAt)
pageThread()
