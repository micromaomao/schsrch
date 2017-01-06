const fs = require('fs')
const lwip = require('lwip')
const path = require('path')
const loaderUtils = require("loader-utils")
const wpConfig = require('../webpack.config')

module.exports = function (content) {
  let callback = this.async()
  if (!callback) throw new Error('Async needed.')

  if (typeof content !== 'string') content = content.toString('utf-8')

  this.cacheable && this.cacheable()
  // let wpPublicPath = this.exec('module.exports = __webpack_public_path__', this.resourcePath)
  let wpPublicPath = wpConfig.output.publicPath

  const logoPath = path.join(__dirname, '../view/icon.png')
  const openLogo = () => new Promise((resolve, reject) => {
    lwip.open(logoPath, (err, logoImg) => {
      if (err) reject(err)
      else resolve(logoImg)
    })
  })
  let manifest = JSON.parse(content)
  this.addDependency(logoPath)
  let resizePromises = manifest.icons.map(icon => {
    let [sW, sH] = icon.sizes.split('x').map(n => parseInt(n)) // map call the function with two args and parseInt treats the second arg as base.
    let ext = icon.type.split('/')[1]
    return openLogo().then(logoImg => new Promise((resolve, reject) => {
      logoImg.resize(sW, sH, (err, img) => {
        if (err) reject(err)
        else resolve(img)
      })
    })).then(img => new Promise((resolve, reject) => {
      img.toBuffer(ext, { compression: 'high' }, (err, buffer) => {
        if (err) reject(err)
        else resolve({
          data: buffer,
          sizes: icon.sizes,
          type: icon.type,
          ext
        })
      })
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
    callback(null, 'module.exports = ' + JSON.stringify({
      manifest: jsonPubUrl,
      icons: nIcons
    }))
  }, err => callback(err))
}
