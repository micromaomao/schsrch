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

module.exports = {
  roundRect: function (rect) {
    function round (n) {
      return Math.round(n * 100) / 100
    }
    rect.x1 = round(rect.x1)
    rect.x2 = round(rect.x2)
    rect.y1 = round(rect.y1)
    rect.y2 = round(rect.y2)
    return rect
  },
  preCache: function (result, callback) {
    result.rects = result.rects.map(this.roundRect)
    let svg = result.svg.toString('utf-8')
    svgo.optimize(svg).then(rSvgo => {
      let svgText = rSvgo.data
      result.svg = svgText
      let viewBoxStr = svgText.match(/viewBox="0 0 ([\d\.]+) ([\d\.]+)"/)
      if (!viewBoxStr) {
        callback(result)
      } else {
        // hack
        let [width, height] = Array.prototype.slice.call(viewBoxStr, 1).map(parseFloat)
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
          callback(result)
        } else {
          result.svg = svgText.replace(/width="[0-9a-zA-Z\.]{1,10}" height="[0-9a-zA-Z\.]{1,10}"/, `width="${width}" height="${height}"`).replace(/ ?viewBox="0 0 [\d\.]+ [\d\.]+"/, '')
          callback(result)
        }
      }
    }, err => callback(Object.assign(result, {
      svg
    })))
  },
  getPage: sspdf.getPage.bind(sspdf)
}
