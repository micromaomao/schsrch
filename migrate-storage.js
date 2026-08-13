#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const PaperUtils = require('./view/paperutils.js');

const DB_URI = process.env.MONGODB || 'mongodb://127.0.0.1/schsrch';
const STORAGE_ROOT = process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT) : path.resolve(path.join(__dirname, 'papers_download'));

// CLI Flags:
// --dry-run: Run migration without modifying the DB or filesystem.
// --resume: Skip documents that already have a relativePath assigned.
// --verify: Only run the verification phase, do not migrate.
// --cleanup-blobs: Verify migration integrity, then conditionally drop pastpaperpaperblobs.
// --confirm-cleanup: Acknowledge the destructive action of --cleanup-blobs.
// --force: Intentionally destructive flag. Bypasses the pre-cleanup verification barrier 
//          when combined with --cleanup-blobs, allowing pastpaperpaperblobs to be dropped
//          even if verification fails. Only use when operator explicitly accepts unresolved issues.
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESUME = args.includes('--resume');
const VERIFY_ONLY = args.includes('--verify');
const CLEANUP_BLOBS = args.includes('--cleanup-blobs');
const CONFIRM_CLEANUP = args.includes('--confirm-cleanup');
const FORCE_CLEANUP = args.includes('--force');

function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(filePath);
    rs.on('error', reject);
    rs.on('data', chunk => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
  });
}

async function scanFilesystemForPdfs(dir, allPdfs) {
  if (!fs.existsSync(dir)) return;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanFilesystemForPdfs(fullPath, allPdfs);
    } else if (entry.isFile() && fullPath.endsWith('.pdf')) {
      allPdfs.add(fullPath);
    }
  }
}

