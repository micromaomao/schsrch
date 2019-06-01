#!/usr/bin/env node

const VERSION = '0.0.0'

const request = require('request').defaults({
  baseUrl: 'https://schsrch.xyz/',
  method: 'GET',
  headers: {
    'User-Agent': 'csch'
  },
  strictSSL: true,
  gzip: true,
  pool: {maxSockets: Infinity}
})
const readline = require('readline')
const fs = require('fs')
const child_process = require('child_process')
const IndexContent = require('./indexContent.js')
const CIESubjects = require('./CIESubjects.js')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

let argv = process.argv
if (argv.length > 2) {
  process.stderr.write('This stuff expects no argument.\n')
  process.exit(1)
}

let readCallback = null
rl.on('line', input => {
  if (readCallback) {
    readCallback(input)
  }
})
rl.on('close', () => {
  rl.write('\n')
  process.exit(0)
})

function read () {
  if (readCallback) throw new Error('Another read call is still waiting for input.')
  rl.prompt(false)
  return new Promise((resolve, reject) => {
    readCallback = function (input) {
      readCallback = null
      resolve(input)
    }
  })
}

function clearline () {
  readline.clearLine(process.stdout, 0)
  process.stdout.write('\r')
}

function write (stuff, noTrailingNewline) {
  rl.write(stuff + (noTrailingNewline ? '' : '\n'))
}

function writeText (text, useLess) {
  if (useLess) {
    rl.pause()
    process.stdin.setRawMode(false)
    let ws = fs.createWriteStream('/tmp/cschlessshow.tmp', {
      flags: 'w',
      encoding: 'utf8',
      mode: 0o600,
      autoClose: true
    })
    ws.on('finish', () => {
      child_process.spawn('/usr/bin/less', ['/tmp/cschlessshow.tmp'], {
        shell: false,
        stdio: 'inherit'
      }).on('exit', code => {
        process.stdin.setRawMode(true)
        rl.resume()
        useLess()
      })
    })
    ws.on('error', err => {
      writeText(text, false)
      useLess()
    })
    ws.end(text)
    return
  }
  if (!process.stdout.isTTY) return void write(text)
  let col = process.stdout.columns
  let thisLine = ''
  for (let i = 0; i < text.length; i ++) {
    if (/\n/.test(text[i])) {
      write(thisLine)
      thisLine = ''
      continue
    }
    if (thisLine.length + 1 < col) {
      thisLine += text[i]
    } else if (thisLine.length + 1 === col) {
      if (/\W/.test(text[i])) {
        thisLine += text[i]
        write(thisLine)
        thisLine = ''
      } else {
        if (/\s/.test(thisLine[thisLine.length - 1])) {
          thisLine += ' '
        } else {
          thisLine += '-'
        }
        write(thisLine)
        thisLine = text[i]
      }
    } else {
      throw new Error('Internal error')
    }
  }
  if (thisLine !== '') write(thisLine)
}

write(`csch version ${VERSION}`)
write(`For help, type "h".`)

let cursor = null

