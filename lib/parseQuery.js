const PaperUtils = require('../view/paperutils.js')

function constructQuery (subject, time, paper, variant, type) {
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
  return {
    finder,
    queryParsed: {subject, time, paper, variant, type}
  }
}

module.exports = function (query) {
  let lQuery = query.toLowerCase()
  if (query.trim().length === 0) {
    return constructQuery()
  }
  if (lQuery.match(/^\d{4}$/)) {
    return constructQuery(lQuery, null, null, null, null)
  } else if ((match = lQuery.match(/^(\d{4})([_ ]|[_ ]*pa?p?e?r?)[_ ]*(\d)$/))) { // 06101 seems like a typo, so don't misunderstand.
    return constructQuery(match[1], null, match[3], null, null)
  } else if ((match = lQuery.match(/^(\d{4})([_ ]|[_ ]*pa?p?e?r?)[_ ]*(\d)[_ ]*(\d)$/))) { // 061011 as well
    return constructQuery(match[1], null, match[3], match[4], null)
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})$/))) {
    return constructQuery(match[1], match[2])
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]{2})$/))) {
    return constructQuery(match[1], null, null, null, match[2])
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})$/))) {
    return constructQuery(match[1], match[2], null, null, match[3])
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*(p?a?p?e?r?[_ ]*)?(\d)$/))) {
    return constructQuery(match[1], match[2], match[4], null, null)
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*(p?a?p?e?r?[_ ]*)?(\d)[_ ]*(\d)$/))) {
    return constructQuery(match[1], match[2], match[4], match[5], null)
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})[_ ]*p?a?p?e?r?[_ ]*(\d)\.?p?d?f?$/))) {
    return constructQuery(match[1], match[2], match[4], null, match[3])
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})[_ ]*([a-z]{2})[_ ]*p?a?p?e?r?[_ ]*(\d)[_ ]*(\d)\.?p?d?f?$/))) {
    return constructQuery(match[1], match[2], match[4], match[5], match[3])
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})([_ ]*p?a?p?e?r?[_ ]*)(\d)[_ ]*([a-z]{2})$/))) {
    return constructQuery(match[1], match[2], match[4], null, match[5])
  } else if ((match = lQuery.match(/^(\d{4})[_ ]*([a-z]\d{1,2})([_ ]*p?a?p?e?r?[_ ]*)(\d)[_ ]*(\d)[_ ]*([a-z]{2})$/))) {
    return constructQuery(match[1], match[2], match[4], match[5], match[6])
  } else if ((match = query.toUpperCase().match(/^(\d{4})\/(\d{2})\/([A-Z]\/?[A-Z]|SP)\/(\d{2})$/))) {
    let month = PaperUtils.odashMonthToMyMonth(match[3])
    let time = month + match[4]
    let [paper, variant] = match[2].split('')
    return constructQuery(match[1], time, paper, variant, null)
  } else {
    return null
  }
}
