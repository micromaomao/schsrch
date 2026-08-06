/* eslint-disable object-curly-spacing, prefer-const, n/handle-callback-err, prefer-promise-reject-errors, object-shorthand, indent */
const PaperUtils = require('../view/paperutils.js')
const ParseQuery = require('./parseQuery.js')

module.exports = function ({PastPaperDoc, PastPaperIndex, PastPaperFeedback}) {
  /**
   * Executes a search query against MongoDB (for direct parsing) or Elasticsearch (for full-text search).
   * It also resolves related documents (e.g. fetching mark schemes for a returned question paper) in bulk.
   * 
   * @param {string} query - The raw query string provided by the user.
   * @param {Object} [filters] - Optional metadata filters (subject, time, paper, variant, type).
   * @param {string} [sortOpt] - Optional sorting order ('relevance', 'oldest', 'subject', 'session').
   * @returns {Promise<Object>} The resolved search payload.
   */
  function doSearch (query, filters, sortOpt) {
    if (!filters) filters = {}
    let sort = sortOpt || 'relevance'

    function findRelated (doc) {
      return PastPaperDoc.find(PaperUtils.extractSet(doc), {_id: true, type: true, fileType: true, numPages: true})
        .then(rst => Promise.resolve(rst.filter(x => x.type !== doc.type)))
    }
    if (query.trim().length === 0 && Object.keys(filters).length === 0) {
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
            PastPaperDoc.findOne({_id: rstIndex.docId}, {dir: false}).then(rstDoc => {
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
      } else if (query.trim().length === 0 || (parsedQuery = ParseQuery(query))) {
        if (!parsedQuery) {
          parsedQuery = { finder: {}, queryParsed: {} }
        }
        let {subject, time, paper, variant, type} = parsedQuery.queryParsed

        let finder = Object.assign({}, parsedQuery.finder)
        if (filters.subject) finder.subject = Array.isArray(filters.subject) ? { $in: filters.subject } : filters.subject
        if (filters.time) finder.time = Array.isArray(filters.time) ? { $in: filters.time } : filters.time
        if (filters.paper) finder.paper = Array.isArray(filters.paper) ? { $in: filters.paper.map(p => parseInt(p)) } : parseInt(filters.paper)
        if (filters.variant) finder.variant = Array.isArray(filters.variant) ? { $in: filters.variant.map(v => parseInt(v)) } : parseInt(filters.variant)
        if (filters.type) {
           finder.type = Array.isArray(filters.type) ? { $in: filters.type } : filters.type
        }

        let mongoSort = { time: -1, subject: 1, paper: 1, variant: 1 }
        if (sort === 'oldest') {
          mongoSort.time = 1
        } else if (sort === 'subject') {
          mongoSort.subject = 1
        } else if (sort === 'session') {
          mongoSort.time = -1
        }

        PastPaperDoc.find(finder, {dir: false}).sort(mongoSort).limit(71).then(rst => {
          if (rst.length >= 71) {
            if (subject && time === null && paper === null && variant === null && type === null && Object.keys(filters).length === 0) {
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
            typeFilter: type || filters.type
          })
        }, err => {
          reject({response: 'error', err: err.toString()})
        })
      } else {
        PastPaperIndex.search(query, filters, sort).then(results => {
          let orQueries = results.map(rst => PaperUtils.extractSet(rst.doc))
          if (orQueries.length === 0) {
            return resolve({ response: 'text', list: [] })
          }
          PastPaperDoc.find({ $or: orQueries }, { _id: true, type: true, fileType: true, numPages: true, subject: true, time: true, paper: true, variant: true }).then(allRelated => {
            let rst = results.map(rst => {
              let docSet = PaperUtils.extractSet(rst.doc)
              let related = allRelated.filter(x => 
                x.type !== rst.doc.type && 
                x.subject === docSet.subject && 
                x.time === docSet.time && 
                x.paper === docSet.paper && 
                x.variant === docSet.variant
              )
              return { doc: rst.doc, index: rst.index, related: related }
            })
            resolve({
              response: 'text',
              list: rst
            })
          }).catch(err => reject({ response: 'error', err: err.toString() }))
        }).catch(err => {
          reject({response: 'error', err: err.toString()})
        })
      }

      function responseSubjectOverflow (subject) {
        Promise.all([
            PastPaperDoc.aggregate([{$match: {subject}}, {$sort: {time: 1}}, {$group: {_id: '$time', count: {$sum: 1}}}]),
            PastPaperDoc.find({subject, type: {$in: PaperUtils.subjectMetaTypes}}, {dir: false})
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
