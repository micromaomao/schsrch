const React = require('react')
const { createStore } = require('redux')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')
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
          <div className='error'>Error fetching status info: {this.state.error.message}</div>
          {reloadBtn}
        </div>
      )
    }
    return (
      <div className='home-desc'>
        {this.state.server ? (
          <div className='links'>
            <a href='/disclaim/'>Disclaimer</a>
            &nbsp;
            <a href='https://github.com/micromaomao/schsrch/blob/master/index.js' target='_blank'>API</a>
          </div>
        ) : null}
        {statusInfo}
      </div>
    )
  }
}

module.exports = Description
