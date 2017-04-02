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
      msRef: null
    }
    this.currentLoading = null
    this.handlePageInputChange = this.handlePageInputChange.bind(this)
  }
  componentDidMount () {
    if (this.props && this.props.doc) {
      this.loadFromProps(this.props)
    }
  }
  componentWillReceiveProps (nextProps) {
    if (!this.props || nextProps.doc !== this.props.doc || nextProps.page !== this.props.page) {
      if (!this.props || nextProps.doc !== this.props.doc) this.setState({docMeta: null})
      this.loadFromProps(nextProps)
    }
  }
  loadFromProps (props) {
    let {doc, page} = props
    this.load(doc, page)
  }
  componentDidUpdate (prevProps, prevState) {
    if (prevProps.doc !== this.props.doc || prevProps.page !== this.props.page) {
      this.pdfView.reCenter()
      this.setState({pageInputValue: null, showingDir: false})
    }
  }
  load (doc = this.props.doc, page = this.props.page) {
    if (this.currentLoading && this.currentLoading.doc === doc && this.currentLoading.page === page) return
    this.currentLoading = {doc, page}
    this.setState({loading: true, error: null})
    fetch(`/sspdf/${doc}/${page}/`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: null, docJson: json, docMeta: json.doc})
      this.currentLoading = null
    }, err => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: err, docJson: null})
      this.currentLoading = null
    })

    if (this.state.dirJson === null || this.props.doc !== doc) {
      this.setState({dirJson: null, msRef: null})
      this.refetchDir(doc)
    }
  }
  refetchDir (doc = this.props.doc) {
    if (this.state.dirJson !== null && this.state.msRef !== null && this.props.doc === doc) return
    fetch(`/docdir/${doc}/`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.doc !== doc) return
      this.setState({dirJson: json, dirError: null, msRef: null})
      fetch(`/msdir/${doc}/`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
        if (this.props.doc !== doc) return
        this.setState({msRef: json})
      }, err => {
        if (this.props.doc !== doc) return
        this.setState({msRef: null})
        setTimeout(() => this.refetchDir(doc), 500)
      })
    }, err => {
      if (this.props.doc !== doc) return
      this.setState({dirJson: null, dirError: err})
      setTimeout(() => this.refetchDir(doc), 500)
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
              <div className='download' onClick={evt => this.download()}>Download this document</div>
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
            <div className='whitebg'>
              <div className={this.state.loading ? 'pdfview dirty' : 'pdfview'}>
                {this.state.showingDir ? <DocDirList dirJson={this.state.dirJson} dirError={this.state.dirError} onSelect={question => this.selectQuestion(question)} /> : null}
                <div className={!this.state.dirJson || !this.state.showingDir ? 'show' : 'hide'}>
                  <SsPdfView ref={f => this.pdfView = f} docJson={this.state.docJson} msref={this.renderMsref()} />
                </div>
              </div>
            </div>
          )
          : null}
      </div>
    )
  }
  renderMsref () {
    return [
      {
        className: 'test',
        lt: [100, 100],
        rb: [400, 150],
        boundX: true,
        stuff: (
          <div style={{width: '100%', height: '100%', backgroundColor: 'rgba(255, 0, 0, 0.3)'}} onClick={evt => {
            console.log('ha!')
          }}>Hello world!</div>
        )
      }
    ]
  }
  toggleDir () {
    this.setState({showingDir: !this.state.showingDir})
  }
  download () {
    window.open(`/fetchDoc/${this.state.docMeta ? this.state.docMeta._id : this.props.doc}/`)
  }
  changePage (page) {
    AppState.dispatch({type: 'previewChangePage', page})
  }
  selectQuestion (question) {
    this.setState({showingDir: false})
    this.changePage(question.page)
  }
}

module.exports = FilePreview
