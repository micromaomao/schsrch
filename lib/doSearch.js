const PaperUtils = require('../view/paperutils.js')
const ParseQuery = require('./parseQuery.js')

module.exports = function ({PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord}) {
  function doSearch (query) {
    function findRelated (doc) {
      return PastPaperDoc.find(PaperUtils.extractSet(doc), {_id: true, type: true, fileType: true, numPages: true})
        .then(rst => Promise.resolve(rst.filter(x => x.type !== doc.type)))
    }
    if (query.trim().length === 0) {
      return Promise.resolve({
        response: 'overflow'
      })
    }
    return new Promise((resolve, reject) => {
      let lQuery = query.toLowerCase()
      let match
      let parsedQuery
      if ((match = lQuery.match(/^!!index!([0-9a-f]+)$/))) {
        let id = match[1]
        PastPaperIndex.findOne({_id: id}).then(rstIndex => {
          if (!rstIndex) {
            resolve({
              response: 'text',
              list: []
            })
          } else {
            PastPaperDoc.findOne({_id: rstIndex.docId}, {fileBlob : false}).then(rstDoc => {
              if (!rstDoc) {
                resolve({
                  response: 'text',
                  list: []
                })
              } else {
                findRelated(rstDoc).then(rstRelated => {
                  resolve({
                    response: 'text',
                    list: [{doc: rstDoc, index: rstIndex, related: rstRelated}]
                  })
                }, err => resolve(({ response: 'text', list: [{doc: rstDoc, index: rstIndex, related: []}] })))
              }
            }, err => reject({response: 'error', err: err.toString()}))
          }
        }, err => reject({response: 'error', err: err.toString()}))
      } else if ((parsedQuery = ParseQuery(query))) {
        let {subject, time, paper, variant, type} = parsedQuery.queryParsed
        PastPaperDoc.find(parsedQuery.finder, {fileBlob: false, dir: false}).limit(71).then(rst => {
          if (rst.length >= 71) {
            if (subject && time === null && paper === null && variant === null && type === null) {
              responseSubjectOverflow(subject)
            } else {
              resolve({
                response: 'overflow'
              })
            }
            return
          }
          resolve({
            response: 'pp',
            list: rst,
            typeFilter: type
          })
        }, err => {
          reject({response: 'error', err: err.toString()})
        })
      } else {
        PastPaperIndex.search(query).then(results => {
          Promise.all(results.map(rst => new Promise((resolve, reject) => {
            findRelated(rst.doc).then(related => {
              resolve({doc: rst.doc, index: rst.index, related: related})
            }, err => {
              resolve({doc: rst.doc, index: rst.index, related: []})
            })
          }))).then(rst => resolve({
            response: 'text',
            list: rst
          }), err => reject({response: 'error', err: err.toString()}))
        }).catch(err => {
          reject({response: 'error', err: err.toString()})
        })
      }

      function responseSubjectOverflow (subject) {
        Promise.all([
            PastPaperDoc.aggregate([{$match: {subject}}, {$sort: {time: 1}}, {$group: {_id: '$time', count: {$sum: 1}}}]),
            PastPaperDoc.find({subject, type: {$in: PaperUtils.subjectMetaTypes}}, {fileBlob: false, dir: false})
          ]).then(([agg, metaDocs]) => {
            resolve({
              response: 'overflow',
              subject: true,
              times: agg.map(timedoc => ({time: timedoc._id, count: timedoc.count})).sort((a, b) => {
                return PaperUtils.funcSortSet({subject, time: a.time, paper: 0, variant: 0}, {subject, time: b.time, paper: 0, variant: 0})
              }),
              metaDocs: metaDocs.sort(PaperUtils.funcSortSet)
            })
          }, err => {
            reject({response: 'error', err: err.toString()})
          })
      }
    })
  }

  return doSearch
}
