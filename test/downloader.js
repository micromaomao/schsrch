/* eslint-disable no-undef */

const fs = require('fs')
const path = require('path')
const downloadPapers = require('../downloaders/downloadpapers.js')

module.exports = function () {
  describe('Downloader', function () {
    const tmpDir = path.join(__dirname, 'downloader_tmp')

    before(function (done) {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir)
      }
      // Create a dummy file to test duplicate skipping
      fs.writeFileSync(path.join(tmpDir, 'existing.pdf'), 'dummy content')
      done()
    })

    after(function (done) {
      // Cleanup
      if (fs.existsSync(tmpDir)) {
        fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)))
        fs.rmdirSync(tmpDir)
      }
      done()
    })

    it('should skip duplicate downloads', function (done) {
      const options = { downloadDir: tmpDir, dlThreads: 1, quiet: true }

      // We mock req
      let reqCount = 0
      const req = function (opts, cb) {
        reqCount++
        // This shouldn't be called for existing.pdf
        cb(null, { statusCode: 200, request: { uri: { path: opts.url } } }, Buffer.from('new data'))
      }

      const queue = ['http://example.com/existing.pdf']

      downloadPapers(options, req, queue).then(() => {
        reqCount.should.equal(0) // Should skip the download completely
        const content = fs.readFileSync(path.join(tmpDir, 'existing.pdf'), 'utf8')
        content.should.equal('dummy content')
        done()
      }).catch(done)
    })

    it('should retry on failure and eventually fail', function (done) {
      this.timeout(10000)
      const options = { downloadDir: tmpDir, dlThreads: 1, quiet: true }

      let reqCount = 0
      const req = function (opts, cb) {
        reqCount++
        cb(new Error('Network Error'), null, null)
      }

      const queue = ['http://example.com/fail.pdf']

      downloadPapers(options, req, queue).then(() => {
        reqCount.should.equal(4) // 1 initial + 3 retries
        done()
      }).catch(done)
    })
  })
}
