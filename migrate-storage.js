#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const CIESubjects = require('./view/CIESubjects.data.js');
const PaperUtils = require('./view/paperutils.js');

const DB_URI = process.env.MONGODB || 'mongodb://127.0.0.1/schsrch';
const STORAGE_ROOT = process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT) : path.resolve(path.join(__dirname, 'papers_download'));

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESUME = args.includes('--resume');
const VERIFY_ONLY = args.includes('--verify');

function extractMetadataFromPath(filePath) {
  const fname = path.basename(filePath);
  const dirName = path.dirname(filePath);

  let subject, time, type, paper, variant;

  let nameMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)_(\d{1,2})\.\w+$/);
  let nameErMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9_]+)\.\w+$/);
  let specimenMat = fname.match(/^(\d+)-(\d{4})-specimen-paper-(\d+)(?:-(.*))?\.pdf$/);

  if (specimenMat) {
    let year = specimenMat[2];
    time = 'y' + year.substring(2);
    paper = parseInt(specimenMat[3]);
    variant = 0;
    let subType = specimenMat[4];
    if (!subType) type = 'sp';
    else if (subType.includes('mark-scheme')) type = 'sm';
    else if (subType.includes('confidential-instruction')) type = 'sr';
    else if (subType.includes('insert')) type = 'si';
    else type = 'sp';

    let dirs = dirName.split(path.sep);
    for (let dir of dirs) {
      let subjMatch = CIESubjects.find(s => s.name === dir);
      if (subjMatch) {
        subject = subjMatch.id;
        break;
      }
    }
    if (!subject) return null;
    return { subject, time, type, paper, variant };
  } else if (nameMat) {
    let pv;
    [, subject, time, type, pv] = nameMat;
    paper = parseInt(pv[0]);
    if (pv.length === 2) variant = parseInt(pv[1]);
    else variant = 0;
    return { subject, time, type, paper, variant };
  } else if (nameErMat) {
    let t = nameErMat[3];
    subject = nameErMat[1];
    time = nameErMat[2];
    let typeMatch = t.match(/([a-z]+)$/i);
    if (typeMatch) type = typeMatch[1];
    else type = t;
    paper = 0;
    variant = 0;
    return { subject, time, type, paper, variant };
  }
  return null;
}

function getSignature(meta) {
  return `${meta.subject}_${meta.time}_${meta.type}_${meta.paper}_${meta.variant}`;
}

function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(filePath);
    rs.on('error', reject);
    rs.on('data', chunk => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
  });
}

async function scanFilesystem(dir, fileMap, duplicates) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanFilesystem(fullPath, fileMap, duplicates);
    } else if (entry.isFile() && fullPath.endsWith('.pdf')) {
      const meta = extractMetadataFromPath(fullPath);
      if (meta) {
        const sig = getSignature(meta);
        if (fileMap.has(sig)) {
          duplicates.push({ signature: sig, files: [fileMap.get(sig), fullPath] });
        } else {
          fileMap.set(sig, fullPath);
        }
      }
    }
  }
}

async function verifyMigration(db, fileMap, duplicates) {
  console.log('\n--- VERIFICATION PHASE ---');
  const docsColl = db.collection('pastpaperdocs');
  const docs = await docsColl.find({}).toArray();

  let missingFiles = [];
  let orphanedFiles = Array.from(fileMap.values());
  let invalidHashes = [];
  let noRelativePath = [];

  console.log(`Verifying ${docs.length} documents...`);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (i % 100 === 0 && i > 0) process.stdout.write(`\rVerified ${i}/${docs.length} docs`);

    if (!doc.relativePath) {
      noRelativePath.push(doc._id);
      continue;
    }

    const absolutePath = path.join(STORAGE_ROOT, doc.relativePath);
    
    // Check if orphaned
    const orphanIndex = orphanedFiles.indexOf(absolutePath);
    if (orphanIndex > -1) orphanedFiles.splice(orphanIndex, 1);

    if (!fs.existsSync(absolutePath)) {
      missingFiles.push({ id: doc._id, path: absolutePath });
      continue;
    }

    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
      const actualHash = await calculateHash(absolutePath);
      if (actualHash !== doc.fileHash) {
        invalidHashes.push({ id: doc._id, expected: doc.fileHash, actual: actualHash, path: absolutePath });
      }
    } catch (e) {
      missingFiles.push({ id: doc._id, path: absolutePath, error: e.message });
    }
  }
  process.stdout.write(`\rVerified ${docs.length}/${docs.length} docs\n`);

  const report = {
    totalDocs: docs.length,
    noRelativePath: noRelativePath.length,
    missingFiles: missingFiles.length,
    invalidHashes: invalidHashes.length,
    orphanedFiles: orphanedFiles.length,
    duplicateFiles: duplicates.length,
    details: {
      noRelativePath,
      missingFiles,
      invalidHashes,
      orphanedFiles,
      duplicates
    }
  };

  fs.writeFileSync('migration-report.json', JSON.stringify(report, null, 2));

  // CSV Report
  const csvLines = ['Type,DocumentID,Path,ExpectedHash,ActualHash,Error'];
  missingFiles.forEach(m => csvLines.push(`Missing,${m.id},${m.path},,,${m.error || 'File not found'}`));
  invalidHashes.forEach(i => csvLines.push(`InvalidHash,${i.id},${i.path},${i.expected},${i.actual},Hash mismatch`));
  orphanedFiles.forEach(o => csvLines.push(`Orphaned,,${o},,,Not referenced in DB`));
  duplicates.forEach(d => csvLines.push(`Duplicate,,${d.files.join(' | ')},,,Duplicate signatures: ${d.signature}`));
  noRelativePath.forEach(n => csvLines.push(`NoRelativePath,${n},,,,Missing relativePath in DB`));
  
  fs.writeFileSync('migration-report.csv', csvLines.join('\n'));

  console.log(`Verification complete. Found:`);
  console.log(`  ${noRelativePath.length} documents missing relativePath`);
  console.log(`  ${missingFiles.length} missing/unreadable files`);
  console.log(`  ${invalidHashes.length} files with invalid hashes`);
  console.log(`  ${orphanedFiles.length} orphaned files on disk`);
  console.log(`  ${duplicates.length} duplicate file signatures`);
  console.log(`See migration-report.json and migration-report.csv for details.`);
}

