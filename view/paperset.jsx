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
    let ftDoc = null
    if (set.types[0] && set.types[0].ftIndex) {
      ftDoc = set.types[0]
    }
    sortedTypes = set.types.slice(ftDoc !== null ? 1 : 0).sort((a, b) => PaperUtils.funcSortType(a.type, b.type))
    let previewFtDoc = ftDoc !== null && this.state.previewing
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
        {ftDoc !== null
          ? (
            <div className='file ft' key={ftDoc._id} onClick={evt => this.openFile(ftDoc._id, ftDoc.ftIndex.page)}>
              {(() => {
                let pt = (
                  <span>
                    <span className='typename'>{PaperUtils.capitalizeFirst(PaperUtils.getTypeString(ftDoc.type))}</span>
                    &nbsp;
                    <span className='desc'>
                      <span className='pagenum'>found on page <span className='foundon'>{ftDoc.ftIndex.page + 1}</span> / {ftDoc.numPages} pages total</span>
                      ,&nbsp;
                      <span className='filetype'>{ftDoc.fileType}</span>
                    </span>
                  </span>
                )
                if (!this.state.server) {
                  return pt
                } else {
                  return (
                    <a href={this.fileUrl(ftDoc._id)} target='_blank'>
                      {pt}
                    </a>
                  )
                }
              })()}
              <IndexContent content={ftDoc.ftIndex.content} search={this.props.indexQuery || ''} />
            </div>
          )
          : null}
        {previewFtDoc && !this.state.server
          ? (
            <FilePreview doc={this.state.previewing.id} page={this.state.previewing.page} />
          )
          : null
        }
        <div className={ftDoc !== null ? 'related' : 'files'}>
          {ftDoc ? 'Related: ' : null}
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
              <div className='file' key={file._id} onClick={evt => this.openFile(file._id, 0)}>
                {!this.state.server ? pt : (
                  <a href={this.fileUrl(file._id)} target='_blank'>
                    {pt}
                  </a>
                )}
              </div>
            )
          })}
        </div>
        {!previewFtDoc && this.state.previewing
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
    return '/fetchDoc/' + encodeURIComponent(id)
  }
}

module.exports = PaperSet
