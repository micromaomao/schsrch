module.exports = function (req, res, next, callback) {
  let ctype = req.get('Content-Type')
  let done = false
  if (ctype !== 'application/json') {
    res.status(415)
    res.send('Content type incorrect.')
    done = true
    return
  }
  let body = ''
  req.setEncoding('utf8')
  req.on('data', chunk => {
    if (done) return
    if (body.length + chunk.length > 15000000) {
      // 15 MiB
      res.status(413)
      res.send('Content too long.')
      done = true
      return
    }
    body += chunk
  })
  req.on('end', () => {
    if (done) return
    done = true
    body = body.trim()
    if (body.length === 0) {
      res.status(403)
      res.send('Content is empty.')
      return
    }
    let parsed = null
    try {
      parsed = JSON.parse(body)
      if (typeof parsed !== 'object') {
        throw new Error()
      }
    } catch (e) {
      res.status(403)
      res.send('Content is not a valid JSON object.')
      return
    }
    callback(parsed)
  })
}
