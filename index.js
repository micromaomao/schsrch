const express = require.main.require('express')
const path = require('path')
const os = require('os')
const PaperUtils = require('./view/paperutils')
const CIESubjects = require('./view/CIESubjects.js')
const sspdf = require('./lib/sspdf')
const fs = require('fs')
const cheerio = require('cheerio')
const crypto = require('crypto')
const assert = require('assert')
const postJsonReceiver = require('./lib/post-json-receiver.js')
require('./dist-server/serverrender')
const serverRender = global.serverRender
global.serverRender = null
const mongoose = require.main.require('mongoose')
const state2meta = require('./view/state2meta.js')
const Recognizer = require('./lib/recognizer.js')
const ParseQuery = require('./lib/parseQuery.js')

let indexPath = path.join(__dirname, 'dist/index.html')
let indexHtml = fs.readFileSync(indexPath, {encoding: 'utf8'})
if (process.env.NODE_ENV !== 'production') {
  fs.watch(indexPath, list => {
    fs.readFile(indexPath, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        console.error(err)
        process.exit(1)
      } else {
        indexHtml = data
      }
    })
  })
}

module.exports = ({mongodb: db, elasticsearch: es, siteOrigin}) => {
  if (!siteOrigin) siteOrigin = 'https://paper.sc'
  const siteName = siteOrigin.match(/^https?:\/\/(.+)$/)[1]
  let rMain = express.Router()

  require('./lib/dbModel.js')(db, es).then(({PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperCollection, PastPaperId, PastPaperFidoChallenge}) => {
    function statusInfo () {
      return Promise.all([PastPaperDoc.estimatedDocumentCount(), PastPaperIndex.estimatedDocumentCount(), Promise.resolve(0)])
        .then(([docCount, indexCount, requestCount]) => {
          return Promise.resolve({docCount, indexCount, requestCount})
        }, err => Promise.reject(err))
    }

    rMain.use(function (req, res, next) {
      if (req.hostname.match(/^www\./)) {
        res.redirect(siteOrigin + req.path)
      } else {
        let org
        if ((org = req.get('Origin'))) {
          let corsMethod = req.get('Access-Control-Request-Method')
          if (corsMethod && corsMethod.toUpperCase() === 'GET' && corsMethod.toUpperCase() === 'HEAD') {
            res.set('Access-Control-Allow-Origin', org)
            res.set('Access-Control-Allow-Credentials', 'false')
            res.set('Access-Control-Allow-Methods', 'GET, HEAD')
          }
        }
        next()
      }
    })
    function saveRecord (rec) {
      return rec.save().then(() => {}, err => console.log('Error saving record: ' + err))
    }

    function renderView (state, res, postProcess) {
      res.type('html')
      let $ = cheerio.load(indexHtml.replace(/SITE_ORIGIN/g, siteOrigin))
      // We want this to be static so that service worker don't end up caching old data, and that's why no status.
      $('.react-root').html(serverRender(Object.assign(state, {siteOrigin})))
      if (postProcess) {
        postProcess($, $('.react-root'))
      }
      let metas = state2meta(state, siteOrigin, siteName)
      if (metas) {
        let headStyle = $('head style:last-child')
        if (metas.url) {
          let mt = $('<meta property="og:url">')
          mt.attr('content', metas.url)
          headStyle.before(mt)
        }
        if (metas.title) {
          let tit = $('<title></title>')
          tit.text(metas.title)
          headStyle.before(tit)

          let mt = $('<meta property="og:title">')
          mt.attr('content', metas.title)
          headStyle.before(mt)
        }
        if (metas.description) {
          let mt = $('<meta property="og:description">')
          mt.attr('content', metas.description)
          headStyle.before(mt)

          let mt2 = $('<meta name="description">')
          mt2.attr('content', metas.description)
          headStyle.before(mt2)
        }
        if (metas.noindex) {
          headStyle.before($('<meta name="robots" content="noindex">'))
        }
      }
      res.send($.html())
    }

    rMain.get('/', function (req, res) {
      renderView({}, res)
    })
    rMain.use('/resources', express.static(path.join(__dirname, 'dist')))
    rMain.use('/resources/pdfjs', express.static(path.join(__dirname, 'node_modules/pdfjs-dist/build')))
    rMain.get('/opensearch.xml', function (req, res) {
      res.set('cache-control', 'max-age=0')
      res.sendFile(path.join(__dirname, 'view/opensearch.xml'), {
        headers: {
          'content-type': 'application/opensearchdescription+xml'
        }
      })
    })

    rMain.get('/status/', function (req, res, next) {
      statusInfo().then(rst => res.send(rst), err => next(err))
    })

    let doSearch = require('./lib/doSearch.js')({PastPaperDoc, PastPaperIndex, PastPaperFeedback})

    rMain.get('/search/', function (req, res, next) {
      let query = (req.query.query || '').toString().trim()
      let format = req.query.as || 'json'
      if (query === '' && format === 'page') {
        res.redirect('/')
        return
      }
      if (format === 'raw') {
        let queryParse = ParseQuery(query)
        if (!queryParse) {
          res.status(400)
          res.send("Can't perform text search with raw format.")
          return
        }
        let mongoFinder = queryParse.finder
        let wLinks = req.query.wlinks === '1' || req.query.wlinks === 'true'
        let wLinksOnly = req.query.wlinks === 'only'
        let dataStream = PastPaperDoc.find(mongoFinder, {subject: true, time: true, paper: true, variant: true, type: true}).cursor({
          transform: (!wLinksOnly
                        ? (doc => `${PaperUtils.setToString(doc)}_${doc.type}${wLinks ? `\thttps://${req.hostname}/doc/${doc._id}/` : ''}`)
                        : (doc => `https://${req.hostname}/doc/${doc._id}/`))
        })
        let ended = false
        res.type('text')
        dataStream.on('data', line => {
          if (ended) return
          res.write(line, 'utf-8')
          res.write('\n')
        })
        dataStream.on('error', err => {
          if (ended) return
          res.end(`-- Error orroured: ${err}`)
          dataStream.close()
          ended = true
        })
        dataStream.on('end', () => {
          if (ended) return
          res.end()
          dataStream.close()
          ended = true
        })
        res.on('close', () => {
          if (ended) return
          dataStream.close()
          ended = true
        })
        return
      }
      doSearch(query).then(rst => {
        if (format === 'json') {
          res.send(rst)
        } else if (format === 'page') {
          let querying = {query, error: null, result: JSON.parse(JSON.stringify(rst))}
          renderView({querying}, res, ($, reactRoot) => { reactRoot.attr('data-querying', JSON.stringify(querying)) })
        } else {
          res.status(404)
          res.send('Format unknow.')
        }
      }, err => {
        res.status(500)
        next(err)
      })
    })
    rMain.get('/disclaim/', function (req, res, next) {
      renderView({view: 'disclaim'}, res)
    })
    rMain.get('/help/', function (req, res, next) {
      renderView({view: 'home', showHelp: true}, res)
    })

    rMain.get('/doc/:id', function (req, res, next) {
      let docId = req.params.id.toString()
      let format = req.query.as || 'blob'
      let page = parseInt(req.query.page || 'NaN')
      if (!Number.isSafeInteger(page)) page = null
      PastPaperDoc.findOne({_id: docId}).then(doc => {
        if (!doc) {
          return void next()
        }
        if (doc.numPages !== null) {
          if (page !== null && (page < 0 || page >= doc.numPages)) {
            res.status(404)
            res.send(`Page ${page} out of range.`)
            return
          }
        } else {
          if (page !== null) {
            res.status(406)
            res.send("Page should not be specified on this document.")
            return
          }
        }
        if (format === 'blob') {
          if (page !== null) {
            res.status(400)
            res.send("Page should not be specified for download request.")
            return
          }
          let fname = `${PaperUtils.setToString(doc)}_${doc.type}.${doc.fileType}`
          doc.getFileBlob().then(blob => {
            let ranges = req.range(blob.length)
            if (ranges === -2) {
              res.status(400)
              return res.end()
            }
            if (ranges === -1) {
              res.status(416)
              return res.end()
            }
            res.set('Accept-Ranges', 'bytes')
            res.set('Cache-Control', 'public, max-age=8640000')
            res.set('Content-Disposition', `inline; filename=${JSON.stringify(fname)}`)
            res.type(doc.fileType)
            if (!ranges) {
              res.send(blob)
            } else {
              let sendBuffer = Buffer.concat(ranges.map(({start, end}) => {
                return blob.slice(start, end + 1)
              }))
              res.status(206)
              res.send(sendBuffer)
            }
          }, err => {
            next(err)
          })
        } else if (format === 'sspdf') {
          if (doc.fileType !== 'pdf') {
            res.status(406)
            res.send(`sspdf only works on PDF files. This file has fileType ${doc.fileType}.`)
            return
          }
          if (page === null) {
            res.status(400)
            res.send("A page number is required for sspdf request.")
            return
          }
          processSSPDF(doc, page).then(sspdf => {
            res.set('Cache-Control', 'max-age=' + (10 * 24 * 60 * 60 - 1).toString())
            res.send(sspdf)
          }, err => {
            next(err)
          })
        } else if (format === 'dir') {
          doc.ensureDir().then(dir => {
            if (page === null) {
              res.send(dir)
            } else {
              res.send(Recognizer.dirFilterPage(dir, page))
            }
          }, err => next(err))
        } else {
          res.status(404)
          res.send('Format unknow.')
        }
      }).catch(err => next(err))
    })

    rMain.get('/dirs/batch/', function (req, res, next) {
      if (!req.query.docid) return next()
      let docid = req.query.docid.toString().trim()
      let flattenEr = req.query.flattenEr === 'true'
      PastPaperDoc.findOne({_id: docid}).then(initDoc => {
        if (!initDoc) {
          next()
          return
        }
        if (!Number.isSafeInteger(initDoc.paper) && !Number.isSafeInteger(initDoc.variant)) {
          let obj = {}
          initDoc.ensureDir().then(dir => {
            obj[initDoc.type] = dir
            obj[initDoc.type].docid = initDoc._id.toString()
            res.send(obj)
          }, err => next(err))
        } else {
          PastPaperDoc.find({$or: [
            PaperUtils.extractSet(initDoc),
            {
              subject: initDoc.subject,
              time: initDoc.time,
              paper: 0,
              variant: 0
            }
          ]}).then(docs => Promise.all(docs.map(doc => {
            return doc.ensureDir().then(dir => Promise.resolve({type: doc.type, dir, docid: doc._id.toString()}))
          }))).then(tds => {
            let obj = {}
            for (let td of tds) {
              if (td.type !== 'er' || !flattenEr || td.dir.type !== 'er') {
                obj[td.type] = td.dir
              } else {
                let target = td.dir.papers.find(x => x.pv === `${initDoc.paper}${initDoc.variant}`)
                if (!target) {
                  obj[td.type] = {type: 'questions', dirs: []}
                } else {
                  obj[td.type] = {
                    type: 'er-flattened',
                    dirs: target.dirs
                  }
                }
              }
              obj[td.type].docid = td.docid
            }
            res.send(obj)
          }).catch(err => next(err))
        }
      }, err => next(err))
    })

    function processSSPDF (doc, pn) {
      return new Promise((resolve, reject) => {
        if (doc.fileType !== 'pdf') {
          return void reject(new Error(`sspdf only works on PDF files. This doc has fileType ${doc.fileType}.`))
        }
        function postCache (stuff) {
          let result = stuff
          result.doc = doc
          result.doc.fileBlob = null
          result.doc.dir = null
          return result
        }

        PastPaperIndex.find({docId: doc._id, page: pn}).then(ppIdxes => {
          if (!ppIdxes || ppIdxes.length < 1) {
            reject(null)
            return
          }
          let ppIdx = ppIdxes[0]
          // FIXME: Race condition result in duplicate works
          if (ppIdx.sspdfCache) {
            resolve(postCache(ppIdx.sspdfCache))
          } else {
            console.log(`Building sspdf for ${doc._id}::${pn} (idx//${ppIdx._id})`)
            doc.getFileBlob().then(buff => {
              sspdf.getPage(buff, pn, function (err, result) {
                if (err) {
                  reject(err)
                } else {
                  sspdf.preCache(result, nResult => {
                    ppIdx.sspdfCache = nResult
                    result = null
                    ppIdx.save(err => {
                      if (err) {
                        console.error('Unable to save sspdfCache: ' + err)
                      }
                      resolve(postCache(nResult))
                    })
                  })
                }
              })
            })
          }
        }).catch(reject)
      })
    }

    rMain.post('/feedback/', function (req, res, next) {
      let ctype = req.get('Content-Type')
      let done = false
      if (ctype !== 'application/json') {
        res.status(415)
        res.send('Content type incorrect.')
        done = true
        return
      }
      let body = ''
      req.setEncoding('utf8')
      req.on('data', chunk => {
        if (done) return
        body += chunk
      })
      req.on('end', () => {
        if (done) return
        done = true
        body = body.trim()
        if (body.length === 0) {
          res.status(403)
          res.send('Content is empty.')
          return
        }
        let parsed = null
        try {
          parsed = JSON.parse(body)
          if (typeof parsed !== 'object') {
            throw new Error()
          }
          if (parsed.email === null) {
            parsed.email = ''
          }
        } catch (e) {
          res.status(403)
          res.send('Content is not valid JSON.')
          return
        }
        if (typeof parsed.email !== 'string' || typeof parsed.text !== 'string' || (parsed.search && typeof parsed.search !== 'string')) {
          res.status(403)
          res.send('JSON is malformed.')
          return
        }
        let fb = new PastPaperFeedback({
          time: Date.now(),
          ip: req.ip,
          email: parsed.email,
          text: parsed.text,
          search: parsed.search
        })
        fb.save().then(() => {
          res.status(200)
          res.end()
        }, err => {
          res.status(403)
          res.send(err.toString())
        })
      })
    })

    rMain.get('/subjects/', function (req, res, next) {
      function response (agg) {
        if (!req.query.as || req.query.as === 'page') {
          renderView({view: 'subjects', subjectStatistics: {loading: false, error: null, result: agg}}, res, ($, reactRoot) => {reactRoot.attr('data-subject-stats', JSON.stringify(agg))})
        } else if (req.query.as === 'json') {
          res.send(agg)
        } else {
          res.status(404)
          res.send('Format unknow.')
        }
      }
      PastPaperDoc.aggregate([{$sort: {subject: 1}}, {$group: {_id: '$subject', totalPaper: {$sum: 1}}}]).then(agg => {
        Promise.all(agg.map(g => PastPaperDoc.aggregate([{$match: {subject: g._id}}, {$sort: {time: 1}}, {$group: {_id: '$time'}}]))).then(aggr => {
          let nagg = agg.map((g, i) => {
            let r = aggr[i]
            if (!r) return g
            r = r.map(x => ({subject: g._id, time: x._id, paper: 0, variant: 0})).sort(PaperUtils.funcSortSet).map(x => x.time)
            let cSubj = CIESubjects.findExactById(g._id)
            if (cSubj) {
              return Object.assign({}, g, {times: r, name: cSubj.name, level: cSubj.level})
            } else {
              return Object.assign({}, g, {times: r, name: null, level: null})
            }
          })
          response(nagg)
        }, err => {
          response(agg)
        })
      }, err => next(err))
    })

    rMain.get('/robots.txt', function (req, res) {
      res.type('txt')
      res.send('')
    })
    rMain.get('/redbook', function (req, res) {
      res.redirect('https://static.maowtm.org/redbook.pdf')
    })
  }, err => {
    rMain.use(function (req, res, next) {
      next(err)
    })
    console.error(err)
  })

  return rMain
}
