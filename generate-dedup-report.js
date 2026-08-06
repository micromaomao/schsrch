const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sspdf = require('./lib/sspdf.js');
const PaperUtils = require('./view/paperutils.js');
const CIESubjects = require('./view/CIESubjects.data.js');

function extractMetadataFromPath (filePath) {
  const fname = path.basename(filePath)
  const dirName = path.dirname(filePath)

  let nameMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)_(\d{1,2})\.\w+$/)
  let nameErMat = fname.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9_]+)\.\w+$/)
  let subject, time, type, paper, variant

  if (dirName.match(/Specimen/i) || fname.match(/Specimen/i) || fname.match(/_sp/i) || fname.match(/_sm/i)) {
    let mt = fname.match(/^(\d+)_([a-zA-Z0-9]+)_(\d{1,2})\.\w+$/)
    if (!mt) mt = fname.match(/^(\d+)_([a-zA-Z0-9]+)_(\d{1,2})_.*?\.\w+$/)
    if (!mt) {
       mt = fname.match(/^(\d+)_[yY]([0-9]{2})_([a-zA-Z0-9]+)_(\d{1,2})\.\w+$/)
    } else {
       mt.splice(2, 0, 'y00')
    }
    if (mt) {
      subject = mt[1]
      time = mt[2]
      type = mt[3]
      let pv = mt[4]
      paper = parseInt(pv[0])
      if (pv.length === 2) {
        variant = parseInt(pv[1])
      } else {
        variant = 0
      }
    } else {
       let sm = dirName.match(/(\d{4})/)
       if (sm) {
         time = 'y' + sm[1].substring(2)
       } else {
         time = 'y00'
       }
       let mm = fname.match(/^(\d+)/)
       if (mm) subject = mm[1]

       if (fname.match(/mark[ -]*scheme/i)) type = 'sm'
       else if (fname.match(/insert/i)) type = 'in' // FIXME: What is type for specimen insert?
       else type = 'sp'

       let pm = fname.match(/paper[ -]*(\d)/i)
       if (pm) {
         paper = parseInt(pm[1])
         variant = 0
       } else {
         paper = 0
         variant = 0
       }
    }
    if (!subject) return null

    return { subject, time, type, paper, variant }
  } else if (nameMat) {
    let pv
    [, subject, time, type, pv] = nameMat
    paper = parseInt(pv[0])
    if (pv.length === 2) {
      variant = parseInt(pv[1])
    } else {
      variant = 0
    }
    return { subject, time, type, paper, variant }
  } else if (nameErMat) {
    let t = nameErMat[3]
    subject = nameErMat[1]
    time = nameErMat[2]
    let typeMatch = t.match(/([a-z]+)$/i)
    if (typeMatch) {
      type = typeMatch[1]
    } else {
      type = t
    }
    paper = 0
    variant = 0
    return { subject, time, type, paper, variant }
  }
  return null
}

async function run() {
  const root = path.join(__dirname, 'papers_download');
  let files = [];
  async function walk(dir) {
    const list = await fs.promises.readdir(dir, {withFileTypes: true});
    for(const ent of list) {
      const p = path.join(dir, ent.name);
      if(ent.isDirectory()) await walk(p);
      else if(ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) files.push(p);
    }
  }
  await walk(root);
  
  const signatures = {};
  for(const file of files) {
    let meta = extractMetadataFromPath(file);
    if (!meta) {
      meta = { subject: 'unknown', time: 'unknown', type: 'unknown', paper: 0, variant: 0 };
    }
    let sig = `${meta.subject}_${meta.time}_${meta.type}_${meta.paper}_${meta.variant}`;
    if(!signatures[sig]) signatures[sig] = [];
    signatures[sig].push(file);
  }

  let totalScanned = files.length;
  let uniqueSigs = Object.keys(signatures).length;
  
  let dupes = {};
  let totalDuplicateSignatures = 0;
  for(const sig in signatures) {
    if(signatures[sig].length > 1) {
      dupes[sig] = signatures[sig];
      totalDuplicateSignatures++;
    }
  }

  const report = {
    totalPhysicalPDFsScanned: totalScanned,
    totalUniqueMetadataSignatures: uniqueSigs,
    totalDuplicateSignatures: totalDuplicateSignatures,
    duplicateGroups: dupes
  };
  
  fs.writeFileSync('dedup-report.json', JSON.stringify(report, null, 2));
  console.log("Report generated at dedup-report.json");
  console.log(`Total scanned: ${totalScanned}`);
  console.log(`Unique signatures: ${uniqueSigs}`);
  console.log(`Duplicate signatures: ${totalDuplicateSignatures}`);
}
run().catch(console.error);