function receiveCommandLoop () {
  read().then(cmdline => {
    let cmd = cmdline.split(/\s+/)
    if (cmd.length === 0) {
      return void receiveCommandLoop()
    }
    let c = cmd[0]
    if (c === 'h') {
      if (cmd.length > 2) {
        write('Usage: h [command]')
        return void receiveCommandLoop()
      }
      if (cmd.length === 2) {
        return void cmdHelp(cmd[1])
      } else {
        return void cmdHelp(null)
      }
    } else if (c === 'n') {
      if (cmd.length !== 1) {
        write('No arguments expected.')
        return void receiveCommandLoop()
      }
      return void cmdN()
    } else if (c === 's') {
      let query = cmd.slice(1).join(' ').trim()
      if (query === '') {
        write('Empty query.')
        return void receiveCommandLoop()
      }
      return void cmdSearch(query)
    } else if (c === 'o') {
      if (cmd.length !== 2) {
        write('Usage: o <n>')
        return void receiveCommandLoop()
      }
      let n = parseInt(cmd[1])
      if (!Number.isSafeInteger(n) || n <= 0) {
        write('n must be a positive integer')
        return void receiveCommandLoop()
      }
      return void cmdOpen(n - 1)
    } else if (c === 'p') {
      if (cmd.length > 2) {
        write('Usage: p [page number]')
        return void receiveCommandLoop()
      }
      if (cmd.length === 2) {
        let pn = parseInt(cmd[1])
        if (!Number.isSafeInteger(pn) || pn <= 0) {
          write('page number must be a positive integer')
          return void receiveCommandLoop()
        }
        return void cmdLoadPage(pn - 1)
      } else {
        return void cmdLoadPage(null)
      }
    } else if (c === 'mcqms') {
      if (cmd.length !== 1) {
        write('Usage: mcqms')
        return void receiveCommandLoop()
      }
      return void cmdMcqMs()
    } else if (c === 'd') {
      if (cmd.length !== 1) {
        write('Usage: d')
        return void receiveCommandLoop()
      }
      return void cmdDir()
    } else if (c === 'qp' || c === 'ms') {
      if (cmd.length !== 1) {
        write(`Usage: ${c}`)
        return void receiveCommandLoop()
      }
      cmdJump(c)
    } else if (c === 'exit'){
      if (cmd.length !== 1) {
        write('Usage: exit')
        return void receiveCommandLoop()
      }
      return void process.exit(0)
    } else {
      write(`Unknown command ${JSON.stringify(c)}`)
      return void receiveCommandLoop()
    }
  })
}

function cmdHelp (command) {
  if (command === null) {
    write('List of available command:')
    write('  h [command]: view help message')
    write('  s <query>: perform a search')
    write('  n: continue showing the thing just shown.')
    write('  o <n>: open the n-th search result.')
    write('  p [page number]: load page')
    write('  mcqms: print MCQ answers (if available)')
    write('  d: print question list (if available)')
    write('  qp/ms: open the corresponding qp/ms')
    return void receiveCommandLoop()
  }
  if (command === 'h') {
    writeText('h [command]')
    return void receiveCommandLoop()
  }
  if (command === 's') {
    writeText('s <query>: Perform a paper search.')
    writeText('The first 3 result is shown, further results can be accessed with "n".')
    writeText('Year search or full text search.')
    return void receiveCommandLoop()
  }
  if (command === 'n') {
    if (cursor === null) {
      writeText('n: Print "No cursor.".')
    } else {
      writeText(`n: continue showing the ${cursor.type}.`)
    }
    return void receiveCommandLoop()
  }
  if (command === 'o') {
    writeText('o <n>: run after performing a search to open the search result.')
    return void receiveCommandLoop()
  }
  if (command === 'p') {
    writeText('p [page]: Load a page and display its content. Need to first select a document from a search.')
    writeText('If no page specified, use current page.')
    return void receiveCommandLoop()
  }
  if (command === 'mcqms') {
    writeText('mcqms: After loading a paper, if it is a MCQ paper, run mcqms to print the answers.')
    return void receiveCommandLoop()
  }
  writeText(`Unknown command ${JSON.stringify(command)}`)
  return void receiveCommandLoop()
}

let sOpenList = null

