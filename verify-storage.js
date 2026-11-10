#!/usr/bin/env node
const mongoose = require('mongoose')
const crypto = require('crypto')
const storage = require('./storage/index.js')
const { MONGODB: DB, ES } = process.env
const elasticsearch = require('elasticsearch')
const fs = require('fs')
const path = require('path')

if (!DB || !ES) {
  console.error('MONGODB and ES environment variables are required.')
  process.exit(1)
}

const db = mongoose.createConnection(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
})
const es = new elasticsearch.Client({ host: ES })

db.on('error', err => {
  console.error(err)
  process.exit(1)
})

async function findOrphanedFiles (dir, allRelativePaths) {
  const orphaned = {
    genuine: [],
    excluded: []
  }
  const files = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      const childOrphaned = await findOrphanedFiles(fullPath, allRelativePaths)
      orphaned.genuine.push(...childOrphaned.genuine)
      orphaned.excluded.push(...childOrphaned.excluded)
    } else {
      const relPath = path.relative(storage.root, fullPath)
      if (!allRelativePaths.has(relPath)) {
        // Check if intentionally excluded
        const fname = file.name.toLowerCase()
        if (fname.includes('_er.') || fname.includes('_gt.')) {
          orphaned.excluded.push(relPath)
        } else {
          orphaned.genuine.push(relPath)
        }
      }
    }
  }
  return orphaned
}

db.on('open', async () => {
  try {
    const { PastPaperDoc } = await require('./lib/dbModel.js')(db, es)

    console.log('--- Verification Phase ---')
    const docs = await PastPaperDoc.find({ relativePath: { $exists: true } })
    console.log(`Found ${docs.length} migrated documents.`)

    let verified = 0
    let failed = 0
    const missingFiles = []
    const hashMismatches = []

    const allRelativePaths = new Set()

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      process.stdout.write(`\rVerifying ${i + 1}/${docs.length}...`)

      allRelativePaths.add(doc.relativePath)

      try {
        const exists = await storage.exists(doc.relativePath)
        if (!exists) {
          missingFiles.push(doc)
          failed++
          continue
        }
        const data = await storage.read(doc.relativePath)
        const hash = crypto.createHash('sha256').update(data).digest('hex')
        if (hash !== doc.fileHash) {
          hashMismatches.push(doc)
          failed++
          continue
        }
        verified++
      } catch (e) {
        console.error(`\nError verifying ${doc._id}: ${e.message}`)
        failed++
      }
    }

    console.log('\nScanning for orphaned files in storage root...')
    const orphanedFiles = { genuine: [], excluded: [] }
    try {
      const result = await findOrphanedFiles(storage.root, allRelativePaths)
      orphanedFiles.genuine = result.genuine
      orphanedFiles.excluded = result.excluded
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log(`Storage root ${storage.root} does not exist yet.`)
      } else {
        console.error('Error scanning orphaned files:', e.message)
      }
    }

    console.log('\nVerification Report')
    console.log('===================')
    console.log(`Total Migrated Docs: ${docs.length}`)
    console.log(`Successfully Verified: ${verified}`)
    console.log(`Missing Files: ${missingFiles.length}`)
    console.log(`Hash Mismatches: ${hashMismatches.length}`)
    console.log(`Intentionally Excluded Files: ${orphanedFiles.excluded.length}`)
    console.log(`Genuine Orphaned Files: ${orphanedFiles.genuine.length}`)

    if (missingFiles.length > 0) {
      console.log('\nMissing Files Details:')
      missingFiles.slice(0, 10).forEach(d => console.log(` - ${d._id} expected at ${d.relativePath}`))
      if (missingFiles.length > 10) console.log(` ... and ${missingFiles.length - 10} more`)
    }

    if (hashMismatches.length > 0) {
      console.log('\nHash Mismatch Details:')
      hashMismatches.slice(0, 10).forEach(d => console.log(` - ${d._id} at ${d.relativePath}`))
      if (hashMismatches.length > 10) console.log(` ... and ${hashMismatches.length - 10} more`)
    }

    if (orphanedFiles.genuine.length > 0) {
      console.log('\nGenuine Orphaned Files Details:')
      orphanedFiles.genuine.slice(0, 10).forEach(f => console.log(` - ${f}`))
      if (orphanedFiles.genuine.length > 10) console.log(` ... and ${orphanedFiles.genuine.length - 10} more`)
    }

    process.exit((failed > 0 || orphanedFiles.genuine.length > 0) ? 1 : 0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})
