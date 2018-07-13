const supertest = require('supertest')
const should = require('should')

module.exports = (schsrch, dbModel) =>
  describe('/dirs/batch/', function () {
    let {PastPaperDoc} = dbModel
    let subjectNumber = null
    before(function (done) {
      function trySubjectNumber () {
        subjectNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        PastPaperDoc.count({subject: subjectNumber}).then(ct => {
          if (ct === 0) {
            console.log(`Using syllabus number ${subjectNumber} for testing...`)
            done()
          } else {
            trySubjectNumber()
          }
        }, err => done(err))
      }
      trySubjectNumber()
    })

    let docs = [null, {qp: null, ms: null}, {qp: null, ms: null}]
    const erTest_papers = [
      {
        pv: '11',
        dirs: []
      },
      {
        pv: '12',
        dirs: []
      },
      {
        pv: '13',
        dirs: ['testing-er', 1, 3]
      },
      {
        pv: '21',
        dirs: []
      },
      {
        pv: '22',
        dirs: ['testing-er', 2, 2]
      },
      {
        pv: '23',
        dirs: []
      }
    ]
    before(function (done) {
      let insertPromises = []
      for (let type of ['qp', 'ms']) {
        for (let paper = 1; paper < 5; paper ++) {
          for (let variant = 1; variant <= 3; variant ++) {
            let doc = new PastPaperDoc({
              subject: subjectNumber,
              time: 's17',
              type,
              paper: paper,
              variant: variant,
              fileBlob: Buffer.from(''),
              fileType: 'nul',
              numPages: 0,
              dir: {
                type: 'testing',
                docType: type,
                paper, variant
              }
            })
            insertPromises.push(doc.save())
            if (paper === 1 && variant === 3) {
              docs[1][type] = doc
            }
            if (paper === 2 && variant === 2) {
              docs[2][type] = doc
            }
          }
        }
      }
      er = new PastPaperDoc({
        subject: subjectNumber,
        time: 's17',
        type: 'er',
        paper: 0,
        variant: 0,
        fileBlob: Buffer.from(''),
        fileType: 'nul',
        numPages: 0,
        dir: {
          type: 'er',
          docType: 'er',
          papers: erTest_papers
        }
      })
      insertPromises.push(er.save())
      Promise.all(insertPromises).then(() => done(), err => done(err))
    })

    for (let i = 1; i <= 2; i ++) {
      for (let t of ['qp', 'ms']) {
        for (let flattenEr of [false, true]) {
          it(`/dirs/batch/ test ${i}.${t} with flattenEr = ${flattenEr}`, function (done) {
            let {qp, ms} = docs[i]
            supertest(schsrch)
              .get(`/dirs/batch/?docid=${encodeURIComponent(docs[i][t]._id.toString())}&flattenEr=${flattenEr}`)
              .expect(200)
              .expect(res => res.body.should.be.an.Object())
              .expect(res => {
                Object.keys(res.body).sort().should.deepEqual(['qp', 'ms', 'er'].sort())
                res.body.qp.should.deepEqual({
                  type: 'testing', docType: 'qp', paper: qp.paper, variant: qp.variant, docid: qp._id.toString()
                })
                res.body.ms.should.deepEqual({
                  type: 'testing', docType: 'ms', paper: qp.paper, variant: qp.variant, docid: ms._id.toString()
                })
                if (!flattenEr) {
                  assertErDir(res.body.er)
                } else {
                  res.body.er.should.deepEqual({
                    type: 'er-flattened', docid: er._id.toString(), dirs: ['testing-er', qp.paper, qp.variant]
                  })
                }
              })
              .end(done)
          })
        }
      }
    }

    it('/dirs/batch/ should work for docid=er', function (done) {
      supertest(schsrch)
        .get(`/dirs/batch/?docid=${encodeURIComponent(er._id)}`)
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => {
          Object.keys(res.body).should.deepEqual(['er'])
          assertErDir(res.body.er)
        })
        .end(done)
    })

    function assertErDir (erDir) {
      erDir.should.be.an.Object()
      erDir.type.should.equal('er')
      erDir.docType.should.equal('er')
      erDir.docid.should.equal(er._id.toString())
      erDir.papers.should.be.an.Array()
      for (let i = 1; i <= 2; i ++) {
        let { qp } = docs[i]
        let f = erDir.papers.filter(d => d.pv === `${qp.paper}${qp.variant}`)
        f.length.should.equal(1)
        f[0].docid.should.equal(qp._id.toString())
      }
      erDir.papers.map(x => {
        delete x.docid
        return x
      }).should.deepEqual(erTest_papers)
    }
  })
