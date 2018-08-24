#!/usr/bin/env node
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
    baseUrl: 'https://schoolsupporthub.cambridgeinternational.org',
    email: null,
    password: null,
    help: false,
    operation: 'list-subject',
    listSubjectLevel: 'all',
    subjects: [],
    seasonFilter: [],
    quiet: false
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
      options.email = u
      continue
    }
    const dashEmail = '--email='
    if (c.startsWith(dashEmail)) {
      let u = c.substr(dashEmail.length)
      options.email = u
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

    const dashDownload = '--download'
    if (c === dashDownload) {
      options.operation = 'download'
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
`./schoolsupporthub.cambridgeinternational.org.js
  -u, --email=<email>
  -p, --password=<password>
  -s id1[,id2,...]\tSelect subjects
  -t t1[,t2,...]\tFilter time (-t s17 means only download s17 papers, for example)
  --list-subject[=<all|IGCSE|A>]
  --query-papers\tList all seasons and its papers
  --download\tPrint urls of packed PDFs.
`)
  process.exit(0)
}

let req = request.defaults({
  baseUrl: options.baseUrl, method: 'GET', followRedirect: true, followOriginalHttpMethod: true,
  jar: request.jar(), pool: { maxSockets: Infinity }, strictSSL: true, gzip: true,
  encoding: 'utf-8'
})

function login (email, password) {
  function getRequestToken () {
    return new Promise((resolve, reject) => {
      req({
        followRedirect: false, method: 'GET', uri: '/account/Login'
      }, (err, res, body) => {
        if (err) return void reject(err)
        if (res.statusCode !== 200) return void reject(new Error(`Couldn't get CSRF token. /account/Login got ${res.statusCode}.`))
        let $ = cheerio.load(body)
        let tokenInput = $('input[name="__RequestVerificationToken"]')
        if (tokenInput.length === 0) {
          return void reject(new Error("Couldn't find __RequestVerificationToken in login form."))
        }
        resolve(tokenInput.val())
      })
    })
  }
  return getRequestToken().then(csrfToken => {
    return new Promise((resolve, reject) => {
      req({
        followRedirect: false, method: 'POST', uri: '/account/Login', form: {
          __RequestVerificationToken: csrfToken,
          frmLoginEmail: email,
          frmLoginPass: password,
          frmReturnUrl: '/'
        }, headers: {
          'Referer': 'https://schoolsupporthub.cambridgeinternational.org/account/Login'
        }
      }, (err, res, body) => {
        if (err) return void reject(err)
        if (res.statusCode === 302 && res.headers.location === '/') return void resolve()
        if (res.statusCode === 302 && res.headers.location !== '/') return void reject(new Error(`/account/Login redirected to unknown url ${res.headers.location}`))
        if (res.statusCode === 200) {
          let $ = cheerio.load(body)
          let errorSpan = $('.field-validation-error')
          if (errorSpan.length > 0) {
            return void reject(new Error(errorSpan.text()))
          }
        }
        return void reject(new Error(`An unknown error prevented a successful login attempt. (/account/Login POSTed ${res.statusCode})`))
      })
    })
  })
}

const levelUrlMapping = {
  igcse: '/qualification/syllabuses?name=Cambridge IGCSE',
  alevel: '/qualification/syllabuses?name=Cambridge International AS & A Level'
}
function listSubjectInLevel (level) {
  let levelUrl = levelUrlMapping[level.toLowerCase()]
  if (!levelUrl) throw new Error(`Unknown level ${level}`)
  return new Promise((resolve, reject) => {
    req({ uri: levelUrl, json: true }, (err, res, body) => {
      if (err) return void reject(err)
      if (res.statusCode !== 200) return void reject(new Error(`Error while loading ${levelUrl}: ${res.statusCode} (${res.statusMessage})`))
      if (res.headers['content-type'].indexOf('json') < 0) return void reject(new Error(`${levelUrl} should return json, but it didn't.`))
      let subjects = body
      try {
        resolve(subjects.map(s => ({ id: s.SyllabusCode.toString(), name: s.Title.replace(/\(\d{4}\)/, '').trim()})))
      } catch (e) {
        reject(new Error(`Unexpected API response - ${e.message}`))
      }
    })
  })
}

async function queryFilelist (subjectId) {
  function getSubjectPage () {
    return new Promise((resolve, reject) => {
      req({ uri: `/past-exam-papers/?keywords=${encodeURIComponent(subjectId)}` }, (err, res, body) => {
        if (err) return void reject(err)
        if (res.statusCode !== 200) return void reject(new Error(`Coulen't reach subject page: ${res.statusCode}`))
        resolve(body)
      })
    })
  }

  function getFileList () {
    return new Promise((resolve, reject) => {
      let years = null
      if (options.seasonFilter.length > 0) {
        years = []
        for (let s of options.seasonFilter) {
          let year = '20' + s.substr(1)
          if (!years.includes(year)) years.push(year)
        }
      }
      req({ uri: `/dynamic/filtered-past-exam-papers/?keywords=${encodeURIComponent(subjectId)}&searchQuery=` + (years ? `&years=${years.join(',')}` : '') },
        (err, res, body) => {
          if (err) return void reject(err)
          if (res.statusCode !== 200) return void reject(new Error(`Unable to list files: ${res.statusCode}`))
          if (res.headers['content-type'].indexOf('html') < 0) return void reject(new Error(`Unable to parse API response - html expected.`))
          let $ = cheerio.load(body)
          try {
            let files = []
            let table = $('table')
            if (table.length !== 1) {
              throw 0
            }
            let trs = table.find('tbody > tr')
            trs.each((i, tr) => {
              tr = $(tr)
              let link = tr.find('a.download-link')
              link.each((_, a) => {
                a = $(a)
                let path = a.data('link')
                if (years === null) {
                  files.push(path)
                } else {
                  let seasonMatch = path.split('/').slice(-1)[0].match(/_[a-z]\d\d/)
                  if (!seasonMatch) return
                  let season = seasonMatch[0].substr(1)
                  if (options.seasonFilter.includes(season)) {
                    files.push(path)
                  }
                }
              })
            })
            return void resolve(files)
          } catch (e) {
            return void reject(new Error('Unable to parse API response. ' + e))
          }
        })
    })
  }

  await getSubjectPage()
  return await getFileList()
}