async function migrate() {
  console.log('Connecting to database...');
  const client = new MongoClient(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await client.connect();
  const db = client.db();
  const docsColl = db.collection('pastpaperdocs');
  const blobsColl = db.collection('pastpaperpaperblobs');

  console.log(`Scanning filesystem at ${STORAGE_ROOT}...`);
  const fileMap = new Map();
  const duplicates = [];
  if (fs.existsSync(STORAGE_ROOT)) {
    await scanFilesystem(STORAGE_ROOT, fileMap, duplicates);
  }
  console.log(`Found ${fileMap.size} distinct PDFs on disk.`);
  if (duplicates.length > 0) {
    console.log(`WARNING: Found ${duplicates.length} duplicate metadata signatures on disk.`);
  }

  if (VERIFY_ONLY) {
    await verifyMigration(db, fileMap, duplicates);
    process.exit(0);
  }

  const query = RESUME ? { relativePath: { $exists: false } } : {};
  const cursor = docsColl.find(query);
  const totalDocs = await docsColl.countDocuments(query);
  
  let processed = 0;
  let diskMatches = 0;
  let dbRecoveries = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`Starting migration for ${totalDocs} documents...`);
  if (DRY_RUN) console.log('*** DRY RUN MODE: No changes will be saved ***');

  for await (const doc of cursor) {
    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`\rProgress: ${processed}/${totalDocs} | Matches: ${diskMatches} | Recovered: ${dbRecoveries} | Errors: ${errors}`);
    }

    const meta = { subject: doc.subject, time: doc.time, type: doc.type, paper: doc.paper, variant: doc.variant };
    const sig = getSignature(meta);

    try {
      if (fileMap.has(sig)) {
        // Disk Match
        const absolutePath = fileMap.get(sig);
        const relativePath = path.relative(STORAGE_ROOT, absolutePath);
        const fileHash = await calculateHash(absolutePath);

        if (!DRY_RUN) {
          await docsColl.updateOne({ _id: doc._id }, {
            $set: { relativePath, fileHash },
            $unset: { fileBlob: "" }
          });
        }
        diskMatches++;
      } else {
        // Blob Recovery
        const fragments = await blobsColl.find({ docId: doc._id }).sort({ offset: 1 }).toArray();
        let buffer;
        if (fragments.length === 0) {
          if (doc.fileBlob) buffer = doc.fileBlob.buffer || doc.fileBlob;
          else {
            errors++;
            continue;
          }
        } else {
          let totalLength = fragments.reduce((acc, frag) => acc + (frag.data.length ? frag.data.length() : frag.data.buffer.length), 0);
          buffer = Buffer.alloc(totalLength);
          let currentOffset = 0;
          for (const frag of fragments) {
            const fragBuffer = frag.data.read ? frag.data.read(0, frag.data.length()) : frag.data.buffer;
            fragBuffer.copy(buffer, frag.offset || currentOffset);
            currentOffset += fragBuffer.length;
          }
        }

        const fname = `${PaperUtils.setToString(doc)}_${doc.type}.${doc.fileType}`;
        const relativePath = `new_imports/${doc.subject}/${doc.time}/${fname}`;
        const absolutePath = path.join(STORAGE_ROOT, relativePath);
        const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

        if (!DRY_RUN) {
          fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
          fs.writeFileSync(absolutePath, buffer);
          await docsColl.updateOne({ _id: doc._id }, {
            $set: { relativePath, fileHash },
            $unset: { fileBlob: "" }
          });
        }
        dbRecoveries++;
      }
    } catch (err) {
      errors++;
    }
  }

  process.stdout.write(`\rProgress: ${processed}/${totalDocs} | Matches: ${diskMatches} | Recovered: ${dbRecoveries} | Errors: ${errors}\n`);
  
  if (!DRY_RUN) {
    console.log('\nMigration applied successfully.');
    await verifyMigration(db, fileMap, duplicates);
  } else {
    console.log('\nDry run complete. Run without --dry-run to apply changes.');
  }

  process.exit(0);
}

migrate().catch(console.error);
