const React = require('react')
const { createStore } = require('redux')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.jsx')
const CIESubjects = require('./CIESubjects.js')

let statusInfoState = createStore(function (state = {}, action) {
  switch (action.type) {
    case 'load':
      return Object.assign({}, state, {stat: action.data, err: null, loading: false})
    case 'unload':
      return Object.assign({}, state, {stat: null, err: null, loading: true})
    case 'error':
      return Object.assign({}, state, {stat: null, err: action.err, loading: false})
  }
})

let lastTimeout
function fetchStatusInfo () {
  if ((statusInfoState.getState() || {}).loading) return
  if (!AppState.getState().querying) {
    statusInfoState.dispatch({type: 'unload'})
    fetch('/status/').then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(stat => {
      statusInfoState.dispatch({type: 'load', data: stat})
    }, err => {
      statusInfoState.dispatch({type: 'error', err})
    })
    lastTimeout && clearTimeout(lastTimeout)
    lastTimeout = setTimeout(fetchStatusInfo, 5000)
  } else {
    let unsub = AppState.subscribe(() => {
      if (!AppState.getState().querying) {
        unsub()
        fetchStatusInfo()
      }
    })
  }
}

class Description extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
    if (AppState.getState().serverrender) {
      this.state.server = true
      this.state.status = AppState.getState().serverrender.status
    }
    this.updateStat = this.updateStat.bind(this)
    this.handleShowHelp = this.handleShowHelp.bind(this)
    this.handleHideHelp = this.handleHideHelp.bind(this)
  }
  componentDidMount () {
    this.updateStat()
    this.unsub = statusInfoState.subscribe(this.updateStat)
    if (!AppState.getState().serverrender) {
      fetchStatusInfo()
    }
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
  }
  updateStat () {
    let st = statusInfoState.getState() || {}
    this.setState({loading: st.loading, error: st.err})
    if (st.stat) {
      this.setState({status: st.stat})
    } else if (st.server) {
      this.setState({server: true})
    }
  }
  render () {
    let statusInfo = null
    let reloadBtn = (
      <div className="reload">
        <span onClick={fetchStatusInfo}>Refresh</span>
      </div>
    )
    if (this.state.server) {
      statusInfo = (
        <div className='status'>
          Currently supporting&nbsp;
          <a href='/subjects/'>{CIESubjects.length} subjects</a>.
        </div>
      )
    } else if (this.state.status && !this.state.error) {
      let stat = this.state.status
      statusInfo = (
        <div className={'status' + (this.state.loading ? ' loading' : '')}>
          <div>
            Currently supporting&nbsp;
            <a onClick={evt => AppState.dispatch({type: 'subjects'})}>
              {CIESubjects.length} subjects
            </a>: <span>storing {stat.docCount} paper</span> <span>({stat.indexCount} pages).</span>
          </div>
          <div>
            Mystery number: {stat.requestCount}
          </div>
          {this.state.loading ? null : reloadBtn}
        </div>
      )
    } else if (!this.state.error) {
      statusInfo = (
        <div className='status'>
          <div className='loading'>Fetching status information...</div>
        </div>
      )
    } else {
      statusInfo = (
        <div className='status'>
          <FetchErrorPromise.ErrorDisplay error={this.state.error} serverErrorActionText={'fetch status'} />
          {reloadBtn}
        </div>
      )
    }
    return (
      <div className='home-desc'>
        {this.state.server && !this.props.showHelp ? (
          <div className='links'>
            <a href='/disclaim/'>Disclaimer</a>
            &nbsp;
            <a href='https://github.com/micromaomao/schsrch/blob/master/index.js' target='_blank'>API</a>
          </div>
        ) : null}
        <div className='help'>
          {!this.props.showHelp ? (
            <a className='helpbtn' onClick={this.handleShowHelp} href='/help/'>Show help&hellip;</a>
          ) : (
            <a className='helpbtn' onClick={this.handleHideHelp} href='/'>{this.state.server ? 'Back' : 'Close help'}</a>
          )}
        </div>
        {(this.state.server ? AppState.getState().serverrender.siteOrigin : window.location.origin) === 'https://paper.sc' ? (
          <div className='notification'>We changed name! The website is now "paper.sc" and so is its domain, the software is still called the super nonsense name SchSrch.</div>
        ) : (
          <div className='mirrornotice'>You are viewing a mirror of <a href='https://paper.sc'>paper.sc</a>.</div>
        )}
        {!this.props.showHelp ? statusInfo : null}
      </div>
    )
  }

  handleShowHelp (evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'show-help'})
  }
  handleHideHelp (evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'hide-help'})
  }
}

module.exports = Description