login(options.email, options.password).then(doJob, err => Promise.reject(new Error(`Unable to log-in: ${err.message}`))).then(() => process.exit(0)).catch(err => {
  process.stderr.write(err.message)
  process.stderr.write('\n')
  process.exit(1)
})

function doJob () {
  options.quiet || process.stderr.write(`Logged in as ${options.email}.\n`)
  if (options.operation === 'list-subject') {
    if (options.listSubjectLevel === 'all') {
      return Promise.all(Object.keys(levelUrlMapping).map(listSubjectInLevel)).then(subjectss => {
        return Promise.resolve(Array.prototype.concat.apply([], subjectss))
      }).then(printSubjectList)
    } else {
      return listSubjectInLevel(options.listSubjectLevel).then(printSubjectList)
    }
  }

  if (options.operation === 'query-papers' || options.operation === 'download') {
    if (options.subjects.length === 0) {
      return Promise.reject(new Error('No subjects specified.'))
    }
    options.quiet || process.stderr.write('Querying papers...\n')
    async function querySubjectsSingleThread () {
      let filelists = []
      let doneSubjectNum = 0
      options.quiet || process.stderr.write(`Getting file list for ${options.subjects[0]}... (${doneSubjectNum}/${options.subjects.length} subjects done)   \r`)
      for (let subjId of options.subjects) {
        doneSubjectNum ++
        let filelist = await queryFilelist(subjId)
        options.quiet || process.stderr.write(`Getting file list for ${subjId}... (${doneSubjectNum}/${options.subjects.length} subjects done)   \r`)
        filelists.push({
          subjectId: subjId,
          filelist
        })
      }
      options.quiet || process.stderr.write('\n')
      return filelists
    }
    return querySubjectsSingleThread().then(filelists => {
      if (options.operation === 'query-papers') {
        for (let ps of filelists) {
          process.stdout.write(ps.subjectId)
          process.stdout.write(':\n')
          printFileList(ps.filelist)
        }
        return Promise.resolve()
      }
      if (options.operation === 'download') {
        return getDownloadUrls(filelists).then(urls => {
          process.stderr.write('Use your favourite tools to download and unzip the following files:\n')
          for (let u of urls) {
            process.stdout.write(u)
            process.stdout.write('\n')
          }
        })
      }
      return Promise.reject(new Error())
    })
  }

  throw new Error('No operation specified.')
}

async function getDownloadUrls (filelists) {
  function callScheduleDownload (fl) {
    return new Promise((resolve, reject) => {
      req({ uri: '/FileResource/ScheduleDownload', method: 'POST', headers: {'Content-Type': 'application/json; charset=utf-8'}, body: JSON.stringify(fl) },
        (err, res, body) => {
          if (err) return void reject(err)
          if (res.statusCode !== 200) return void reject(new Error(`ScheduleDownload failed with code ${res.statusCode}`))
          if (body === 'failure') return void reject(new Error('ScheduleDownload failed with unspecified server error.'))
          return void resolve(body)
        })
    })
  }
  function callPackComplete (s3id) {
    return new Promise((resolve, reject) => {
      req({ uri: '/FileResource/isdownloadpackagecomplete/' + encodeURIComponent(s3id), method: 'GET', json: true }, (err, res, body) => {
        if (err) return void reject(err)
        if (res.statusCode !== 200) return void reject(new Error(`isdownloadpackagecomplete failed with code ${res.statusCode}`))
        if (body.Error) return void reject(new Error(`isdownloadpackagecomplete failed: ${body.Error}`))
        if (body.Url) return void resolve(body.Url)
        return void resolve(null)
      })
    })
  }

  function delay (ms) {
    return new Promise((resolve, reject) => setTimeout(resolve, ms))
  }

  let urls = []

  for (let fl of filelists) {
    let s3id = await callScheduleDownload(fl.filelist)
    let url = null
    while (url === null) {
      url = await callPackComplete(s3id)
      if (url === null) {
        options.quiet || process.stderr.write(`Probing isdownloadpackagecomplete for ${s3id}...\r`)
        await delay(500)
      }
    }
    options.quiet || process.stderr.write('\n')
    urls.push(url)
  }

  return urls
}

function printSubjectList (subjects) {
  for (let s of subjects) {
    process.stdout.write(s.id)
    process.stdout.write('\t')
    process.stdout.write(s.name)
    process.stdout.write('\n')
  }
}

function printFileList (filelist) {
  for (let path of filelist) {
    process.stdout.write(`  ${path.split('/').slice(-1)[0]} \n`)
  }
}
