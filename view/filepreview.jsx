const React = require('react')
const PaperUtils = require('./paperutils.js')
const SsPdfView = require('./sspdfview.jsx')
const AppState = require('./appstate.js')
const DocDirList = require('./docdirlist.jsx')
const FetchErrorPromise = require('./fetcherrorpromise.js')

// TODO: Highlight

class FilePreview extends React.Component {
  constructor () {
    super()
    this.state = {
      loading: false,
      error: null,
      docJson: null,
      docMeta: null,
      pageInputValue: null,
      dirJson: null,
      dirError: null,
      showingDir: false,
      relatedDirJson: null,
      relatedDocId: null,
      measuredViewWidth: 0,
      measuredViewHeight: 0
    }
    this.currentLoading = null
    this.measureViewDimAF = null
    this.handlePageInputChange = this.handlePageInputChange.bind(this)
    this.measureViewDim = this.measureViewDim.bind(this)
  }
  measureViewDim () {
    if (!this.sspdfContainer) return (this.measureViewDimAF = requestAnimationFrame(this.measureViewDim))
    this.measureViewDimAF = null
    let cs = window.getComputedStyle(this.sspdfContainer)
    let nState = {measuredViewWidth: parseFloat(cs.width) || 0, measuredViewHeight: parseFloat(cs.height) || 0}
    if (Math.abs(this.state.measuredViewWidth - nState.measuredViewWidth) < 1
      && Math.abs(this.state.measuredViewHeight - nState.measuredViewHeight) < 1) return
    this.setState(nState)
  }
  componentDidMount () {
    if (this.props && this.props.doc) {
      this.loadFromProps(this.props)
    }
    this.measureViewDim()
  }
  componentWillReceiveProps (nextProps) {
    if (!this.props || nextProps.doc !== this.props.doc || nextProps.page !== this.props.page) {
      if (!this.props || nextProps.doc !== this.props.doc) this.setState({docMeta: null, dirJson: null, relatedDirJson: null, relatedDocId: null})
      this.loadFromProps(nextProps)
    }
  }
  loadFromProps (props) {
    let {doc, page} = props
    this.load(doc, page)
  }
  componentDidUpdate (prevProps, prevState) {
    if (prevProps.doc !== this.props.doc || prevProps.page !== this.props.page) {
      this.sspdfView && this.sspdfView.reCenter()
      this.setState({pageInputValue: null, showingDir: false})
    }
    this.measureViewDim()
  }
  componentWillUnmount () {
    if (this.measureViewDimAF !== null) {
      cancelAnimationFrame(this.measureViewDimAF)
      this.measureViewDimAF = null
      return
    }
  }
  load (doc = this.props.doc, page = this.props.page) {
    if (this.currentLoading && this.currentLoading.doc === doc && this.currentLoading.page === page) return // Avoid duplicate requests.
    this.currentLoading = {doc, page}
    this.setState({loading: true, error: null})
    fetch(`/doc/${doc}/?page=${page}&as=sspdf`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: null, docJson: json, docMeta: json.doc})
      this.currentLoading = null
      if (this.state.dirJson === null || this.props.doc !== doc) {
        this.setState({dirJson: null, relatedDirJson: null, relatedDocId: null})
        this.loadDirs(doc, json.related ? json.related._id : null)
      }
    }, err => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: err, docJson: null})
      this.currentLoading = null
    })
  }
  loadDirs (doc = this.props.doc, relatedDocId) {
    if (this.state.dirJson !== null && this.state.relatedDirJson !== null && this.props.doc === doc) return
    // Load dir of this document
    fetch(`/doc/${doc}/?as=dir`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.doc !== doc) return // Check if the user has changed to another document, just in case.
      this.setState({dirJson: json, dirError: null, relatedDirJson: null, relatedDocId: null})
      // Load dir of corresponding ms or qp.
      if (relatedDocId) {
        fetch(`/doc/${relatedDocId}/?as=dir`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
          if (this.props.doc !== doc) return
          this.setState({relatedDirJson: json, relatedDocId})
        }, err => {
          if (this.props.doc !== doc) return
          this.setState({relatedDirJson: null})
          setTimeout(() => this.loadDirs(doc, relatedDocId), 500)
        })
      }
    }, err => {
      if (this.props.doc !== doc) return
      this.setState({dirJson: null, dirError: err})
      setTimeout(() => this.loadDirs(doc, relatedDocId), 500)
    })
  }
  handlePageInputChange (evt) {
    let pn = parseInt(evt.target.value)
    if (Number.isSafeInteger(this.props.page) && this.state.docMeta && Number.isSafeInteger(pn)) {
      let total = this.state.docMeta.numPages
      let changingTo = pn - 1 // Page index starts from 0
      if (changingTo >= total) {
        changingTo = total - 1
      } else if (changingTo < 0) {
        changingTo = 0
      }
      this.changePage(changingTo)
    } else {
      this.setState({pageInputValue: evt.target.value})
    }
  }
  render () {
    let couldPrev = false
    let couldNext = false
    if (this.state.docMeta) {
      couldPrev = this.props.page > 0
      couldNext = this.props.page + 1 < this.state.docMeta.numPages
    }
    return (
      <div className='filepreview'>
        {!this.state.docMeta && this.state.loading && !this.state.error
          ? <div className='loading'>
              Loading document...
            </div>
          : null}
        {this.state.docMeta
          ? (
              <div className='top'>
                <span className={'prev' + (couldPrev ? '' : ' disabled')} onClick={evt => couldPrev && this.changePage(this.props.page - 1)}>
                  <svg className="icon ii-l"><use href="#ii-l" xlinkHref="#ii-l"></use></svg>
                </span>
                <span className='doc'>
                  {this.state.docMeta.type.toUpperCase()}
                </span>
                &nbsp;-&nbsp;
                <span className='page'>
                  <svg className="icon ii-pg"><use href="#ii-pg" xlinkHref="#ii-pg"></use></svg>
                  &nbsp;
                  <input className='input' type='number' onChange={this.handlePageInputChange} value={this.state.pageInputValue !== null ? this.state.pageInputValue : (this.props.page + 1)} /> / {this.state.docMeta.numPages}
                </span>
                &nbsp;
                <a className='dir' onClick={evt => this.toggleDir()}>
                  <svg className="icon ii-dir"><use href="#ii-dir" xlinkHref="#ii-dir" /></svg>
                </a>
                <a className='download' onClick={evt => this.download()}>
                  <svg className="icon ii-dl"><use href="#ii-dl" xlinkHref="#ii-dl" /></svg>
                </a>
                &nbsp;
                <a className='close' onClick={evt => AppState.dispatch({type: 'closePreview'})}>
                  <svg className="icon ii-c"><use href="#ii-c" xlinkHref="#ii-c" /></svg>
                </a>
                <span className={'next' + (couldNext ? '' : ' disabled')} onClick={evt => couldNext && this.changePage(this.props.page + 1)}>
                  <svg className="icon ii-r"><use href="#ii-r" xlinkHref="#ii-r"></use></svg>
                </span>
              </div>
            )
          : null}
        {!this.state.loading && this.state.error
          ? (
              <div className='error'>
                <div>
                  Unable to preview the document:&nbsp;
                  <span className='msg'>{this.state.error.message}</span>
                </div>
                <div className='retry' onClick={evt => this.load(this.props.doc, this.props.page)}>Try again</div>
                <div className='download' onClick={evt => this.download()}>Download this document</div>
              </div>
            )
          : null}
        {!this.state.error && this.state.docJson
          ? (
            <div className={this.state.loading ? 'pdfview dirty' : 'pdfview'} ref={f => this.sspdfContainer = f}>
              {this.state.showingDir ? <div className='dircontain'><DocDirList dirJson={this.state.dirJson} dirError={this.state.dirError} onSelect={(question, i) => this.selectQuestion(question, i)} /></div> : null}
              <div className={!this.state.dirJson || !this.state.showingDir ? 'show' : 'hide'}>
                <SsPdfView ref={f => this.sspdfView = f} docJson={this.state.docJson} overlay={this.renderOverlay()} width={this.state.measuredViewWidth} height={this.state.measuredViewHeight} />
              </div>
            </div>
          )
          : (this.sspdfContainer = null)}
        {!this.state.error && this.state.loading && !this.state.docJson
          ? (
            <div className='pdfview' ref={f => this.sspdfContainer = f}>
              <SsPdfView
                ref={f => this.sspdfView = f}
                docJson={{
                    width: 420,
                    height: 594,
                    rects: [],
                    text: 'Loading placeholder',
                    svg: require('raw-loader!./sspdf-loading-ani.svg')
                  }}
                width={this.state.measuredViewWidth}
                height={this.state.measuredViewHeight}
                noCacheImage={true} />
            </div>
          )
          : null}
      </div>
    )
  }
  renderOverlay () {
    let doc = this.props.doc
    if (!this.state.loading && this.state.docJson && this.state.dirJson && this.state.relatedDirJson // Fully loaded
      && this.state.dirJson.dirs && this.state.relatedDirJson.dirs // Data valid
    ) {
      let inPageDirs = this.state.dirJson.dirs
        .map((a, i) => Object.assign({}, a, {i})) // Used for tracking which dir is the user clicking, for example.
        .filter(dir => dir.page === this.props.page && dir.qNRect) // We only need those that can be displayed (i.e. has qNRect).
      let isMcqMs = this.state.dirJson.mcqMs // MCQ mark scheme displays differently.
      if (inPageDirs.length > 0) {
        return inPageDirs.map(dir => {
          if (dir.i >= this.state.relatedDirJson.dirs.length) return null
          return {
            boundX: true,
            lt: isMcqMs ? [dir.qNRect.x1 - 2, dir.qNRect.y1 - 1] : [0, dir.qNRect.y1 - 4],
            rb: isMcqMs ? [dir.qNRect.x2 + 2, dir.qNRect.y2 + 1] : [this.state.docJson.width, dir.qNRect.y2 + 4],
            className: 'questionln' + (this.props.highlightingQ === dir.i ? ' highlight' : ''),
            stuff: null,
            onClick: evt => {
              if (!this.state.relatedDirJson || this.props.doc !== doc) {
                return
              }
              let dirMs = this.state.relatedDirJson.dirs[dir.i]
              if (dirMs.qN === dir.qN) {
                AppState.dispatch({type: 'previewFile', fileId: this.state.relatedDocId, page: dirMs.page, highlightingQ: dir.i})
              }
            }
          }
        }).filter(x => x !== null)
      }
    }
    return []
  }
  toggleDir () {
    this.setState({showingDir: !this.state.showingDir})
  }
  download () {
    window.open(`/doc/${this.state.docMeta ? this.state.docMeta._id : this.props.doc}/`)
  }
  changePage (page, highlightingQ) {
    AppState.dispatch({type: 'previewChangePage', page, highlightingQ})
  }
  selectQuestion (question, i) {
    this.setState({showingDir: false})
    this.changePage(question.page, i)
  }
}

module.exports = FilePreview
