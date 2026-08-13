/* eslint-disable prefer-const */
if (typeof window !== 'undefined' && window.document) {
  let pPdfjsLib = import('pdfjs-dist/build/pdf.mjs').then(pdfjsLib => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/resources/pdfjs/pdf.worker.mjs';
    window.pdfjsLib = pdfjsLib;
    return pdfjsLib;
  });

  module.exports = (src, onLoadTaskReceived = null) => {
    return pPdfjsLib.then(pdfjsLib => {
      let loadTask = pdfjsLib.getDocument(src)
      if (onLoadTaskReceived) {
        onLoadTaskReceived(loadTask)
      }
      return loadTask.promise
    })
  }
} else {
  module.exports = null
}
