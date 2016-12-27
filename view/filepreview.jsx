const React = require('react')
const PaperUtils = require('./paperutils.js')
const SsPdfView = require('./sspdfview.jsx')
const AppState = require('./appstate.js')

// TODO: Highlight

class FilePreview extends React.Component {
  constructor () {
    super()
    this.state = {
      loading: false,
      error: null,
      docJson: null,
      docMeta: null
    }
  }
  componentDidMount () {
    if (this.props && this.props.doc) {
      this.setState({docMeta: null})
      this.load(this.props.doc, this.props.page)
    }
  }
  componentWillReceiveProps (nextProps) {
    if (!this.props || nextProps.doc !== this.props.doc || nextProps.page !== this.props.page) {
      this.setState({docMeta: null})
      this.load(nextProps.doc, nextProps.page)
    }
  }
  load (doc, page) {
    this.setState({loading: true, docJson: null, error: null})
    fetch(`/sspdf/${doc}/${page}/`).then(res => new Promise((resolve, reject) => {
      if (!res.ok) {
        reject(res.statusText)
      } else {
        resolve(res)
      }
    })).then(res => res.json()).then(json => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: null, docJson: json, docMeta: json.doc})
    }, err => {
      if (this.props.doc !== doc || this.props.page !== page) return
      this.setState({loading: false, error: err})
    })
  }
  render () {
    return (
      <div className='filepreview'>
        {!this.state.docMeta && this.state.loading && !this.state.error
          ? <div className='loading'>Loading document...</div>
          : null}
        {this.state.docMeta
          ? (
              <div className='top'>
                <span className='doc'>
                  {PaperUtils.setToString(this.state.docMeta)}_{this.state.docMeta.type}
                </span>
                &nbsp;-&nbsp;
                <span className='page'>
                  page {this.props.page + 1} / {this.state.docMeta.numPages}
                </span>
                &nbsp;
                <a className='download' onClick={evt => this.download()}>
                  download
                </a>
                &nbsp;
                <a className='close' onClick={evt => AppState.dispatch({type: 'closePreview'})}>
                  close
                </a>
              </div>
            )
          : null}
        {!this.state.loading && this.state.error && !this.state.docJson
          ? (
              <div className='error'>
                Can't load document:
                <div>{this.state.error.message}</div>
                <div className='retry' onClick={evt => this.load(this.props.doc, this.props.page)}>Try again</div>
              </div>
            )
          : null}
        {!this.state.loading && !this.state.error && this.state.docJson
          ? (
            <SsPdfView docJson={this.state.docJson} />
          )
          : null}
      </div>
    )
  }
  download () {
    window.open(`/fetchDoc/${this.state.docMeta._id}/`)
  }
}

module.exports = FilePreview