function cmdSearch (query) {
  if (/^\d{4}$/.test(query)) {
    let subj = CIESubjects.findExactById(query)
    if (!subj) {
      write(`Unknown subject ${query}`)
    } else {
      write(`${query}: ${subj.level} ${subj.name}`)
    }
    return void receiveCommandLoop()
  } else if (/^\w+$/.test(query)) {
    let subjs = CIESubjects.search(query)
    if (subjs.length > 0) {
      write('Relevant subjects:')
      for (let s of subjs) {
        write(`  ${s.id}: ${s.level} ${s.name}`)
      }
      return void receiveCommandLoop()
    }
  }
  cursor = null
  sOpenList = null
  write('Searching...', true)
  request({
    url: '/search/',
    qs: {as: 'json', query},
    json: true
  }, (err, icm, rsp) => {
    clearline()
    if (err) {
      write(`Error: ${err.message}`)
      return void receiveCommandLoop()
    }
    if (icm.statusCode !== 200) {
      write(`Error: ${icm.statusCode}`)
      return void receiveCommandLoop()
    }
    if (rsp.response === 'empty' || (Array.isArray(rsp.list) && rsp.list.length === 0)) {
      write('Matched no paper.')
    } else if (rsp.response === 'overflow') {
      write('Search failed because too many paper matched.')
    } else {
      write(`Found ${rsp.list.length} results:`)
      cursor = {
        type: 'search',
        rsp,
        currentSkip: 0,
        query
      }
      if (rsp.response === 'text') {
        sOpenList = rsp.list.map(x => ([x.doc._id, x.index.page]))
      } else if (rsp.response === 'pp') {
        sOpenList = rsp.list.map(x => ([x._id, 0]))
      }
      return void cmdN()
    }
    return void receiveCommandLoop()
  })
}

function cmdN () {
  if (cursor === null) {
    write('No cursor.')
    return void receiveCommandLoop()
  }
  let list = cursor.rsp.list
  if (cursor.type === 'search') {
    for (let i = cursor.currentSkip; i < list.length; i ++) {
      if (i >= cursor.currentSkip + 3) break
      let c = list[i]
      if (cursor.rsp.response === 'text') {
        let doc = c.doc
        let content = findBestPartToShow(c.index.content.replace(/\s+/g, ' ').replace(/\.\.\.+/g, '...').trim(), cursor.query)
        writeText(`${i + 1}: [${doc.type}] ${doc.subject} ${doc.time} ${doc.paper}${doc.variant} (page ${c.index.page}): ${content}`)
      } else {
        let doc = c
        writeText(`${i + 1}: ${doc.subject} ${doc.time} ${doc.paper}${doc.variant} ${doc.type}`)
      }
    }
    if (cursor.currentSkip + 3 >= list.length) {
      cursor = null
    } else {
      cursor.currentSkip += 3
      write(`"n" for the rest (${list.length - cursor.currentSkip} remaining)`)
    }
    return void receiveCommandLoop()
  } else {
    write('Corrupted cursor.')
    return void receiveCommandLoop()
  }
}

function findBestPartToShow (content, query) {
  let qTokens = IndexContent.tokenize(query)
  let cTokens = IndexContent.tokenize(content)
  let best = null
  let bestScore = 0
  for (let startI = 0; startI < cTokens.length; startI ++) {
    let cList = []
    let charsAdded = 0
    for (let i = startI; i < cTokens.length && charsAdded <= 100; i ++) {
      let cToken = cTokens[i]
      cList.push(cToken)
      charsAdded += cToken.length
    }
    let score = IndexContent.lcsLength(qTokens, cList)
    if (score > bestScore || best === null) {
      best = cList
      bestScore = score
    }
  }
  return best.join('')
}

let oDoc = null

function cmdOpen (i) {
  if (sOpenList === null) {
    write('Do a search first.')
    return receiveCommandLoop()
  }
  let d = sOpenList[i]
  if (!d) {
    write(`Index out of range: there are only ${sOpenList.length} results.`)
    return receiveCommandLoop()
  }
  let [docid, page] = d
  oDoc = {
    docid, page
  }
  write('Getting the doc...', true)
  request({
    url: '/dirs/batch/',
    qs: {docid},
    json: true
  }, (err, icm, rsp) => {
    clearline()
    if (err) {
      write(`Error: ${err.message}`)
      return void receiveCommandLoop()
    }
    if (icm.statusCode !== 200) {
      write(`Error getting dir: ${icm.statusCode}`)
      return void receiveCommandLoop()
    }
    oDoc.dirLists = rsp
    write(`Current page: ${page + 1}, load page with "p [page number]"`)
    if (rsp.ms && rsp.ms.type === 'mcqMs') {
      write('This is a MCQ paper. To print answers type "mcqms".')
    }
    return void receiveCommandLoop()
  })
}

