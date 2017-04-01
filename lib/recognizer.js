module.exports = {
  dir: function (idxes) {
    // Can safely assume idxes.rects contains the rects data
    let dirs = []
    let nextQuestionNum = 1
    idxes.forEach(idx => {
      if (idx.page === 0) { // Cover page
        return
      }
      let nqn = nextQuestionNum.toString()
      for (let lastIndex = 0; (lastIndex = idx.content.indexOf(nqn, lastIndex)) >= 0; lastIndex += nqn.length) {
        let rect = idx.rects[lastIndex]
        if (/^\s$/.test(idx.content[lastIndex - 1]) && /^\s$/.test(idx.content[lastIndex + nqn.length])) {
          let thisRect = idx.rects[lastIndex]
          if (thisRect.x1 <= 80 && thisRect.x2 <= 100) {
            let qT = ''
            for (let qTuntil = lastIndex + nqn.length + 1; qTuntil < idx.content.length; qTuntil ++) {
              if (Math.abs(idx.rects[qTuntil].y1 - thisRect.y1) < 20) {
                qT += idx.content[qTuntil]
              }
            }
            qT = qT.replace(/\n/g, ' ').trim()
            dirs.push({
              qN: nextQuestionNum,
              page: idx.page,
              qT
            })
            nextQuestionNum ++
            nqn = nextQuestionNum.toString()
          }
        }
      }
    })
    return dirs
  }
}
