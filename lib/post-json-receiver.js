const express = require('express')
let jsonMiddlew = express.json({
  limit: 15000000,
  strict: true
})
module.exports = function (req, res, next, callback) {
  jsonMiddlew(req, res, function (err) {
    if (err) {
      next(err)
      return
    }
    let parsed = req.body
    if (typeof parsed !== 'object') {
      res.status(403)
      res.send(`Content is not a valid JSON object. (got ${typeof parsed})`)
      return
    }
    callback(parsed)
  })
}