function cmdLoadPage (pn) {
  if (oDoc === null) {
    write('No document opened.')
    return void receiveCommandLoop()
  }
  let currentPage = oDoc.page
  if (pn === null) {
    pn = oDoc.page
  } else {
    oDoc.page = pn
  }
  if (pn === currentPage && typeof oDoc.text === 'string') {
    return void writeText(oDoc.text + `\n (page ${pn + 1} of ${oDoc.pageNum})`, () => { receiveCommandLoop() })
  }
  oDoc.text = oDoc.sspdf = null
  write('Getting content...', true)
  request({
    url: `/doc/${encodeURIComponent(oDoc.docid)}/`,
    qs: {page: pn, as: 'sspdf'},
    json: true
  }, (err, icm, res) => {
    clearline()
    if (err) {
      write(`Error getting page: ${err.message}`)
      return void receiveCommandLoop()
    }
    if (icm.statusCode !== 200) {
      write(`Error: ${icm.statusCode}`)
      return void receiveCommandLoop()
    }
    oDoc.sspdf = res
    oDoc.doc = res.doc
    oDoc.pageNum = res.pageNum
    let text = res.text.replace(/[ \t\r]+/g, ' ').replace(/\.{6,}/g, '......').replace(/\n+/g, '\n')
    oDoc.text = text
    write('')
    return void writeText(text + `\n (page ${pn + 1} of ${res.pageNum})`, () => { receiveCommandLoop() })
  })
}

function cmdMcqMs () {
  if (!oDoc || !oDoc.dirLists || !oDoc.dirLists.ms || oDoc.dirLists.ms.type !== 'mcqMs') {
    write('No mcq mark scheme to print.')
    return void receiveCommandLoop()
  }
  let ms = oDoc.dirLists.ms.dirs
  let str = ''
  for (let i = 1; i <= ms.length; i ++) {
    if (i % 5 === 1) {
      str += `\n${i}.`
    }
    let q = ms.find(x => x.qN.toString() === i.toString())
    if (q) {
      str += `${q.qT}`
    } else {
      str += '_'
    }
  }
  str += '\n'
  return void writeText(str, () => { receiveCommandLoop() })
}

function cmdDir () {
  if (!oDoc) {
    write('No document opened.')
    return void receiveCommandLoop()
  }
  if (!oDoc.dirLists) {
    write('Question list not loaded.')
    return void receiveCommandLoop()
  }
  let dirs = null
  let dirDocType = null
  let msDir = null
  if (oDoc.dirLists.qp && oDoc.dirLists.qp.type === 'questions') {
    dirDocType = 'qp'
    dirs = oDoc.dirLists.qp.dirs
    if (oDoc.dirLists.ms) {
      msDir = oDoc.dirLists.ms.dirs
    }
  } else if (oDoc.dirLists.ms && oDoc.dirLists.ms.type === 'questions') {
    dirDocType = 'ms'
    dirs = oDoc.dirLists.ms.dirs
  } else {
    write('Question list not recognized for this paper.')
    return void receiveCommandLoop()
  }
  for (let d of dirs) {
    let msPageN = null
    if (msDir) {
      let msD = msDir.find(x => x.qN === d.qN)
      if (msD) msPageN = msD.page
    }
    writeText(`#${d.qN}. ${d.qT} (${dirDocType} page ${d.page + 1} ${msPageN !== null ? `/ ms ${msPageN + 1}` : ''})`)
  }
  return void receiveCommandLoop()
}

function cmdJump (type) {
  if (!oDoc) {
    write('No document opened.')
    return void receiveCommandLoop()
  }
  if (!oDoc.dirLists) {
    write('No enough info to jump. Please do it manually via search.')
    return void receiveCommandLoop()
  }
  let ll = oDoc.dirLists[type]
  if (!ll) {
    write(`There is no ${type} for this paper.`)
    return void receiveCommandLoop()
  }
  let docid = ll.docid
  sOpenList = [[docid, 0]]
  return void cmdOpen(0)
}

receiveCommandLoop()
