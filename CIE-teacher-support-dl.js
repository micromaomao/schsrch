#!/bin/env node
const request = require('request')
const cheerio = require('cheerio')
const url = require('url')
const fs = require('fs')
const path = require('path')

function addTrailingSlash (url) {
  if (url.endsWith('/')) return url
  return url + '/'
}

function parseArguments (args) {
  let options = {
    baseUrl: 'https://teachers.cie.org.uk',
    username: null,
    password: null,
    help: false,
    operation: 'list-subject',
    listSubjectLevel: 'all',
    subjects: [],
    seasonFilter: [],
    quiet: false,
    downloadDir: null,
    dlThreads: 4
  }
  for (let i = 0; i < args.length; i ++) {
    let c = args[i]
    if (c === '--help') {
      options.help = true
      continue
    }
    if (c === '-u') {
      let u = args[i + 1]
      if (typeof u === 'undefined') throw new Error('Expected value after -u')
      i++
      options.username = u
      continue
    }
    const dashUser = '--user='
    if (c.startsWith(dashUser)) {
      let u = c.substr(dashUser.length)
      options.username = u
      continue
    }
    if (c === '-p') {
      let p = args[i + 1]
      if (typeof p === 'undefined') throw new Error('Expected value after -p')
      i++
      options.password = p
      continue
    }
    const dashPassword = '--password='
    if (c.startsWith(dashPassword)) {
      let p = c.substr(dashPassword.length)
      options.password = p
      continue
    }
    const dashBaseurl = '--baseurl='
    if (c.startsWith(dashBaseurl)) {
      options.baseUrl = c.substr(dashBaseurl.length)
      continue
    }

    const dashListSubject = '--list-subject'
    if (c.startsWith(dashListSubject)) {
      options.operation = 'list-subject'
      if (c.length > dashListSubject.length) {
        options.listSubjectLevel = c.substr(dashListSubject.length + 1)
      }
      continue
    }

    const dashQueryPapers = '--query-papers'
    if (c === dashQueryPapers) {
      options.operation = 'query-papers'
      continue
    }

    if (c === '-s') {
      let list = args[i + 1]
      i++
      if (!list) throw new Error('Expected subject list after -s.')
      list = list.split(',')
      for (let id of list) {
        if (!/^\d{4}$/.test(id)) throw new Error(`Malformatted subject id ${id}`)
        options.subjects.push(id)
      }
      continue
    }

    if (c === '-t') {
      let list = args[i + 1]
      i++
      if (!list) throw new Error('Expected time list after -t.')
      list = list.split(',')
      for (let t of list) {
        if (!/^[a-z]\d\d$/.test(t)) throw new Error(`Malformatted season ${t}`)
        options.seasonFilter.push(t)
      }
      continue
    }

    const dashDownload = '--download='
    if (c.startsWith(dashDownload)) {
      options.operation = 'download'
      options.downloadDir = c.substr(dashDownload.length)
      let stat = fs.statSync(options.downloadDir)
      if (!stat.isDirectory()) throw new Error(`${options.downloadDir} is not a directory.`)
      fs.accessSync(options.downloadDir, fs.constants.W_OK)
      continue
    }

    const dashDownloadThreads = '--download-threads='
    if (c.startsWith(dashDownloadThreads)) {
      let ts = parseInt(c.substr(dashDownloadThreads.length))
      if (!Number.isSafeInteger(ts) || ts <= 0) throw new Error(`Invalid thread number ${ts}`)
      options.dlThreads = ts
      continue
    }

    throw new Error(`Unrecognized argument ${c}`)
  }

  if (options.help) return options
  if (options.username === null || options.password === null) {
    throw new Error('Provide username and password with -u username -p password.')
  }
  return options
}

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
`./CIE-teacher-support-dl.js
  -u, --username=<username>
  -p, --password=<password>
  -s id1[,id2,...]\tSelect subjects
  -t t1[,t2,...]\tFilter time (-t s17 means only download s17 papers, for example)
  --list-subject[=<all|IGCSE|A>]
  --query-papers\tList all seasons and its papers
  --download=<dir>\tDownload papers to given directory.
  --download-threads=<n>\tUse n connections while downloading.
`)
  process.exit(0)
}

let req = request.defaults({
  baseUrl: options.baseUrl, method: 'GET', followRedirect: true, followOriginalHttpMethod: true,
  jar: request.jar(), pool: { maxSockets: Infinity }, strictSSL: true, gzip: true,
  encoding: 'utf-8'
})

