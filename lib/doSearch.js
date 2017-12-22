const PaperUtils = require('../view/paperutils.js')

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
      } else if (lQuery.match(/^\d{4}$/)) {
        fetchPP(lQuery, null, null, null, null)
      } else if ((match = lQuery.match(/^(\d{4})([_ ]|[_ ]*pa?p?e?r?)[_ ]*(\d)$/))) { // 06101 seems like a typo, so don't misunderstand.
        fetchPP(match[1], null, match[3], null, null)
      } else if ((match = lQuery.match(/^(\d{4})([_ ]|[_ ]*pa?p?e?r?)[_ ]*(\d)[_ ]*(\d)$/))) { // 061011 as well
        fetchPP(match[1], null, match[3], match[4], null)
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})$/))) {
        fetchPP(match[1], match[2])
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], null, null, null, match[2])
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], match[2], null, null, match[3])
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*(p?a?p?e?r?[_ ]*)?(\d)$/))) {
        fetchPP(match[1], match[2], match[4], null, null)
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*(p?a?p?e?r?[_ ]*)?(\d)[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], match[5], null)
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})[_ ]*p?a?p?e?r?[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], null, match[3])
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})[_ ]*p?a?p?e?r?[_ ]*(\d)[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], match[5], match[3])
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})([_ ]*p?a?p?e?r?[_ ]*)(\d)[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], match[2], match[4], null, match[5])
      } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})([_ ]*p?a?p?e?r?[_ ]*)(\d)[_ ]*(\d)[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], match[2], match[4], match[5], match[6])
      } else if ((match = query.toUpperCase().match(/^(\d{4})\/(\d{2})\/([A-Z]\/?[A-Z]|SP)\/(\d{2})$/))) {
        let month = PaperUtils.odashMonthToMyMonth(match[3])
        let time = month + match[4]
        let [paper, variant] = match[2].split('')
        fetchPP(match[1], time, paper, variant, null)
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

      function fetchPP (subject, time, paper, variant, type) {
        let finder = {}
        subject && (finder.subject = subject)
        let tMat = null
        if (time && (tMat = time.match(/^([a-z])(\d)$/))) {
          let mo = tMat[1]
          let yr = '0' + tMat[2]
          time = mo + yr
        }
        time && (finder.time = time.toLowerCase())
        if (parseInt(paper) === 0 && Number.isSafeInteger(parseInt(variant)) && parseInt(variant) !== 0) {
          paper = variant
          variant = '0'
        }
        if (time) {
          paper && (finder.paper = {$in: [parseInt(paper), 0]})
          variant && (finder.variant = {$in: [parseInt(variant), 0]})
        } else {
          paper && (finder.paper = parseInt(paper))
          variant && (finder.variant = parseInt(variant))
        }
        type && (finder.type = type.toLowerCase())
        PastPaperDoc.find(finder, {fileBlob: false, dir: false}).limit(51).then(rst => {
          if (rst.length >= 50) {
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
