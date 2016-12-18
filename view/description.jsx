const React = require('react')
const { createStore } = require('redux')

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

function fetchStatusInfo () {
  if ((statusInfoState.getState() || {}).loading) return
  statusInfoState.dispatch({type: 'unload'})
  fetch('/status/').then(res => res.json()).then(stat => {
    statusInfoState.dispatch({type: 'load', data: stat})
  }, err => {
    statusInfoState.dispatch({type: 'error', err})
  })
}

fetchStatusInfo()

class Description extends React.Component {
  constructor () {
    super()
    this.state = {}
    this.updateStat = this.updateStat.bind(this)
  }
  componentDidMount () {
    this.updateStat()
    statusInfoState.subscribe(this.updateStat)
  }
  updateStat () {
    let st = statusInfoState.getState() || {}
    this.setState({status: st.stat, error: st.err})
  }
  render () {
    let statusInfo = null
    let reloadBtn = (
      <div className="reload">
        <a onClick={fetchStatusInfo}>Refresh</a>
      </div>
    )
    if (this.state.status) {
      let stat = this.state.status
      statusInfo = (
        <div className='status'>
          <div>
            Currently holding {stat.docCount} paper ({stat.indexCount} pages)
          </div>
          <div>
            Load average: {stat.loadAvg.join('/')}
          </div>
          {reloadBtn}
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
      <div className='desc'>
        <div className='links'>
          <a>Usage</a>
          &nbsp;
          <a>Feedback</a>
          &nbsp;
          <a>Disclaimer</a>
          &nbsp;
          <a>API</a>
        </div>
        {statusInfo}
      </div>
    )
  }
}

module.exports = Description
