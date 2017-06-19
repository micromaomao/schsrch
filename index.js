const express = require.main.require('express')
const path = require('path')
const os = require('os')
const PaperUtils = require('./view/paperutils')
const sspdf = require('./lib/sspdf')
const fs = require('fs')
const cheerio = require('cheerio')
const crypto = require('crypto')
require('./dist-server/serverrender')
const serverRender = global.serverRender
global.serverRender = null
const mongoose = require.main.require('mongoose')

let indexPath = path.join(__dirname, 'dist/index.html')
let indexHtml = fs.readFileSync(indexPath)
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

module.exports = ({mongodb: db, elasticsearch: es}) => {
  let rMain = express.Router()

  require('./lib/dbModel.js')(db, es).then(({PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord, PastPaperCollection, PastPaperId}) => {
    function statusInfo () {
      return Promise.all([PastPaperDoc.count({}), PastPaperIndex.count({}), PastPaperRequestRecord.count({})])
        .then(([docCount, indexCount, requestCount]) => {
          return Promise.resolve({docCount, indexCount, requestCount})
        }, err => Promise.reject(err))
    }

    rMain.use(function (req, res, next) {
      if (req.hostname.match(/^www\./)) {
        res.redirect('https://schsrch.xyz' + req.path)
      } else {
        next()
      }
    })
    function saveRecord (rec) {
      return rec.save().then(() => {}, err => console.log('Error saving record: ' + err))
    }
    rMain.get('/', function (req, res) {
      res.type('html')
      let $ = cheerio.load(indexHtml)
      $('.react-root').html(serverRender({})) // We want this to be static so that service worker don't end up caching old data, and that's why no status.
      res.send($.html())
      let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/'})
      saveRecord(rec)
    })
    rMain.use('/resources', express.static(path.join(__dirname, 'dist')))
    // rMain.use('/resources', express.static(path.join(__dirname, 'view/public')))
    rMain.get('/sw.js', function (req, res) {
      res.set('cache-control', 'max-age=0')
      res.sendFile(path.join(__dirname, 'dist/sw.js'))
    })
    rMain.get('/opensearch.xml', function (req, res) {
      res.set('cache-control', 'max-age=0')
      res.set()
      res.sendFile(path.join(__dirname, 'view/opensearch.xml'), {
        headers: {
          'content-type': 'application/opensearchdescription+xml'
        }
      })
    })

    rMain.get('/status/', function (req, res, next) {
      statusInfo().then(rst => res.send(rst), err => next(err))
    })

    let doSearch = require('./lib/doSearch.js')({PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord})

    rMain.get('/search/', function (req, res, next) {
      let query = (req.query.query || '').toString().trim()
      let format = req.query.as || 'json'
      if (query === '' && format === 'page') {
        res.redirect('/')
        return
      }
      doSearch(query).then(rst => {
        if (format === 'json') {
          res.send(rst)
        } else if (format === 'page') {
          res.type('html')
          let $ = cheerio.load(indexHtml)
          let querying = {query, error: null, result: JSON.parse(JSON.stringify(rst))}
          $('.react-root').html(serverRender({querying})).attr('data-querying', JSON.stringify(querying))
          res.send($.html())
        } else {
          res.status(404)
          res.send('Format unknow.')
        }
      }, err => {
        res.status(500)
        next(err)
      })
      let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/search/', search: query})
      saveRecord(rec)
    })
    rMain.get('/disclaim/', function (req, res, next) {
      res.type('html')
      let $ = cheerio.load(indexHtml)
      $('.react-root').html(serverRender({view: 'disclaim'}))
      res.send($.html())
    })

    rMain.get('/doc/:id', function (req, res, next) {
      let docId = req.params.id
      let format = req.query.as || 'blob'
      let page = parseInt(req.query.page || 'NaN')
      if (!Number.isSafeInteger(page)) page = null
      PastPaperDoc.findOne({_id: docId}).then(doc => {
        let rec = new PastPaperRequestRecord({ip: req.ip, time: Date.now(), requestType: '/doc/', targetId: req.params.id, targetPage: page, targetFormat: format})
        saveRecord(rec)
        if (!doc || (page !== null && (page < 0 || page >= doc.numPages))) {
          next()
          return
        }
        if (format === 'blob') {
          if (page !== null) {
            next()
            return
          }
          let fname = `${PaperUtils.setToString(doc)}_${doc.type}.${doc.fileType}`
          res.set('Content-Disposition', `inline; filename=${JSON.stringify(fname)}`)
          res.type(doc.fileType)
          res.send(doc.fileBlob)
        } else if (format === 'sspdf') {
          if (page === null) {
            next()
            return
          }
          processSSPDF(doc, page).then(sspdf => {
            return PastPaperDoc.findOne(Object.assign(PaperUtils.extractSet(doc), {type: (doc.type === 'ms' ? 'qp' : 'ms')}), {_id: true, type: true}).then(related => {
              return Promise.resolve(Object.assign(sspdf, {related}))
            })
          }).then(sspdf => {
            res.set('Cache-Control', 'max-age=' + (10 * 24 * 60 * 60 - 1).toString())
            res.send(sspdf)
          }, err => next(err))
        } else if (format === 'dir') {
          doc.ensureDir().then(dir => {
            if (page === null) {
              res.send(dir)
            } else {
              res.send(Object.assign(dir, {dirs: dir.dirs.filter(d => d.page === page)}))
            }
          }, err => next(err))
        } else {
          res.status(404)
          res.send('Format unknow.')
        }
      }).catch(err => next(err))
    })

    // TODO: record these requests.

    function requireAuthentication (req, res, next) {
      let authHeader = req.get('Authorization')
      let tokenMatch
      if (!authHeader || !(tokenMatch = authHeader.match(/^Bearer\s+([0-9a-f]+)$/))) {
        res.status(400)
        res.send('Authorization header invalid.')
        return
      }
      let token = Buffer.from(tokenMatch[1], 'hex')
      PastPaperId.findOneAndUpdate({authToken: token}, {$set: {lastSuccessLoginIp: req.ip, lastSuccessLoginTime: Date.now()}}, {
        'new': false,
        upsert: false,
        fields: {authToken: false}
      }).then(iddoc => {
        if (!iddoc) {
          res.status(401)
          res.send('Authorization token invalid.')
        } else {
          req.authId = iddoc
          next()
        }
      }, err => next(err))
    }

    function optionalAuthentication (req, res, next) {
      if (req.get('Authorization')) {
        requireAuthentication(req, res, next)
      } else {
        req.authId = null
        next()
      }
    }

    rMain.get('/auth/', requireAuthentication, function (req, res, next) {
      res.send(req.authId)
    })
    rMain.post('/auth/:username', function (req, res, next) {
      let username = req.params.username.trim()
      if (!/^[^\s]{1,}$/.test(username)) {
        res.status(400)
        res.send('Username invalid. Must not contain space.')
        return
      }
      PastPaperId.findOne({username}, {_id: true}).then(existingId => {
        if (existingId) {
          res.status(400)
          res.send(`Username ${username} already existed.`)
          return
        }
        crypto.randomBytes(16, (err, newToken) => {
          if (err) {
            next(err)
            return
          }
          let newId = new PastPaperId({
            authToken: newToken,
            creationTime: Date.now(),
            username
          })
          newId.save().then(() => {
            res.send({authToken: newToken.toString('hex')})
          }, err => next(err))
        })
      }, err => next(err))
    })

    rMain.post('/collections/new', requireAuthentication, function (req, res, next) {
      let cl = new PastPaperCollection({
        creationTime: Date.now(),
        ownerModifyTime: Date.now(),
        content: {},
        owner: req.authId._id
      })
      cl.save().then(() => {
        res.send({id: cl._id.toString()})
      }, err => {
        res.send({error: err.message})
      })
    })

    rMain.get('/collections/:collectionId', function (req, res, next) {
      let { collectionId } = req.params
      res.type('html')
      let $ = cheerio.load(indexHtml)
      $('.react-root').html(serverRender({view: 'collections', collection: {id: collectionId, loading: true}}))
      res.send($.html())
    })

    rMain.get('/collections/:collectionId/cloudstorage/', optionalAuthentication, function (req, res, next) {
      let { collectionId } = req.params
      PastPaperCollection.findOne({_id: collectionId}).then(doc => {
        if (!doc) {
          next()
          return
        }
        let allowedRead = false
        if (req.authId && req.authId._id.equals(doc.owner)) {
          allowedRead = true
        } else if (doc.publicRead) {
          allowedRead = true
        } else if (req.authId && doc.allowedRead.find(x => req.authId._id.equals(x))) {
          allowedRead = true
        }
        if (allowedRead) {
          res.type('json')
          res.send(doc.content)
        } else {
          res.status(401)
          res.send('Access denied.')
        }
      }, err => {
        next(err)
      })
    })

    rMain.put('/collections/:collectionId/cloudstorage/', requireAuthentication, function (req, res, next) {
      let { collectionId } = req.params
      PastPaperCollection.findOne({_id: collectionId}).then(collectionDoc => {
        if (!collectionDoc) {
          next()
          return
        }
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
          // TODO length check
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
          } catch (e) {
            res.status(403)
            res.send('Content is not valid JSON.')
            return
          }
          let allowEdit = false
          if (req.authId._id.equals(collectionDoc.owner)) {
            allowEdit = true
            collectionDoc.ownerModifyTime = Date.now()
          } else if (collectionDoc.allowedWrite.find(x => req.authId._id.equals(x))) {
            allowEdit = true
          }
          if (allowEdit) {
            collectionDoc.content = parsed
            collectionDoc.save().then(() => {
              res.status(200)
              res.end()
            }, err => {
              res.status(403)
              res.send(err.message)
            })
          } else {
            res.status(401)
            res.send("Access denied.")
          }
        })
      }, err => {
        next(err)
      })
    })

    function processSSPDF (doc, pn) {
      return new Promise((resolve, reject) => {
        function postCache (stuff) {
          let result = stuff
          result.doc = doc
          result.doc.fileBlob = null
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
            let buff = doc.fileBlob
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
    rMain.get('/robots.txt', function (req, res) {
      if (req.hostname.match(/^beta\./)) {
        res.sendFile(path.join(__dirname, 'view/betaRobots.txt'))
      } else {
        res.type('txt')
        res.send('')
      }
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
