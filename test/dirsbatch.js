const supertest = require('supertest')
const should = require('should')

module.exports = (schsrch, dbModel) =>
  describe('/dirs/batch/', function () {
    let {PastPaperDoc} = dbModel
    let subjectNumber = null
    before(function (done) {
      function trySubjectNumber () {
        subjectNumber = Math.floor(Math.random() * 10000).toString()
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

    let qp = null, ms = null, er = null
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
              if (type === 'qp') qp = doc
              else if (type === 'ms') ms = doc
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
          type: 'testing',
          docType: 'er'
        }
      })
      insertPromises.push(er.save())
      Promise.all(insertPromises).then(() => done(), err => done(err))
    })

    function testWith (gdoc, dtype) {
      it(`/dirs/batch/ should work for ${dtype}`, function (done) {
        let doc = gdoc()
        supertest(schsrch)
          .get(`/dirs/batch/?docid=${encodeURIComponent(doc._id)}`)
          .set('Host', 'schsrch.xyz')
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => {
            Object.keys(res.body).should.deepEqual(['qp', 'ms', 'er'])
            res.body.qp.should.deepEqual({
              type: 'testing', docType: 'qp', paper: 1, variant: 3, docid: qp._id.toString()
            })
            res.body.ms.should.deepEqual({
              type: 'testing', docType: 'ms', paper: 1, variant: 3, docid: ms._id.toString()
            })
            res.body.er.should.deepEqual({
              type: 'testing', docType: 'er', docid: er._id.toString()
            })
          })
          .end(done)
      })
    }

    testWith(() => qp, 'qp')
    testWith(() => ms, 'ms')

    it(`/dirs/batch/ should work for er`, function (done) {
      supertest(schsrch)
        .get(`/dirs/batch/?docid=${encodeURIComponent(er._id)}`)
        .set('Host', 'schsrch.xyz')
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => {
          Object.keys(res.body).should.deepEqual(['er'])
          res.body.er.should.deepEqual({
            type: 'testing', docType: 'er', docid: er._id.toString()
          })
        })
        .end(done)
    })
  })
