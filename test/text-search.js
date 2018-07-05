const supertest = require('supertest')
const should = require('should')
const PaperUtils = require('../view/paperutils.js')

module.exports = (schsrch, dbModel) =>
  describe('Full text search', function () {
    const {PastPaperDoc} = dbModel
    function ftExpectBasic (x) {
      return x
        .expect(res => res.body.list.should.be.an.Array())
        .expect(res => res.body.list.forEach(x => x.should.be.an.Object()))
        .expect(res => res.body.list.forEach(x => x.doc.should.be.an.Object()))
        .expect(res => res.body.list.forEach(x => x.doc._id.should.be.a.String()))
        .expect(res => res.body.list.forEach(x => x.doc.fileType.should.equal('pdf')))
        .expect(res => res.body.list.forEach(x => should.not.exist(x.doc.doc)))
        .expect(res => res.body.list.forEach(x => should.not.exist(x.doc.fileBlob)))
        .expect(res => res.body.list.forEach(x => should.not.exist(x.doc.dir)))
        .expect(res => res.body.list.forEach(x => x.index.should.be.an.Object()))
        .expect(res => res.body.list.forEach(x => x.index._id.should.be.an.String()))
        .expect(res => res.body.list.forEach(x => x.index.docId.should.be.an.String()))
        .expect(res => res.body.list.forEach(x => x.index.page.should.be.an.Number().and.aboveOrEqual(0)))
        .expect(res => res.body.list.forEach(x => should.not.exist(x.index.sspdfCache)))
        .expect(res => res.body.list = res.body.list.filter(x => x.doc.subject !== '0470'))
    }
    let indexToSearch = null
    let tDocId = null
    let s16qp1Keyword = 'almond weft logotype yodel parsnip'
    function keywordsTest(done, itx) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent(itx ? itx : s16qp1Keyword))
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array()))
        .expect(res => res.body.list.length.should.equal(1, `Response should have one result returned.`))
        .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
        .expect(res => res.body.list[0].str.should.equal('0610_s16_1_0_qp'))
        .expect(res => res.body.list[0].related.should.be.an.Array())
        .expect(res => res.body.list[0].related.should.have.length(1))
        .expect(res => res.body.list[0].related[0].should.be.an.Object())
        .expect(res => res.body.list[0].related[0]._id.should.be.a.String())
        .expect(res => res.body.list[0].related[0].type.should.equal('ms'))
        .expect(res => res.body.list[0].related[0].numPages.should.equal(1))
        .expect(res => res.body.list[0].related[0].fileType.should.equal('pdf'))
        .expect(res => should.not.exist(res.body.list[0].related[0].doc))
        .expect(res => should.not.exist(res.body.list[0].related[0].sspdfCache))
        .expect(res => indexToSearch = res.body.list[0].index._id)
        .expect(res => tDocId = res.body.list[0].doc._id)
        .end(done)
    }
    it('Case: ' + s16qp1Keyword, function (done) {
      keywordsTest(done)
    })
    it('Case: Lorem ipsum dolor sit amet', function (done) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent('Lorem ipsum dolor sit amet'))
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(2, `Response should have two results returned.`)))
        .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
        .expect(res => res.body.list[0].str.match(/^0612/) ? res.body.list = [res.body.list[1], res.body.list[0]] : null)
        .expect(res => res.body.list[0].str.should.equal('0611_s16_9_0_ms'))
        .expect(res => res.body.list[0].related.should.be.an.Array())
        .expect(res => res.body.list[0].related.should.have.length(0))
        .expect(res => res.body.list[1].str.should.equal('0612_s16_9_0_ms'))
        .expect(res => res.body.list[1].related.should.be.an.Array())
        .expect(res => res.body.list[1].related.should.have.length(0))
        .end(done)
    })
    it('Case: 0612 Lorem ipsum dolor sit amet', function (done) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent('0612 Lorem ipsum dolor sit amet'))
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(1, `Response should have one result returned.`)))
        .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
        .expect(res => res.body.list[0].str.should.equal('0612_s16_9_0_ms'))
        .expect(res => res.body.list[0].related.should.be.an.Array())
        .expect(res => res.body.list[0].related.should.have.length(0))
        .end(done)
    })
    it('Case: 0611 Lorem ipsum dolor sit amet', function (done) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent('0611 Lorem ipsum dolor sit amet'))
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(1, `Response should have one result returned.`)))
        .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
        .expect(res => res.body.list[0].str.should.equal('0611_s16_9_0_ms'))
        .expect(res => res.body.list[0].related.should.be.an.Array())
        .expect(res => res.body.list[0].related.should.have.length(0))
        .end(done)
    })
    function ftExpectEmpty (req) {
      return ftExpectBasic(req)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
        .expect(res => res.body.list.should.be.an.Array())
        .expect(res => res.body.list.length.should.equal(0, `Response should have no results returned.`))
    }
    function test0611P9 (paper) {
      return function (done) {
        ftExpectBasic(
          supertest(schsrch)
            .get('/search/?query=' + encodeURIComponent(`0611 ${paper} Lorem ipsum dolor sit amet`))
            .expect('Content-Type', /json/)
            .expect(200)
            .expect(res => res.body.should.be.an.Object())
            .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
            .expect(res => res.body.list.should.be.an.Array())
            .expect(res => res.body.list.length.should.equal(1, `Response should have one result returned.`)))
          .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
          .expect(res => res.body.list[0].str.should.equal('0611_s16_9_0_ms'))
          .expect(res => res.body.list[0].related.should.be.an.Array())
          .expect(res => res.body.list[0].related.should.have.length(0))
          .end(done)
      }
    }
    it('Case: 0611 paper 9 Lorem ipsum dolor sit amet', test0611P9('paper 9'))
    it('Case: 0611 paper9 Lorem ipsum dolor sit amet', test0611P9('paper9'))
    it('Case: 0611 p9 Lorem ipsum dolor sit amet', test0611P9('p9'))
    it('Case: 0611 paper 3 Lorem ipsum dolor sit amet', function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/?query=0611 paper 3 Lorem ipsum dolor sit amet'))
        .end(done)
    })
    it('Case: 0611 paper3 Lorem ipsum dolor sit amet', function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/?query=0611 paper3 Lorem ipsum dolor sit amet'))
        .end(done)
    })
    it('Case: 0611 p3 Lorem ipsum dolor sit amet', function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/?query=0611 p3 Lorem ipsum dolor sit amet'))
        .end(done)
    })
    it('Case: 0613 Lorem ipsum dolor sit amet', function (done) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent('0613 Lorem ipsum dolor sit amet'))
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(0, `Response should have no results returned.`)))
        .end(done)
    })
    it('Case: !!index!...', function (done) {
      indexToSearch.should.be.a.String()
      keywordsTest(done, '!!index!' + indexToSearch)
    })
    it('Case: !!index!000000000000000000000000' , function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent('!!index!000000000000000000000000'))
          .expect('Content-Type', /json/)
          .expect(200)
      ).end(done)
    })
    it("Shouldn't return the result if the corrospounding doc disappeared", function (done) {
      PastPaperDoc.remove({_id: tDocId}).then(() => {
        ftExpectEmpty(
          supertest(schsrch)
            .get('/search/?query=' + encodeURIComponent(s16qp1Keyword))
            .expect('Content-Type', /json/)
            .expect(200)
        ).end(done)
      }, err => done(err))
    })
    it("Shouldn't return !!index result if the corrospounding doc disappeared" , function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/?query=' + encodeURIComponent('!!index!' + indexToSearch))
          .expect('Content-Type', /json/)
          .expect(200)
      ).end(done)
    })
  })
