if (typeof window !== 'undefined' && window.document) {
  const pdfjsUrl = '/resources/pdfjs/pdf.min.js'

  let pPdfjsLib = new Promise((resolve, reject) => {
    let scriptTag = document.createElement('script')
    scriptTag.src = pdfjsUrl
    scriptTag.addEventListener('load', function (evt) {
      let p = window['pdfjs-dist/build/pdf']

      if (!p) {
        reject(new Error('pdfjs failed to load.'))
      } else {
        resolve(p)
      }
    })
    document.body.appendChild(scriptTag)
  })

  module.exports = (src, onLoadTaskReceived) => {
    return pPdfjsLib.then(pdfjsLib => {
      let loadTask = pdfjsLib.getDocument(src)
      onLoadTaskReceived(loadTask)
      return loadTask
    })
  }
} else {
  module.exports = null
}