async function verifyMigration(db) {
  console.log('\n--- VERIFICATION PHASE ---');
  const docsColl = db.collection('pastpaperdocs');
  const docs = await docsColl.find({}).toArray();

  let missingFiles = [];
  let invalidHashes = [];
  let noRelativePath = [];
  
  let physicalPathOwners = new Map(); // relativePath -> { docId, fileHash }
  let duplicatePathAssignments = [];

  console.log(`Scanning filesystem for orphaned files...`);
  const allPdfs = new Set();
  await scanFilesystemForPdfs(STORAGE_ROOT, allPdfs);
  let orphanedFiles = Array.from(allPdfs);

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
    
    // Check path assignment collisions
    if (physicalPathOwners.has(doc.relativePath)) {
      let owner = physicalPathOwners.get(doc.relativePath);
      if (owner.fileHash !== doc.fileHash) {
        duplicatePathAssignments.push({
          path: doc.relativePath,
          doc1: owner.docId,
          hash1: owner.fileHash,
          doc2: doc._id,
          hash2: doc.fileHash
        });
      }
    } else {
      physicalPathOwners.set(doc.relativePath, { docId: doc._id, fileHash: doc.fileHash });
    }

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
    duplicatePathAssignments: duplicatePathAssignments.length,
    details: {
      noRelativePath,
      missingFiles,
      invalidHashes,
      orphanedFiles,
      duplicatePathAssignments
    }
  };

  fs.writeFileSync('migration-report.json', JSON.stringify(report, null, 2));

  // CSV Report
  const csvLines = ['Type,DocumentID,Path,ExpectedHash,ActualHash,Error'];
  missingFiles.forEach(m => csvLines.push(`Missing,${m.id},${m.path},,,${m.error || 'File not found'}`));
  invalidHashes.forEach(i => csvLines.push(`InvalidHash,${i.id},${i.path},${i.expected},${i.actual},Hash mismatch`));
  orphanedFiles.forEach(o => csvLines.push(`Orphaned,,${o},,,Not referenced in DB`));
  duplicatePathAssignments.forEach(d => csvLines.push(`DuplicatePathAssignment,${d.doc2},${d.path},${d.hash2},,Conflicting hash with ${d.doc1}`));
  noRelativePath.forEach(n => csvLines.push(`NoRelativePath,${n},,,,Missing relativePath in DB`));
  
  fs.writeFileSync('migration-report.csv', csvLines.join('\n'));

  console.log(`Verification complete. Found:`);
  console.log(`  ${noRelativePath.length} documents missing relativePath (blocking)`);
  console.log(`  ${missingFiles.length} missing/unreadable files (blocking)`);
  console.log(`  ${invalidHashes.length} files with invalid hashes (blocking)`);
  console.log(`  ${duplicatePathAssignments.length} unsafe path collisions (blocking)`);
  console.log(`  ${orphanedFiles.length} orphaned files on disk (non-blocking)`);
  console.log(`\nNote: missingFiles, invalidHashes, duplicatePathAssignments, and noRelativePath are blocking integrity failures.`);
  console.log(`Orphaned files are reported but are not a reason to prevent dropping pastpaperpaperblobs, because they are filesystem files not referenced by the database.`);
  console.log(`See migration-report.json and migration-report.csv for details.`);
  
  return report;
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

  if (VERIFY_ONLY) {
    await verifyMigration(db);
    process.exit(0);
  }

  if (CLEANUP_BLOBS) {
    if (FORCE_CLEANUP && !CONFIRM_CLEANUP) {
      console.error('\nABORTING CLEANUP: --force was supplied without --confirm-cleanup.');
      process.exit(1);
    }

    console.log('\n--- PRE-CLEANUP VERIFICATION ---');
    const report = await verifyMigration(db);
    
    const hasFailures = report.missingFiles > 0 || report.invalidHashes > 0 || report.duplicatePathAssignments > 0 || report.noRelativePath > 0;

    if (hasFailures) {
      if (FORCE_CLEANUP) {
        console.log('\nWARNING: FORCE CLEANUP ENABLED');
        console.log('Pre-cleanup verification reported:');
        console.log(`  ${report.missingFiles} missing/unreadable files`);
        console.log(`  ${report.orphanedFiles} orphaned files`);
        console.log(`  ${report.invalidHashes} invalid hashes`);
        console.log(`  ${report.duplicatePathAssignments} unsafe path collisions`);
        console.log('\nThe legacy pastpaperpaperblobs collection will now be permanently deleted.');
        console.log('\nBecause --force and --confirm-cleanup were both supplied, proceeding.');
      } else {
        console.error('\nABORTING CLEANUP: Pre-cleanup verification failed. All documents must be safely migrated before deleting blobs.');
        process.exit(1);
      }
    } else {
      console.log('\nPre-cleanup verification passed successfully. Zero documents depend on legacy blobs.');
    }
    
    const count = await blobsColl.countDocuments();
    let stats;
    try {
      stats = await db.command({ collStats: 'pastpaperpaperblobs' });
    } catch(e) {
      stats = { storageSize: 0 };
    }
    const sizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
    
    console.log(`\nReady to permanently delete legacy blobs collection.`);
    console.log(`Documents to remove: ${count}`);
    console.log(`Estimated storage to reclaim: ${sizeMB} MB`);
    
    if (!CONFIRM_CLEANUP) {
      console.error('\nABORTING CLEANUP: You must provide the --confirm-cleanup flag to proceed with this destructive operation.');
      process.exit(1);
    }
    
    console.log('\n--confirm-cleanup flag provided. Dropping pastpaperpaperblobs collection...');
    await blobsColl.drop();
    
    const collections = await db.listCollections({ name: 'pastpaperpaperblobs' }).toArray();
    if (collections.length > 0) {
      console.error('\nERROR: Collection still exists after drop command.');
      process.exit(1);
    }
    
    console.log('\nCollection pastpaperpaperblobs successfully removed. pastpaperdocs and physical PDFs remain intact.');
    
    const cleanupReport = {
      timestamp: new Date().toISOString(),
      action: 'dropped_pastpaperpaperblobs',
      documentsRemoved: count,
      storageReclaimedBytes: stats.storageSize,
      status: 'success',
      forceModeUsed: FORCE_CLEANUP,
      preCleanupFailures: {
        missingFiles: report.missingFiles,
        invalidHashes: report.invalidHashes,
        duplicatePathAssignments: report.duplicatePathAssignments,
        noRelativePath: report.noRelativePath,
        orphanedFiles: report.orphanedFiles
      }
    };
    
    fs.writeFileSync('cleanup-report.json', JSON.stringify(cleanupReport, null, 2));
    console.log('Wrote cleanup-report.json.');
    process.exit(0);
  }

  const query = RESUME ? { relativePath: { $exists: false } } : {};
  const cursor = docsColl.find(query);
  const totalDocs = await docsColl.countDocuments(query);
  
  let processed = 0;
  let dbRecoveries = 0;
  let existingMatches = 0;
  let pathCollisions = 0;
  let errors = 0;

  console.log(`Starting migration for ${totalDocs} documents...`);
  if (DRY_RUN) console.log('*** DRY RUN MODE: No changes will be saved ***');

  // Track path ownership to prevent duplicates during migration
  const assignedPaths = new Map(); // relativePath -> { id, hash }

  for await (const doc of cursor) {
    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`\rProgress: ${processed}/${totalDocs} | Recovered: ${dbRecoveries} | Existing: ${existingMatches} | Collisions: ${pathCollisions} | Errors: ${errors}`);
    }

    try {
      let buffer;
      const fragments = await blobsColl.find({ docId: doc._id }).sort({ offset: 1 }).toArray();
      if (fragments.length === 0) {
        if (doc.fileBlob) {
          buffer = doc.fileBlob.buffer || doc.fileBlob;
        } else {
          // If no blob at all, check if it's already properly migrated with hash and relativePath
          if (doc.relativePath && doc.fileHash) {
             const absolutePath = path.join(STORAGE_ROOT, doc.relativePath);
             if (fs.existsSync(absolutePath)) {
               const diskHash = await calculateHash(absolutePath);
               if (diskHash === doc.fileHash) {
                 existingMatches++;
                 assignedPaths.set(doc.relativePath, { id: doc._id, hash: doc.fileHash });
                 continue;
               }
             }
          }
          console.error(`\nError: Document ${doc._id} has no blobs in db.`);
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

      // Reconstructed PDF hash
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Base path generation
      let fname = `${PaperUtils.setToString(doc)}_${doc.type}.${doc.fileType || 'pdf'}`;
      let relativePath = `new_imports/${doc.subject}/${doc.time}/${fname}`;
      let absolutePath = path.join(STORAGE_ROOT, relativePath);

      // Collision handling
      let hasCollision = false;

      // 1. Check in-memory assigned paths for this run
      if (assignedPaths.has(relativePath) && assignedPaths.get(relativePath).hash !== fileHash) {
        hasCollision = true;
      }
      
      // 2. Check filesystem
      if (!hasCollision && fs.existsSync(absolutePath)) {
        const existingHash = await calculateHash(absolutePath);
        if (existingHash !== fileHash) {
          hasCollision = true;
        }
      }

      if (hasCollision) {
        pathCollisions++;
        // Generate safe unique filename
        const ext = path.extname(fname) || '.pdf';
        const base = path.basename(fname, ext);
        fname = `${base}__${doc._id.toString()}${ext}`;
        relativePath = `new_imports/${doc.subject}/${doc.time}/${fname}`;
        absolutePath = path.join(STORAGE_ROOT, relativePath);
      }

      assignedPaths.set(relativePath, { id: doc._id, hash: fileHash });

      if (fs.existsSync(absolutePath)) {
        // Double check hash matches if it exists on disk, either from resume or matching content
        const diskHash = await calculateHash(absolutePath);
        if (diskHash !== fileHash) {
          // This should never happen if collision handling worked, but a safety net
          console.error(`\nSafety Error: Target path ${absolutePath} exists with different hash, even after collision resolution for doc ${doc._id}`);
          errors++;
          continue;
        }
        existingMatches++;
      } else {
        if (!DRY_RUN) {
          fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
          fs.writeFileSync(absolutePath, buffer);
        }
        dbRecoveries++;
      }

      // Final verification before updating DB
      if (!DRY_RUN) {
        const actualDiskHash = await calculateHash(absolutePath);
        if (actualDiskHash !== fileHash) {
          console.error(`\nVerification Error: Disk hash for ${absolutePath} doesn't match buffer hash for doc ${doc._id}. Database not updated.`);
          errors++;
          continue;
        }

        await docsColl.updateOne({ _id: doc._id }, {
          $set: { relativePath, fileHash },
          $unset: { fileBlob: "" }
        });
      }

    } catch (err) {
      console.error(`\nError processing doc ${doc._id}: ${err.stack || err.message}`);
      errors++;
    }
  }

  process.stdout.write(`\rProgress: ${processed}/${totalDocs} | Recovered: ${dbRecoveries} | Existing: ${existingMatches} | Collisions: ${pathCollisions} | Errors: ${errors}\n`);
  
  if (!DRY_RUN) {
    console.log('\nMigration applied successfully.');
    await verifyMigration(db);
  } else {
    console.log(`\nDry run complete. Run without --dry-run to apply changes.`);
    console.log(`Documents scanned: ${processed}`);
    console.log(`Recoverable: ${dbRecoveries}`);
    console.log(`Existing matches: ${existingMatches}`);
    console.log(`Path collisions: ${pathCollisions}`);
    console.log(`Errors: ${errors}`);
  }

  process.exit(0);
}

migrate().catch(console.error);
