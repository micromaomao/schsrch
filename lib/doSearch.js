module.exports = function (db, mongoose) {
  const {PastPaperDoc, PastPaperIndex, PastPaperFeedback, PastPaperRequestRecord} = require('./dbModel.js')(db, mongoose)
  const PaperUtils = require('../view/paperutils.js')
  const IndexContent = require('./indexContent.js')

  function doSearch (query) {
    function findRelated (doc) {
      return PastPaperDoc.find({subject: doc.subject, time: doc.time, paper: doc.paper, variant: doc.variant}, {_id: true, type: true, fileType: true, numPages: true}, {doc: false})
        .then(rst => Promise.resolve(rst.filter(x => x.type !== doc.type)))
    }
    return new Promise((resolve, reject) => {
      let match
      if ((match = query.match(/^!!index!([0-9a-f]+)$/))) {
        let id = match[1]
        PastPaperIndex.findOne({_id: id}).then(rstIndex => {
          if (!rstIndex) {
            resolve({
              response: 'text',
              list: []
            })
          } else {
            PastPaperDoc.findOne({_id: rstIndex.doc}, {doc: false}).then(rstDoc => {
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
      } else if (query.match(/^\d{4}$/)) {
        fetchPP(query, null, null, null, null)
      } else if ((match = query.match(/^(\d{4})([_ ]|[_ ]*pa?p?e?r?)[_ ]*(\d)$/))) { // 06101 seems like a typo, so don't misunderstand.
        fetchPP(match[1], null, match[3], null, null)
      } else if ((match = query.match(/^(\d{4})([_ ]|[_ ]*pa?p?e?r?)[_ ]*(\d)[_ ]*(\d)$/))) { // 061011 as well
        fetchPP(match[1], null, match[3], match[4], null)
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})$/))) {
        fetchPP(match[1], match[2])
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], null, null, null, match[2])
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], match[2], null, null, match[3])
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*(p?a?p?e?r?[_ ]*)?(\d)$/))) {
        fetchPP(match[1], match[2], match[4], null, null)
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*(p?a?p?e?r?[_ ]*)?(\d)[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], match[5], null)
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})[_ ]*p?a?p?e?r?[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], null, match[3])
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})[_ ]*p?a?p?e?r?[_ ]*(\d)[_ ]*(\d)$/))) {
        fetchPP(match[1], match[2], match[4], match[5], match[3])
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})([_ ]*p?a?p?e?r?[_ ]*)(\d)[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], match[2], match[4], null, match[5])
      } else if ((match = query.match(/^(\d{4})[_ ]*([a-z]\d{1,2})([_ ]*p?a?p?e?r?[_ ]*)(\d)[_ ]*(\d)[_ ]*([a-z]{2})$/))) {
        fetchPP(match[1], match[2], match[4], match[5], match[6])
      } else if ((match = query.toUpperCase().match(/^(\d{4})\/(\d{2})\/([A-Z]\/?[A-Z]|SP)\/(\d{2})$/))) {
        let month = PaperUtils.odashMonthToMyMonth(match[3])
        let time = month + match[4]
        let [paper, variant] = match[2].split('')
        fetchPP(match[1], time, paper, variant, null)
      } else {
        let queTokenized = IndexContent.tokenize(query)
        PastPaperIndex.search(query).then(results => {
          Promise.all(results.map(rst => new Promise((resolve, reject) => {
            findRelated(rst.doc).then(related => {
              resolve({doc: rst.doc, index: rst.index, related: related})
            }, err => {
              resolve({doc: rst.doc, index: rst.index, related: []})
            })
          }))).then(rst => resolve({
            response: 'text',
            list: rst.sort((a, b) => {
              let aContent = a.index.content
              let bContent = b.index.content
              return Math.sign(IndexContent.lcsLength(IndexContent.tokenize(bContent), queTokenized) - IndexContent.lcsLength(IndexContent.tokenize(aContent), queTokenized))
            })
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
        paper && (finder.paper = parseInt(paper))
        variant && (finder.variant = parseInt(variant))
        type && (finder.type = type.toLowerCase())
        PastPaperDoc.find(finder, {doc: false}).limit(51).then(rst => {
          if (rst.length >= 50) {
            resolve({
              response: 'overflow'
            })
            return
          }
          resolve({
            response: 'pp',
            list: rst
          })
        }, err => {
          reject({response: 'error', err: err.toString()})
        })
      }
    })
  }

  return doSearch
}
