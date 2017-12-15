const rbush = require('rbush')
const sspdf = require('./sspdf.js')

module.exports = {
  dir: function (idxes) {
    if (idxes.length === 0) return []
    if (/Multiple Choice/i.test(idxes[0].content) && /MARK SCHEME/i.test(idxes[0].content)) {
      return this.mcqMs(idxes)
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
        let rTree = rbush(idx.rects.length)
        rTree.load(idx.rects.map((rect, i) => ({minX: rect.x1, minY: rect.y1, maxX: rect.x2, maxY: rect.y2, i})))
        for (let lastIndex = 0; (lastIndex = idx.content.indexOf(nextQuestionNum.toString(), lastIndex)) >= 0; lastIndex += nextQuestionNum.toString().length) {
          let rect = idx.rects[lastIndex]
          if (/^\s$/.test(idx.content[lastIndex - 1]) // '\s' preceding.
            && /^(\([a-z]+\))*\s/.test(idx.content.substr(lastIndex + nextQuestionNum.toString().length))) {
            let thisRect = idx.rects[lastIndex]
            if (thisRect.x1 <= xLimit && thisRect.x2 <= xLimit + 20) {
              let qT = ''
              let lastQNRect = idx.rects[lastIndex + nextQuestionNum.toString().length - 1]
              rTree.search({
                minX: lastQNRect.x2 + 1,
                maxX: Infinity,
                minY: lastQNRect.y1 - 10,
                maxY: lastQNRect.y2 + 10
              }).sort((a, b) => Math.sign(a.i - b.i)).forEach(rect => {
                qT += idx.content[rect.i]
              })
              qT = qT.replace(/\n/g, ' ').trim()
              dirs.push({
                qN: nextQuestionNum,
                page: idx.page,
                qT,
                qNRect: sspdf.roundRect({x1: thisRect.x1, x2: lastQNRect.x2, y1: Math.min(thisRect.y1, lastQNRect.y1), y2: Math.max(thisRect.y2, lastQNRect.y2)})
              })
              xLimit = Math.min(xLimit, thisRect.x1 + (thisRect.x2 - thisRect.x1) / 2)
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
  }
}
