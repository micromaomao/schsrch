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
`./generic.js [options] <startUrl> <outputDir>

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
    if (urlParse.pathname.endsWith('.pdf') || urlParse.pathname.endsWith('.zip') || urlParse.pathname.endsWith('.mp3')) {
      urlsToDownload.add(urlParse.href)
      return void resolve()
    }
    req({url: urlParse.href}, (err, res, body) => {
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
        let hrefParse = new URL(href.split('#')[0], urlParse)
        if (hrefParse.pathname.startsWith(urlParse.pathname) && hrefParse.pathname.length > urlParse.pathname.length) {
          pageQueue.push(hrefParse.href)
        }
      })
      resolve()
    })
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
