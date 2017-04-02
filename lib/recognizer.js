const rbush = require('rbush')

module.exports = {
  dir: function (idxes) {
    if (idxes.length === 0) return []
    if (idxes.length === 2 && /Multiple Choice/i.test(idxes[0].content) && /MARK SCHEME/i.test(idxes[0].content)) {
      return this.mcqMs(idxes[1])
    }
    // Can safely assume idxes.rects contains the rects data
    let dirs = []
    let nextQuestionNum = 1
    let lastValidII = -1
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
          if (/^\s$/.test(idx.content[lastIndex - 1]) && /^\s$/.test(idx.content[lastIndex + nextQuestionNum.toString().length])) {
            let thisRect = idx.rects[lastIndex]
            if (thisRect.x1 <= 80 && thisRect.x2 <= 100) {
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
                qT
              })
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
    return dirs
  },
  mcqMs: function (idx) {
    if (idx.page !== 1) return []
    let answers = []
    let rTree = rbush(idx.rects.length)
    rTree.load(idx.rects.map((rect, i) => ({minX: rect.x1, minY: rect.y1, maxX: rect.x2, maxY: rect.y2, i})))
    let nextQuestionNum = 1
    function doSearch () {
      let doItAgain = false
      for (let lastIndex = 0; (lastIndex = idx.content.indexOf(nextQuestionNum.toString(), lastIndex)) >= 0; lastIndex += nextQuestionNum.toString().length) {
        let rect = idx.rects[lastIndex]
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
          let lt = idx.content[lastNearest.i]
          if (lastNearest === null || !/^[A-Z]$/.test(lt)) continue
          answers.push(lt)
          nextQuestionNum ++
          doItAgain = true
        }
      }
      if (doItAgain) doSearch()
    }
    doSearch()
    return answers.map((a, qN) => {
      qN += 1
      return {
        qN,
        page: idx.page,
        qT: a
      }
    })
  }
}
