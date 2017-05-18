const React = require('react')
const Subjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')
const IndexContent = require('./indexcontent.jsx')
const AppState = require('./appstate.js')

class PaperSet extends React.Component {
  constructor () {
    super()
    this.state = {}
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  render () {
    let set = this.props.paperSet
    let subject = Subjects.findExactById(set.subject)
    let sortedTypes
    let firstDoc = null
    // firstDoc is the doc to be displayed its content. Remaining docs will appear under "Related:"
    if (set.types[0] && set.types[0].index) {
      firstDoc = set.types[0]
    }
    // sortedTypes is all the document in this set *except* the one that gets displayed its content in full text search.
    sortedTypes = set.types.slice(firstDoc !== null ? 1 : 0).sort((a, b) => PaperUtils.funcSortType(a.type, b.type))
    return (
      <div className={'set' + (this.props.current ? ' current-previewing' : '')}>
        <div className='setname'>
          {subject
            ? <span className='subject'>
                <span className='level'>({subject.level})</span>
                &nbsp;
                {subject.name}
              </span>
            : <span className='subject'>{set.subject}???</span>}
          &nbsp;
          <span className='time'>{PaperUtils.myTimeToHumanTime(set.time)}</span>
          {set.paper !== 0 || set.variant !== 0
            ? (<span>
                &nbsp;paper&nbsp;
                <span className={'paper' + (set.paper === 0 ? ' meta' : '')}>{set.paper || '(meta)'}</span>
              </span>)
            : null}
          {set.variant !== 0
            ? (<span>
                &nbsp;variant&nbsp;
                <span className='variant'>{set.variant}</span>
              </span>)
            : null}
        </div>
        {firstDoc !== null
          ? (
            <div className='file first' key={firstDoc._id} onClick={evt => this.openFile(firstDoc._id, firstDoc.index.page)}>
              {(() => {
                let pt = (
                  <span>
                    <span className='typename'>{PaperUtils.capitalizeFirst(PaperUtils.getTypeString(firstDoc.type))}</span>
                    &nbsp;
                    <span className='desc'>
                      <span className='pagenum'>found on page <span className='foundon'>{firstDoc.index.page + 1}</span> / {firstDoc.numPages} pages total</span>
                      ,&nbsp;
                      <span className='filetype'>{firstDoc.fileType}</span>
                    </span>
                  </span>
                )
                if (!this.state.server) {
                  return pt
                } else {
                  return (
                    <a href={this.fileUrl(firstDoc._id)} target='_blank'>
                      {pt}
                    </a>
                  )
                }
              })()}
              <IndexContent content={firstDoc.index.content} search={this.props.query || ''} />
            </div>
          )
          : null}
        <div className={firstDoc !== null ? 'related' : 'files'}>
          {firstDoc ? 'Related: ' : null}
          {sortedTypes.map(file => {
            let pt = (
              <span>
                <span className='typename'>{PaperUtils.capitalizeFirst(PaperUtils.getTypeString(file.type))}</span>
                &nbsp;
                <span className='desc'>
                  <span className='pagenum'>{file.numPages} pages</span>
                  ,&nbsp;
                  <span className='filetype'>{file.fileType}</span>
                </span>
              </span>
            )
            return (
              <div className='file' key={file._id} onClick={evt => this.openFile(file._id, this.getLastPreviewPage(file._id))}>
                {!this.state.server ? pt : (
                  <a href={this.fileUrl(file._id)} target='_blank'>
                    {pt}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  openFile (id, page = 0) {
    if (this.props.onOpenFile) {
      this.props.onOpenFile(id, page)
    }
  }
  fileUrl (id) {
    return '/doc/' + encodeURIComponent(id)
  }
  getLastPreviewPage (doc) {
    let pres = AppState.getState().previewPages[doc]
    return pres || 0
  }
}

module.exports = PaperSet
