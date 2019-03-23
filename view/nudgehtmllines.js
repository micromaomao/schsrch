function getHeight (nudger) {
  return parseFloat(window.getComputedStyle(nudger).height)
}

export default function (html, nudger) {
  html = html.trim()
  if (html.length === 0) return []
  let lines = []
  let testLineNum = 20
  nudger.innerHTML = 'l<br>'.repeat(testLineNum)
  let lineHeight = getHeight(nudger) / testLineNum
  let words = html.match(/\S+(\s*|&nbsp;)/g)
  let lastHeight = lineHeight
  nudger.innerHTML = ''
  for (let i = 0; i < words.length; i ++) {
    nudger.innerHTML += words[i]
    let nh = getHeight(nudger)
    if (nh > lastHeight + (lineHeight / 2)) {
      lines.push(words[i])
      lastHeight = nh
    } else {
      if (lines.length > 0) {
        lines[lines.length - 1] += words[i]
      } else {
        lines.push(words[i])
      }
    }
  }
  return lines
}
