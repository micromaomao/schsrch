const React = require('react')
const Subjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')
const IndexContent = require('./indexcontent.jsx')
const AppState = require('./appstate.js')
const FilePreview = require('./filepreview.jsx')

class PaperSet extends React.Component {
  constructor () {
    super()
    this.state = {
      previewing: null
    }
    this.handleAppStateUpdate = this.handleAppStateUpdate.bind(this)
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  handleAppStateUpdate () {
    let previewingState = AppState.getState().previewing
    if (previewingState && this.props.psKey && this.props.psKey === previewingState.psKey) {
      this.setState({previewing: previewingState})
    } else {
      this.setState({previewing: null})
    }
  }
  componentDidMount () {
    this.handleAppStateUpdate()
    this.unsub = AppState.subscribe(this.handleAppStateUpdate)
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
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
    let showPreview = firstDoc !== null && this.state.previewing
    return (
      <div className='set'>
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
        {showPreview && !this.state.server
          ? (
            <FilePreview doc={this.state.previewing.id} page={this.state.previewing.page} />
          )
          : null
        }
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
        {!showPreview && this.state.previewing
          ? (
            <FilePreview doc={this.state.previewing.id} page={this.state.previewing.page} />
          )
          : null}
      </div>
    )
  }
  openFile (id, page = 0) {
    AppState.dispatch({type: 'previewFile', fileId: id, page: page, psKey: this.props.psKey})
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
