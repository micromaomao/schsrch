const React = require('react')
const PaperUtils = require('./paperutils.js')
const SsPdfView = require('./sspdfview.jsx')
const AppState = require('./appstate.js')
const DocDirList = require('./docdirlist.jsx')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const {view2client} = require('./pointutils.js')

// TODO: Highlight

class FilePreview extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      loading: false,
      error: null,
      docJson: null,
      docMeta: null,
      pageInputValue: null,
      batchDirs: null,
      dirsError: null,
      showingDir: false,
      measuredViewWidth: 0,
      measuredViewHeight: 0,
      cropBoundary: null,
      fullscreen: false
    }
    this.currentLoading = null
    this.measureViewDimAF = null
    this.handlePageInputChange = this.handlePageInputChange.bind(this)
    this.measureViewDim = this.measureViewDim.bind(this)
    this.handleGlobaleKey = this.handleGlobaleKey.bind(this)
    this.handleSelect = this.handleSelect.bind(this)
    this.handleResetCrop = this.handleResetCrop.bind(this)
    this.handleDownload = this.handleDownload.bind(this)
    this.handleSearchSet = this.handleSearchSet.bind(this)
    this.handleDirSelect = this.handleDirSelect.bind(this)
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
      this.load()
    }
    this.measureViewDim()
    window.document.addEventListener('keydown', this.handleGlobaleKey, AppState.browserSupportsPassiveEvents ? {passive: true} : false)
  }
  componentWillUnmount () {
    if (this.measureViewDimAF !== null) {
      cancelAnimationFrame(this.measureViewDimAF)
      this.measureViewDimAF = null
      return
    }
    window.document.removeEventListener('keydown', this.handleGlobaleKey)
  }
  handleGlobaleKey (evt) {
    if (!AppState.shouldResponseKeyboardShortcut()) return
    if (evt.key === 'ArrowLeft' || evt.keyCode === 37
      || evt.key === 'h' || evt.keyCode === 72) {
      this.changePage(this.props.page - 1)
    } else if (evt.key === 'ArrowRight' || evt.keyCode === 39
      || evt.key === 'l' || evt.keyCode === 76) {
      this.changePage(this.props.page + 1)
    } else if (evt.key === '0' || evt.keyCode === 48
      || evt.key === '1' || evt.keyCode === 49) {
      this.changePage(0)
    } else if (evt.key === 'f' || evt.keyCode === 70) {
      this.toggleFullScreen()
    } else if (evt.key === 'd' || evt.keyCode === 68) {
      this.toggleDir()
    } else if (evt.key === 'q' || evt.keyCode === 81) {
      AppState.dispatch({type: 'closePreview'})
    }
  }
  toggleFullScreen () {
    if (window.document.fullscreenElement) {
      window.document.exitFullscreen()
      this.setState({fullscreen: false})
      return
    }
    if (this.mainDiv) {
      if (this.mainDiv.requestFullscreen) {
        this.mainDiv.requestFullscreen()
        this.setState({fullscreen: true})
      }
    }
  }
  componentWillReceiveProps (nextProps) {
    if (!this.props || nextProps.doc !== this.props.doc || nextProps.page !== this.props.page) {
      if (!this.props || nextProps.doc !== this.props.doc) this.setState({docMeta: null, batchDirs: null})
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
    if (this.props.shouldUseFixedTop && this.mainDiv && !window.document.fullscreenElement && this.state.measuredViewHeight) {
      let topleft = view2client([0, 0], this.mainDiv)
      if (topleft[1] < 46 && topleft[1] + this.state.measuredViewHeight > -0.001) {
        if (!this.state.topFixed) this.setState({topFixed: true})
      } else {
        if (this.state.topFixed) this.setState({topFixed: false})
      }
    }
    if (this.mainDiv) {
      if (window.document.fullscreenElement === this.mainDiv && !this.state.fullscreen) {
        this.setState({fullscreen: true})
      } else if (!window.document.fullscreenElement && this.state.fullscreen) {
        this.setState({fullscreen: false})
      }
    }
  }
  load (doc = this.props.doc, page = this.props.page) {
    if (this.currentLoading && this.currentLoading.doc === doc && this.currentLoading.page === page) return // Avoid duplicate requests.
    this.currentLoading = {doc, page}
    this.setState({loading: true, error: null})
    fetch(`/doc/${doc}/?page=${page}&as=sspdf&decache=${AppState.sspdfDecacheVersion}`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: null, docJson: json, docMeta: json.doc})
      this.currentLoading = null
      if (this.state.batchDirs === null) {
        this.setState({dirsError: null})
        this.loadDirs(doc)
      }
    }, err => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: err, docJson: null})
      this.currentLoading = null
    })
  }
  loadDirs (doc = this.props.doc) {
    fetch(`/dirs/batch/?docid=${encodeURIComponent(doc)}`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.doc !== doc) return // Check if the user has changed to another document, just in case.
      this.setState({batchDirs: json, dirsError: null})
      if (AppState.getState().previewing.jumpToHighlight && this.state.docMeta) {
        let cDir = json[this.state.docMeta.type]
        if (cDir && cDir.type === 'questions') {
          let hlI = AppState.getState().previewing.highlightingDirIndex
          if (!Number.isSafeInteger(hlI)) return
          let hlDir = cDir.dirs[hlI]
          if (hlDir) {
            AppState.dispatch({type: 'doJumpToHighlight', page: hlDir.page})
          }
        }
      }
    }, err => {
      if (this.props.doc !== doc) return
      this.setState({batchDirs: null, dirsError: err})
      setTimeout(() => this.loadDirs(doc), 1000)
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
      <div className={'filepreview' + (this.state.fullscreen ? ' fullscreen' : '')} ref={f => this.mainDiv = f}>
        {!this.state.docMeta && this.state.loading && !this.state.error
          ? <div className='loading'>
              Loading document...
            </div>
          : null}
        {this.state.docMeta
          ? (
              <div className={'top' + (this.state.topFixed ? ' fixed' : '')}>
                <a className={'prev' + (couldPrev ? '' : ' disabled')} onClick={evt => couldPrev && this.changePage(this.props.page - 1)}>
                  <svg className="icon ii-l"><use href="#ii-l" xlinkHref="#ii-l"></use></svg>
                </a>
                <a className='doc' href={`/search/?as=page&query=${encodeURIComponent(this.getSetName())}`} onClick={this.handleSearchSet}>
                  {this.state.docMeta.type.toUpperCase()}
                </a>
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
                <a className='crop' onClick={evt => this.crop()}>
                  <svg className="icon ii-crop"><use href="#ii-crop" xlinkHref="#ii-crop" /></svg>
                </a>
                <a className='download' onClick={this.handleDownload} href={this.getDownloadUrl()}>
                  <svg className="icon ii-dl"><use href="#ii-dl" xlinkHref="#ii-dl" /></svg>
                </a>
                <a className='fullscreen' onClick={evt => this.toggleFullScreen()}>
                  <svg className="icon ii-fullscreen"><use href="#ii-fullscreen" xlinkHref="#ii-fullscreen" /></svg>
                </a>
                <a className='close' onClick={evt => AppState.dispatch({type: 'closePreview'})}>
                  <svg className="icon ii-c"><use href="#ii-c" xlinkHref="#ii-c" /></svg>
                </a>
                &nbsp;
                <a className={'next' + (couldNext ? '' : ' disabled')} onClick={evt => couldNext && this.changePage(this.props.page + 1)}>
                  <svg className="icon ii-r"><use href="#ii-r" xlinkHref="#ii-r"></use></svg>
                </a>
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
                <div className='download' onClick={this.handleDownload}>Download this document</div>
              </div>
            )
          : null}
        {!this.state.error && this.state.docJson
          ? (
            <div className={this.state.loading ? 'pdfview dirty' : 'pdfview'} ref={f => this.sspdfContainer = f}>
              {this.state.showingDir && this.state.batchDirs ? <div className='dircontain'><DocDirList dirJson={this.getDirForCurrentDoc()} dirError={this.state.dirsError} onSelect={this.handleDirSelect} /></div> : null}
              <div className={!this.state.batchDirs || !this.state.showingDir ? 'show' : 'hide'}>
                <SsPdfView
                  ref={f => this.sspdfView = f}
                  docJson={this.state.docJson}
                  overlay={this.renderOverlay()}
                  width={this.state.measuredViewWidth}
                  height={this.state.measuredViewHeight}
                  cropBoundary={this.state.cropBoundary}
                  onCropBoundaryChange={cropBoundary => this.setState({cropBoundary})} />
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
                skipProcessDoc={true}
                cropBoundary={null} />
            </div>
          )
          : null}
        {this.state.cropBoundary
          ? (
              <div className='selectprompt'>
                <a onClick={this.handleSelect}>select this crop</a>
                &nbsp;
                <a onClick={this.handleResetCrop}>reset crop area</a>
                &nbsp;
                <a onClick={evt => this.setState({cropBoundary: null})}>cancel</a>
              </div>
            )
          : null}
      </div>
    )
  }
  renderOverlay () {
    // This function returns the overlay array used by sspdf to display, for example, links to ms/qp/er on top of the document.
    let doc = this.props.doc
    if (this.state.loading || !this.state.docMeta || !this.state.docJson) return []
    let pgWidth = this.state.docJson.width
    try {
      let currentType = this.state.docMeta.type
      let bDirs = this.state.batchDirs
      if (!bDirs) return []
      let currentDir = bDirs[currentType]
      if (!currentDir) return []
      let thisPv = this.state.docMeta.paper.toString() + this.state.docMeta.variant.toString()

      let erDir = null // {dirs: {qNs: ...}-like objects} for the er of this qp/ms. Null if currentType === 'er'.
      if (bDirs.er && bDirs.er.type === 'er' && currentType !== 'er') {
        erDir = bDirs.er.papers.find(p => p.pv === thisPv) || null // Find the corrosponding paper
      }

      let relatedDir = null // for qp, this is the ms dir, and for ms, this is the qp dir. Same for sp and sm. For er, this is the qp, although ms should work equally well.
      let theOtherType = (() => {
        switch (currentType) {
          case 'qp': return 'ms'
          case 'ms': return 'qp'
          case 'sp': return 'sm'
          case 'sm': return 'sp'
          case 'er': return 'qp'
          default: return null
        }
      })()
      if (theOtherType) relatedDir = bDirs[theOtherType]
      if (!relatedDir && currentType !== 'er') return []

      let inPageDirs = null // {qN: ...}-like objects in current page.
        // For erdirs, this is an array of {qNs: ...}-like objects, except
        // the objects also has docid and pv properties assigned.
        // For normal dirs, i as in Index is assigned to each object.
      if (currentDir.type === 'questions' || currentDir.type === 'mcqMs') {
        inPageDirs = currentDir.dirs
          .map((a, i) => Object.assign({}, a, {i})) // Used for tracking which dir is the user clicking, for example.
          .filter(dir => dir.page === this.props.page && dir.qNRect) // We only need those that can be displayed (i.e. has qNRect).
      } else if (currentDir.type === 'er') {
        inPageDirs = []
        for (let erDir of currentDir.papers) {
          // erDir.docid is the doc._id of the destination question paper.
          if (!erDir.docid) continue
          Array.prototype.push.apply(inPageDirs,
            erDir.dirs.filter(dir => dir.page === this.props.page && dir.qNRect)
              .map((a, i) => Object.assign({}, a, {i, docid: erDir.docid, pv: erDir.pv}))
          )
        }
      }
      if (!inPageDirs || inPageDirs.length === 0) return []

      let isMcqMs = currentDir.type === 'mcqMs'
      let erBtnWidth = currentType !== 'er' ? 40 : 0
      let highlightDirIdx = this.props.highlightingDirIndex
      let linksToRelated = (relatedDir || currentType === 'er') ? inPageDirs.map(dir => {
        if (currentType !== 'er' && dir.i >= relatedDir.dirs.length) return null
        return {
          boundX: true,
          lt: isMcqMs ? [dir.qNRect.x1 - 2, dir.qNRect.y1 - 1] : [0, dir.qNRect.y1 - 4],
          rb: isMcqMs ? [dir.qNRect.x2 + 2, dir.qNRect.y2 + 1] : [pgWidth - erBtnWidth, dir.qNRect.y2 + 4],
          className: 'questionln' +
            (((currentDir.type === 'questions' || currentDir.type === 'mcqMs') && highlightDirIdx === dir.i)
              || (currentDir.type === 'er' && (typeof highlightDirIdx === 'object') && highlightDirIdx.pv === dir.pv && dir.qNs.includes(highlightDirIdx.qN)) ? ' highlight' : ''),
          stuff: null,
          onClick: evt => {
            if (this.props.doc !== doc) return
            if (relatedDir && currentType !== 'er') {
              // Go to qp/ms
              let dirRl = relatedDir.dirs[dir.i]
              if (!dirRl || dirRl.qN !== dir.qN) return
              AppState.dispatch({type: 'previewFile', fileId: relatedDir.docid, page: dirRl.page, highlightingDirIndex: dir.i})
            } else if (currentType === 'er') {
              if (dir.docid) {
                AppState.dispatch({type: 'previewFile', fileId: dir.docid, page: 0, highlightingDirIndex: dir.qNs[0] - 1, jumpToHighlight: true})
              }
            }
          }
        }
      }) : []
      let linksToEr = (currentType !== 'er' && erDir && !isMcqMs) ? inPageDirs.map(dir => {
        let erD = erDir.dirs.find(d => d.qNs.includes(dir.qN))
        if (!erD) return null
        return {
          boundX: false,
          lt: [pgWidth - erBtnWidth, dir.qNRect.y1 - 4],
          rb: [pgWidth, dir.qNRect.y2 + 4],
          className: 'erbtn',
          stuff: null,
          onClick: evt => {
            if (this.props.doc !== doc) return
            AppState.dispatch({type: 'previewFile', fileId: this.state.batchDirs.er.docid, page: erD.page, highlightingDirIndex: {pv: thisPv, qN: dir.qN}})
          }
        }
      }) : []
      return linksToRelated.concat(linksToEr).filter(x => x !== null)
    } catch (e) {
      console.error('Unable to renderOverlay.')
      console.error(e)
      return [{
        boundX: true,
        boundY: true,
        lt: [-Infinity, -Infinity],
        rb: [Infinity, 50],
        className: 'diroverlayerror',
        stuff: (
          <div>
            Something went wrong when trying to display dir links. Sorry for that.
          </div>
        )
      }]
    }
  }
  toggleDir () {
    this.setState({showingDir: !this.state.showingDir})
  }
  getDownloadUrl () {
    return `/doc/${this.state.docMeta ? this.state.docMeta._id : this.props.doc}/`
  }
  handleDownload (evt) {
    evt.preventDefault()
    window.open(this.getDownloadUrl())
  }
  changePage (page, highlightingDirIndex) {
    if (!this.state.docMeta) return
    if (page < 0 || page >= this.state.docMeta.numPages) return
    AppState.dispatch({type: 'previewChangePage', page, highlightingDirIndex})
  }
  handleDirSelect (page, dirIndex) {
    this.setState({showingDir: false})
    this.changePage(page, dirIndex)
  }
  crop () {
    if (!this.state.docJson || !this.state.docMeta || this.state.cropBoundary || !this.sspdfView) return
    this.sspdfView.startCrop()
  }
  handleSelect () {
    AppState.dispatch({
      type: 'set-paper-crop-clipboard',
      doc: this.props.doc,
      page: this.props.page,
      docMeta: this.state.docMeta,
      boundary: this.state.cropBoundary
    })
    this.setState({cropBoundary: null})
  }
  handleResetCrop () {
    if (!this.state.docJson) return
    this.setState({
      cropBoundary: [0, 0, this.state.docJson.width, this.state.docJson.height]
    })
  }
  getSetName () {
    if (!this.state.docMeta) throw new Error('this.state.docMeta not loaded.')
    return PaperUtils.setToString(this.state.docMeta)
  }
  handleSearchSet (evt) {
    evt.preventDefault()
    let setName = this.getSetName()
    AppState.dispatch({type: 'query', query: setName})
    AppState.dispatch({type: 'previewFile', fileId: this.props.doc, page: this.props.page, psKey: setName})
  }

  getDirForCurrentDoc () {
    if (!this.state.docMeta) return null
    let { type } = this.state.docMeta
    if (!this.state.batchDirs) return null
    return this.state.batchDirs[type]
  }
}

module.exports = FilePreview
