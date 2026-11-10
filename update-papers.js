#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const DOWNLOAD_DIR = path.join(__dirname, 'papers_download')
const SCRIPT_PAPACAMBRIDGE = path.join(__dirname, 'downloaders', 'pastpapers.papacambridge.com.js')
const SCRIPT_DOINDEX = path.join(__dirname, 'doIndex.bin.js')

// Create download directory if it doesn't exist
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR)
}

const args = process.argv.slice(2)
const startUrl = args[0] || 'https://pastpapers.papacambridge.com/?dir=Cambridge%20International%20Examinations%20%28CIE%29/IGCSE/Physics%20%280625%29'

console.log(`Starting paper update process for ${startUrl}...`)

function runCommand (command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    console.log(`> node ${args.join(' ')}`)
    const proc = spawn('node', args, { env, stdio: 'inherit' })
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with exit code ${code}`))
    })
  })
}

async function runUpdate () {
  try {
    console.log('\n--- PHASE 1: DOWNLOADING ---')
    // Using 4 threads by default
    await runCommand('node', [SCRIPT_PAPACAMBRIDGE, '--download-threads=4', startUrl, DOWNLOAD_DIR])

    console.log('\n--- PHASE 2: INDEXING ---')
    // MONGODB and ES environment variables need to be set
    if (!process.env.MONGODB || !process.env.ES) {
      console.warn('WARNING: MONGODB and ES environment variables are not set. Using defaults for indexing.')
    }

    const env = Object.assign({}, process.env, {
      MONGODB: process.env.MONGODB || 'mongodb://localhost:27017/pastpaper',
      ES: process.env.ES || 'localhost:9200'
    })

    await runCommand('node', [SCRIPT_DOINDEX, DOWNLOAD_DIR], env)

    console.log('\n--- UPDATE COMPLETE ---')
  } catch (err) {
    console.error('Update failed:', err)
    process.exit(1)
  }
}

runUpdate()
