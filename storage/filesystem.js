const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

class FileSystemStorage {
  constructor (rootPath) {
    this.root = path.resolve(rootPath)
  }

  getAbsPath (relativePath) {
    if (!relativePath) throw new Error('relativePath is required')
    const absolutePath = path.resolve(this.root, relativePath)
    if (!absolutePath.startsWith(this.root)) {
      throw new Error('Path traversal detected')
    }
    return absolutePath
  }

  /**
   * Atomically save a buffer to the filesystem.
   * Calculates and returns the SHA256 hash.
   */
  async save (relativePath, buffer) {
    const absPath = this.getAbsPath(relativePath)
    const dir = path.dirname(absPath)

    // Ensure directory exists
    await fs.promises.mkdir(dir, { recursive: true })

    // Calculate hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')

    // Write to a temporary file, then rename for atomic write
    const tempPath = `${absPath}.part.${crypto.randomBytes(6).toString('hex')}`

    try {
      await fs.promises.writeFile(tempPath, buffer)

      // Verify the write succeeded (basic size check)
      const stats = await fs.promises.stat(tempPath)
      if (stats.size !== buffer.length) {
        throw new Error(`Write verification failed. Expected ${buffer.length} bytes, got ${stats.size}`)
      }

      await fs.promises.rename(tempPath, absPath)
    } catch (err) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempPath)
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
      throw err
    }

    return hash
  }

  async read (relativePath) {
    const absPath = this.getAbsPath(relativePath)
    return fs.promises.readFile(absPath)
  }

  async exists (relativePath) {
    const absPath = this.getAbsPath(relativePath)
    try {
      await fs.promises.access(absPath, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  async delete (relativePath) {
    const absPath = this.getAbsPath(relativePath)
    try {
      await fs.promises.unlink(absPath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}

module.exports = FileSystemStorage