function login (username, password) {
  return new Promise((resolve, reject) => {
    req({
      followRedirect: false, method: 'POST', uri: '/logged_in', form: {
        __ac_name: username,
        __ac_password: password
      }
    }, (err, res, body) => {
      if (err) return void reject(err)
      if (res.statusCode == 302 && res.headers.location.indexOf('unauthorised') >= 0) return void reject(new Error(`Login dosen't work.`))
      if (res.statusCode == 302 && res.headers.location === '/') return void resolve()
      reject(new Error('Unknow response to /logged_in'))
    })
  })
}

const levelUrlMapping = {
  igcse: 'qualifications/academic/middlesec/igcse',
  alevel: 'qualifications/academic/uppersec/alevel'
}
function listSubjectInLevel (level) {
  let levelUrl = levelUrlMapping[level.toLowerCase()]
  if (!levelUrl) throw new Error(`Unknown level ${level}`)
  return new Promise((resolve, reject) => {
    req({ uri: levelUrl }, (err, res, body) => {
      if (err) return void reject(err)
      if (res.statusCode !== 200) return void reject(new Error(`Error while loading ${levelUrl}: ${res.statusCode} (${res.statusMessage})`))
      if (res.headers['content-type'].indexOf('text/html') < 0) return void reject(new Error(`${levelUrl} should return html, but it didn't.`))
      try {
        let $ = cheerio.load(body)
        let sl = $('ul#subjectlist')
        if (sl.length !== 1) return void reject(new Error('Unable to get subject list from html.'))
        return void resolve(sl.children('li').map((i, el) => {
          let $el = $(el)
          let sy = $el.find('.sublistsyllcode').text().match(/\d{4}/)[0]
          let $a = $el.find('a')
          if ($a.length !== 1) throw new Error()
          return {
            id: sy,
            name: $a.text(),
            url: url.resolve(addTrailingSlash(levelUrl), $a.attr('href').split('#')[0])
          }
        }).get())
      } catch (e) {
        return void reject(new Error(`Unable to parse subjects from html. (${options.baseUrl}/${levelUrl})`))
      }
    })
  })
}

function queryPapers (subject) {
  return new Promise((resolve, reject) => {
    req({url: subject.url}, (err, res, body) => {
      if (err) return void reject(err)
      if (res.statusCode !== 200) return void reject(new Error(`Got ${res.statusCode} (${res.statusMessage}) from ${subject.url}.`))
      try {
        let $ = cheerio.load(body)
        let $years = $('#dates')
        if ($years.length !== 1) throw new Error()
        let currentYear = null
        let years = $years.children('li').map((i, el) => {
          let $el = $(el)
          let $a = $el.children('a')
          let y = $a.text().trim().match(/^20(\d{2})$/)[1]
          let yObj = {
            year: y
          }
          let href = $a.attr('href')
          if (!href && $a.children('b').length === 1) {
            currentYear = yObj
            yObj.url = subject.url
          } else {
            yObj.url = url.resolve(addTrailingSlash(subject.url), href.split('#')[0])
          }
          return yObj
        }).get()
        if (currentYear) {
          currentYear.qs = parseYearPage($, '20' + currentYear.year)
        }
        Promise.all(years.map(yObj => processYear(yObj).then(stuff => {
          if (stuff.qs.length > 0) options.quiet || process.stderr.write(`Got 20${yObj.year} stuff for ${subject.id}.\n`)
          return Promise.resolve(stuff)
        }))).then(processedYears => {
          let times = {}
          for (let y of processedYears) {
            for (let t of y.qs) {
              let pv = t.letter + y.year
              if (options.seasonFilter.length > 0 && !options.seasonFilter.includes(pv)) continue
              times[pv] = t.papers
            }
          }
          return Promise.resolve(times)
        }).then(resolve, reject)
      } catch (e) {
        return void reject(new Error(`Unable to parse subject page: ${e.message || '(unknow error)'} (${subject.url})`))
      }
    })
  })

  function processYear (yObj) {
    return new Promise((resolve, reject) => {
      if (options.seasonFilter.length > 0 && !options.seasonFilter.find(x => x.substr(1) === yObj.year)) return void resolve(Object.assign(yObj, {
        qs: []
      }))
      if (yObj.qs) return void resolve(yObj)
      req({url: yObj.url}, (err, res, body) => {
        if (err) return void reject(err)
        if (res.statusCode !== 200) return void reject(new Error(`Got ${res.statusCode} (${res.statusMessage}) on ${yObj.url}`))
        let $ = cheerio.load(body)
        try {
          yObj.qs = parseYearPage($, '20' + yObj.year)
          return void resolve(yObj)
        } catch (e) {
          return void reject(new Error(`Unable to parse page ${yObj.url}: ${e.message || '(unknow error)'}`))
        }
      })
    })
  }

  function parseYearPage ($, fullYear) {
    let yearHeadings = $('.year')
    let qs = []
    return yearHeadings.map((i, el) => {
      let $el = $(el)
      let tText = $el.text().trim()
      if (!tText.endsWith(' ' + fullYear)) throw new Error(`Unrecognized title ${tText}`)
      let month = tText.split(' ')[0]
      let letter = ({
        'March': 'm',
        'May': 's',
        'June': 's',
        'May/June': 's',
        'October': 'w',
        'November': 'w',
        'Oct/Nov': 'w'
      })[month]
      if (!letter) throw new Error(`Unrecognized month ${month}`)
      let stuff = $el.nextUntil('h4, h3, .year')
      let a_s = []
      let papers = []
      stuff.each((i, stuffEl) => {
        let $stuffEl = $(stuffEl)
        $stuffEl.find('a').each((i, el) => {
          a_s.push($(el))
        })
      })
      for (let $a of a_s) {
        if ($a.text().trim() === '') continue
        if ($a.find('*').length > 0) continue
        let href = $a.attr('href')
        if (!href) continue
        papers.push({
          string: $a.text().trim(),
          url: href
        })
      }
      return {
        letter, papers
      }
    }).get()
  }
}

