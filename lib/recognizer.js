const rbush = require('rbush')
const sspdf = require('./sspdf.js')

module.exports = {
  meaningfulDir: function (dir) {
    if (!dir) return false
    if (dir.type && dir.type !== 'questions') return true
    if (dir.type === 'questions' && Array.isArray(dir.dirs) && dir.dirs.length > 0) return true
    return false
  },
  dirFilterPage: function (dir, page) {
    if (dir.type === 'questions') return { type: 'questions', dirs: dir.dirs.filter(x => x.page === page) }
    return dir
  },
  noRectsLeftOf: function (rTree, rects) {
    if (rects.length === 0) throw new Error('rects.length === 0')
    if (typeof rects[0].y1 !== 'number') throw new Error('Number.isNumber rects[0].y1 === false')
    if (typeof rTree.all()[0].t !== 'string') throw new Error('rTree[].t should be the text for that rects.')
    let rectsLeftOf = rTree.search({
      minX: -Infinity, maxX: Math.min(rects[0].x1, rects[0].x2) - 0.1,
      minY: Math.min(rects[0].y1, rects[0].y2) - 4, maxY: Math.max(rects[0].y1, rects[0].y2) + 4
    })
    if (!rectsLeftOf.every(r => /^\s$/.test(r.t))) { // `every` returns true for []
      return false
    }
    return true
  },
  sortRects: function (idx) {
    let rects = idx.rects.map((r, i) => Object.assign({}, r, {t: idx.content[i]}))
    if (rects.length === 0) return []
    rects = rects.sort((rA, rB) => Math.sign(rA.y2 - rB.y2))
    let yBuckets = []
    for (let r of rects) {
      let lastBucket = null
      if (yBuckets.length > 0) {
        lastBucket = yBuckets[yBuckets.length - 1]
      }
      if (!lastBucket || Math.abs(r.y2 - lastBucket[0].y2) > 0.1) {
        yBuckets.push([r])
      } else {
        lastBucket.push(r)
      }
    }
    yBuckets = yBuckets.map(busket => busket.sort((rA, rB) => Math.sign(rA.x1 - rB.x1)))
    let sortedRects = yBuckets.reduce((a, b) => a.concat(b))
    let sortedContent = sortedRects.map(r => r.t).join('')
    return {sortedRects, sortedContent}
  },
  dir: function (idxes) {
    if (idxes.length === 0) return {}
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
    let xLimit = 150
    let doSearch = (fromII = 0) => {
      if (fromII >= idxes.length) return
      idxes.slice(fromII).forEach((idx, ii) => {
        ii += fromII
        if (idx.page === 0) { // Cover page
          return
        }
        let {sortedRects, sortedContent} = this.sortRects(idx)
        let rTree = rbush(sortedRects.length)
        rTree.load(sortedRects.map((rect, i) => ({minX: rect.x1, minY: rect.y1, maxX: rect.x2, maxY: rect.y2, i, t: sortedContent[i]})))
        let search = nextQuestionNum.toString()
        for (let lastIndex = 0; (lastIndex = sortedContent.indexOf(search, lastIndex)) >= 0; lastIndex += search.length) {
          let frontRect = sortedRects[lastIndex]
          let rects = sortedRects.slice(lastIndex, lastIndex + search.length)
          if (frontRect.x1 < xLimit && this.noRectsLeftOf(rTree, rects)
            && /^(\([ai]+\))*\s/.test(sortedContent.substr(lastIndex + nextQuestionNum.toString().length))) {
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
              qNRect: sspdf.roundRect({x1: frontRect.x1, x2: lastQNRect.x2, y1: Math.min(frontRect.y1, lastQNRect.y1), y2: Math.max(frontRect.y2, lastQNRect.y2)})
            })
            xLimit = Math.min(xLimit, frontRect.x2 + Math.abs(frontRect.x2 - frontRect.x1) * 6)
            nextQuestionNum ++
            search = nextQuestionNum.toString()
            lastValidII = ii
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
    return { dirs: dirs, type: 'questions' }
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
    return { dirs: answers, type: 'mcqMs' }
  },
  noRectsRightOf: function (rTree, rects) {
    if (rects.length === 0) throw new Error('rects.length === 0')
    if (typeof rects[0].y1 !== 'number') throw new Error('Number.isNumber rects[0].y1 === false')
    if (typeof rTree.all()[0].t !== 'string') throw new Error('rTree[].t should be the text for that rects.')
    let upperY = Math.min(rects[0].y1, rects[0].y2)
    let lowerY = Math.max(rects[0].y1, rects[0].y2)
    let height = lowerY - upperY
    let rectsRightOf = rTree.search({
      minX: Math.max(rects[rects.length - 1].x1, rects[rects.length - 1].x2) + 0.5, maxX: Infinity,
      minY: upperY + height / 2 - height / 8, maxY: lowerY - height / 2 + height / 8
    })
    if (!rectsRightOf.every(r => /^\s$/.test(r.t))) { // `every` returns true for []
      return false
    }
    return true
  },
  er: function (idxes) {
    let papers = []
    let lastPv = '00'
    for (idx of idxes) {
      let rTree = rbush(idx.rects.length)
      rTree.load(idx.rects.map((r, i) => ({minX: Math.min(r.x1, r.x2), maxX: Math.max(r.x1, r.x2), minY: Math.min(r.y1, r.y2), maxY: Math.max(r.y1, r.y2), idx: i, t: idx.content[i]})))
      if (papers.length > 0) {
        let lastPaper = papers[papers.length - 1]
        if (lastPaper.idxes[lastPaper.idxes.length - 1] !== idx) {
          lastPaper.idxes.push({
            rects: idx.rects,
            content: idx.content,
            page: idx.page,
            rTree
          })
        }
      }
      for (let pPaperStr = 0; (pPaperStr = idx.content.indexOf('Paper', pPaperStr)) >= 0; pPaperStr += 8) {
        let paperStr = idx.content.substr(pPaperStr)
        if (/^Paper \d\d\s/.test(paperStr)) {
          let rects = idx.rects.slice(pPaperStr, pPaperStr + 8) // "Paper 11".length === 8
          if (rects.length !== 8) continue
          let baselineY = rects[0].y2
          if (!rects.every(r => Math.abs(r.y2 - baselineY) < 0.1)) continue
          if (!this.noRectsRightOf(rTree, rects)) continue
          let newPv = paperStr.substr(6, 2)
          if (parseInt(newPv[0]) > parseInt(lastPv[0]) || parseInt(newPv[1]) > parseInt(lastPv[1])) {
            lastPv = newPv
            papers.push({
              pv: newPv,
              idxes: [{
                rects: idx.rects,
                content: idx.content,
                page: idx.page,
                rTree
              }]
            })
          }
        }
      }
    }
    return { papers: papers.map(this.erDoOnePaper.bind(this)), type: 'er' }
  },
  erDoOnePaper: function ({pv, idxes}) {
    let nextQuestionNum = 'GC'
    let search = 'general comments'
    // For why case-insensitive searching is needed, see 9709 w11 er page 28. There is General Comments instead of General comments.
    let dirs = []
    for (let idx of idxes) {
      let {sortedRects, sortedContent} = this.sortRects(idx)
      for (let lastIndex = 0; (lastIndex = sortedContent.toLowerCase().indexOf(search, lastIndex)) >= 0; lastIndex += search.length) {
        let text = sortedContent.substr(lastIndex)
        if (/^\s/.test(text.substr(search.length))) { // followed by space
          let rects = sortedRects.slice(lastIndex, lastIndex + search.length)
          let baselineY = rects[0].y2
          if (!rects.every(r => Math.abs(r.y2 - baselineY) < 0.1)) continue
          if (!this.noRectsRightOf(idx.rTree, rects)) continue
          let frect = rects[0]
          let lrect = rects[rects.length - 1]
          dirs.push({
            qN: nextQuestionNum,
            page: idx.page,
            qNRect: sspdf.roundRect({x1: frect.x1, x2: lrect.x2, y1: Math.min(frect.y1, lrect.y1), y2: Math.max(frect.y2, lrect.y2)})
          })
          if (nextQuestionNum === 'GC') nextQuestionNum = 1
          else nextQuestionNum++
          search = `question ${nextQuestionNum}`
        }
      }
    }
    return {pv, dirs}
  }
}
