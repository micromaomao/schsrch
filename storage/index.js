const path = require('path')
const FileSystemStorage = require('./filesystem')

const config = {
  backend: process.env.STORAGE_BACKEND || 'filesystem',
  root: process.env.STORAGE_ROOT || path.join(__dirname, '../papers_download')
}

let storageBackend = null

if (config.backend === 'filesystem') {
  storageBackend = new FileSystemStorage(config.root)
} else {
  throw new Error(`Unsupported storage backend: ${config.backend}`)
}

module.exports = storageBackend
