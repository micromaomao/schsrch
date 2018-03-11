const fs = require('fs')
const sharp = require('sharp')
const path = require('path')
const loaderUtils = require("loader-utils")
const wpConfig = require('../webpack.config')

module.exports = function (content) {
  let callback = this.async()
  if (!callback) throw new Error('Async needed.')

  if (typeof content !== 'string') content = content.toString('utf-8')

  this.cacheable && this.cacheable()
  // let wpPublicPath = this.exec('module.exports = __webpack_public_path__', this.resourcePath)
  let wpPublicPath = wpConfig[0].output.publicPath

  const logoPath = path.join(__dirname, '../view/icon.svg')
  this.addDependency(logoPath)
  fs.readFile(logoPath, {encoding: null}, (err, data) => {
    if (err) {
      callback(err)
    } else {
      readedLogo(data)
    }
  })

  let readedLogo = (logoBuffer) => {
    let manifest = JSON.parse(content)
    let resizePromises = manifest.icons.map(icon => {
      if (icon.type === 'image/svg+xml') {
        return Promise.resolve({
          data: logoBuffer,
          sizes: icon.sizes,
          type: icon.type,
          ext: 'svg'
        })
      }
      let [sW, sH] = icon.sizes.split('x').map(n => parseInt(n)) // map call the function with two args and parseInt treats the second arg as base.
      let ext = icon.type.split('/')[1]
      return sharp(logoBuffer).resize(sW, sH).toFormat(ext, {compressionLevel: 9}).toBuffer().then(buffer => Promise.resolve({
          data: buffer,
          sizes: icon.sizes,
          type: icon.type,
          ext
        }))
    })
    Promise.all(resizePromises).then(icons => {
      let nIcons = icons.map(icon => {
        let fileName = loaderUtils.interpolateName(this, `[hash].${icon.ext}`, {
          content: icon.data
        })
        this.emitFile(fileName, icon.data)
        let pubUrl = wpPublicPath + fileName
        return {
          src: pubUrl,
          sizes: icon.sizes,
          type: icon.type
        }
      })
      let jsonContent = JSON.stringify(Object.assign({}, manifest, {icons: nIcons}))
      let jsonFileName = loaderUtils.interpolateName(this, `[hash].json`, {
        content: jsonContent
      })
      this.emitFile(jsonFileName, jsonContent)
      let jsonPubUrl = wpPublicPath + jsonFileName
      callback(null, JSON.stringify({
        manifest: jsonPubUrl,
        icons: nIcons
      }))
    }, err => callback(err))
  }
}
