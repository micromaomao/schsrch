const rbush = require('rbush')
const sspdf = require('./sspdf.js')

module.exports = {
  dir: function (idxes) {
    if (idxes.length === 0) return []
    if (/Multiple Choice/i.test(idxes[0].content) && /MARK SCHEME/i.test(idxes[0].content)) {
      return this.mcqMs(idxes)
    }
    if (/Examiner Report/i.test(idxes[0].content) && /General comments/i.test(idxes[0].content)) {
      return this.er(idxes)
    }
    // Can safely assume idxes.rects contains the rects data
    let dirs = []
    let nextQuestionNum = 1
    let lastValidII = -1
    let xLimit = 90
    function doSearch (fromII = 0) {
      if (fromII >= idxes.length) return
      idxes.slice(fromII).forEach((idx, ii) => {
        ii += fromII
        if (idx.page === 0) { // Cover page
          return
        }
        let assumedWidth = 2000
        let sortedRects = idx.rects.map((r, i) => Object.assign({}, r, {t: idx.content[i]})).sort((rA, rB) => {
          return Math.sign((rA.y2*assumedWidth+rA.x1) - (rB.y2*assumedWidth+rB.x1)) // Using y2 because of the behavior of newline rects.
        })
        let sortedContent = sortedRects.map(r => r.t).join('')
        let rTree = rbush(sortedRects.length)
        rTree.load(sortedRects.map((rect, i) => ({minX: rect.x1, minY: rect.y1, maxX: rect.x2, maxY: rect.y2, i})))
        for (let lastIndex = 0; (lastIndex = sortedContent.indexOf(nextQuestionNum.toString(), lastIndex)) >= 0; lastIndex += nextQuestionNum.toString().length) {
          let rect = sortedRects[lastIndex]
          if (/^\s$/.test(sortedContent[lastIndex - 1]) // '\s' preceding.
            && /^(\([a-z]+\))*\s/.test(sortedContent.substr(lastIndex + nextQuestionNum.toString().length))) {
            let thisRect = sortedRects[lastIndex]
            if (thisRect.x1 <= xLimit && thisRect.x2 <= xLimit + 20) {
              let qT = ''
              let lastQNRect = sortedRects[lastIndex + nextQuestionNum.toString().length - 1]
              rTree.search({
                minX: lastQNRect.x2 + 1,
                maxX: Infinity,
                minY: lastQNRect.y1 - 10,
                maxY: lastQNRect.y2 + 10
              }).sort((a, b) => Math.sign(a.i - b.i)).forEach(rect => {
                qT += sortedContent[rect.i]
              })
              qT = qT.replace(/\n/g, ' ').trim()
              dirs.push({
                qN: nextQuestionNum,
                page: idx.page,
                qT,
                qNRect: sspdf.roundRect({x1: thisRect.x1, x2: lastQNRect.x2, y1: Math.min(thisRect.y1, lastQNRect.y1), y2: Math.max(thisRect.y2, lastQNRect.y2)})
              })
              xLimit = Math.min(xLimit, thisRect.x1 + (thisRect.x2 - thisRect.x1))
              nextQuestionNum ++
              lastValidII = ii
            }
          }
        }
      })
      if (lastValidII !== -1 && lastValidII < idxes.length - 1 && nextQuestionNum !== 1) {
        // Restart search from question 1 for the remaining unmatched papers. Useful for things like IG history paper 2.
        nextQuestionNum = 1
        doSearch(lastValidII + 1)
      }
    }
    doSearch()
    return { dirs: dirs }
  },
  mcqMs: function (idxes) {
    let answers = []
    if (idxes.length < 2) return []
    let rTrees = idxes.map(idx => {
      if (idx.page === 0) {
        // Cover page
        return null
      }
      let rTree = rbush(idx.rects.length)
      rTree.load(idx.rects.map((rect, i) => ({minX: rect.x1, minY: rect.y1, maxX: rect.x2, maxY: rect.y2, i})))
      return rTree
    })
    let nextQuestionNum = 1
    function doSearch (currentPage) {
      let rTree = rTrees[currentPage]
      let idx = idxes[currentPage]
      let doItAgain = false
      for (let lastIndex = 0; (lastIndex = idx.content.indexOf(nextQuestionNum.toString(), lastIndex)) >= 0; lastIndex += nextQuestionNum.toString().length) {
        let thisRect = idx.rects[lastIndex]
        let lastRect = idx.rects[lastIndex + nextQuestionNum.toString().length - 1]
        if (/^\s$/.test(idx.content[lastIndex - 1]) && /^\s$/.test(idx.content[lastIndex + nextQuestionNum.toString().length])) {
          let tss = rTree.search({
            minX: lastRect.x2 + 1,
            maxX: Infinity,
            minY: lastRect.y1,
            maxY: lastRect.y2
          }).filter(x => !/^\s+$/.test(idx.content[x.i]))
          let lastNearest = null
          tss.forEach(rect => {
            if (lastNearest === null || rect.maxX < lastNearest.maxX) {
              lastNearest = rect
            }
          })
          let lt = lastNearest !== null ? idx.content[lastNearest.i] : null
          if (lastNearest === null || !/^[A-Z]$/.test(lt)) continue
          answers.push({
            qN: nextQuestionNum,
            page: idx.page,
            qT: lt,
            qNRect: sspdf.roundRect({x1: thisRect.x1, x2: lastNearest.maxX, y1: Math.min(thisRect.y1, lastNearest.minY), y2: Math.max(thisRect.y2, lastNearest.maxY)})
          })
          nextQuestionNum ++
          doItAgain = true
        }
      }
      if (doItAgain) doSearch(currentPage)
    }
    for (let currentPage = 1; currentPage < idxes.length; currentPage ++) {
      doSearch(currentPage)
    }
    return { mcqMs: true, dirs: answers }
  },
  er: function (idxes) {
    let papers = []
    let lastPv = '00'
    for (let pageI = 0; pageI < idxes.length; pageI ++) {
      let idx = idxes[pageI]
      if (papers.length > 0) {
        let lastPaper = papers[papers.length - 1]
        if (lastPaper.idxes[lastPaper.idxes.length - 1] !== idx) {
          lastPaper.idxes.push(idx)
        }
      }
      let rTree = rbush(idx.rects.length)
      rTree.load(idx.rects.map((r, i) => ({minX: Math.min(r.x1, r.x2), maxX: Math.max(r.x1, r.x2), minY: Math.min(r.y1, r.y2), maxY: Math.max(r.y1, r.y2), idx: i, t: idx.content[i]})))
      for (let pPaperStr = 0; (pPaperStr = idx.content.indexOf('Paper', pPaperStr)) >= 0; pPaperStr += 8) {
        let paperStr = idx.content.substr(pPaperStr)
        if (/^Paper \d\d\s/.test(paperStr)) {
          let rects = idx.rects.slice(pPaperStr, pPaperStr + 8) // "Paper 11".length === 8
          if (rects.length !== 8) continue
          let baselineY = rects[0].y2
          if (!rects.every(r => Math.abs(r.y2 - baselineY) < 0.1)) continue
          let rectsRightOf = rTree.search({
            minX: rects[7].maxX + 0.5, maxX: Infinity,
            minY: Math.min(rects[0].y1, rects[0].y2) - 4, maxY: Math.max(rects[0].y1, rects[0].y2) + 4
          })
          if (!rectsRightOf.every(r => /^\s$/.test(r.t))) { // `every` returns true for []
            continue
          }
          let newPv = paperStr.substr(6, 2)
          if (parseInt(newPv[0]) > parseInt(lastPv[0]) || parseInt(newPv[1]) > parseInt(lastPv[1])) {
            lastPv = newPv
            papers.push({
              pv: newPv,
              idxes: [idx]
            })
          }
        }
      }
    }
    return {er: true, papers: papers.map(p => ({pv: p.pv, pages: p.idxes.map(i => i.page)}))}
  }
}
