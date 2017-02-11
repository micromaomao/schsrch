const SVGO = require('svgo')
const svgo = new SVGO()

let sspdf;

try {
  sspdf = require('../build/Debug/sspdf')
} catch (e) {
  try {
    sspdf = require('../build/Release/sspdf')
  } catch (e) {
    throw e
  }
}

module.exports = Object.assign(sspdf, {
  preCache: (result, callback) => {
    result.rects = result.rects.map(rect => {
      function round (n) {
        return Math.round(n * 100) / 100
      }
      rect.x1 = round(rect.x1)
      rect.x2 = round(rect.x2)
      rect.y1 = round(rect.y1)
      rect.y2 = round(rect.y2)
      return rect
    })
    let svg = result.svg.toString('utf-8')
    svgo.optimize(svg, rSvgo => {
      result.svg = rSvgo.data
      callback(result)
    })
  }
})