login(options.username, options.password).then(doJob).then(() => process.exit(0)).catch(err => {
  process.stderr.write(err.message)
  process.stderr.write('\n')
  process.exit(1)
})

function doJob () {
  options.quiet || process.stderr.write(`Logged in as ${options.username}.\n`)
  if (options.operation === 'list-subject') {
    if (options.listSubjectLevel === 'all') {
      return Promise.all(Object.keys(levelUrlMapping).map(listSubjectInLevel)).then(subjectss => {
        return Promise.resolve(Array.prototype.concat.apply([], subjectss))
      }).then(printSubjectList)
    } else {
      return listSubjectInLevel(options.listSubjectLevel).then(printSubjectList)
    }
  }

  // Build subject id to url cache
  options.quiet || process.stderr.write('Getting subject id table...\n')
  return Promise.all(Object.keys(levelUrlMapping).map(listSubjectInLevel)).then(subjectss => {
    let subjectIdMap = {}
    for (let subjects of subjectss) {
      for (let subject of subjects) {
        subjectIdMap[subject.id] = subject
      }
    }

    if (options.operation === 'query-papers' || options.operation === 'download') {
      if (options.subjects.length === 0) {
        return Promise.reject(new Error('No subjects specified.'))
      }
      options.quiet || process.stderr.write('Querying subject pages...\n')
      return Promise.all(options.subjects.map(id => {
        let subject = subjectIdMap[id]
        if (!subject) return Promise.reject(new Error(`Unknow subject ${id}.`))
        return queryPapers(subject).then(seasons => {
          (options.quiet || options.operation === 'download') || process.stderr.write(`${id} done.\n`)
          return Promise.resolve({
            subject: subjectIdMap[id],
            seasons
          })
        })
      })).then(ss => {
        if (options.operation === 'query-papers') {
          for (let ps of ss) {
            process.stdout.write(ps.subject.id)
            process.stdout.write('\t')
            process.stdout.write(ps.subject.name)
            process.stdout.write(':\n')
            printPaperList(ps.seasons)
          }
          return Promise.resolve()
        }
        if (options.operation === 'download') {
          let queue = []
          for (let ps of ss) {
            for (let t of Object.keys(ps.seasons)) {
              let se = ps.seasons[t]
              for (let p of se) {
                queue.push(p.url)
              }
            }
          }
          return downloadPapers(queue)
        }
        return Promise.reject(new Error())
      })
    }

    throw new Error('No operation specified.')
  })
}

function printSubjectList (subjects) {
  for (let s of subjects) {
    process.stdout.write(s.id)
    process.stdout.write('\t')
    process.stdout.write(s.name)
    process.stdout.write('\t')
    process.stdout.write(options.baseUrl + '/' + s.url)
    process.stdout.write('\n')
  }
}

function printPaperList (seasons) {
  for (let s of Object.keys(seasons)) {
    process.stdout.write(`  ${s}:\n`)
    for (let p of seasons[s]) {
      process.stdout.write(`    ${p.string}: ${p.url.match(/\/([^\/]+\.pdf)$/)[1]}\n`)
    }
  }
}

function downloadPapers (queue) {
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
      process.stderr.write('\nDone\n')
      resolve()
    }
    function error (task, error, tid) {
      process.stderr.write(`Error: ${error.message}. Retrying later...\n`)
      queue.push(task)
      thread(tid)
    }
  })
}
