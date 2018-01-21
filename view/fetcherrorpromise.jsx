const AppState = require('./appstate.js')
const React = require('react')

class ErrorDisplay extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
  }

  render () {
    let err = this.props.error
    if (!err) {
      err = {
        message: 'Unknow error',
        unknow: true
      }
    }
    if (err instanceof Error) {
      err = {
        type: 'generic',
        unknow: false,
        message: err.message
      }
    } else {
      err = Object.assign({
        unknow: false,
        type: 'generic',
        status: null
      }, err)
    }

    let retryBtn = null
    if (this.props.onRetry) {
      retryBtn = (
        <div className='retry' onClick={this.props.onRetry}>
          Retry
        </div>
      )
    }

    if (err.status === '500') {
      return (
        <div className='error-display'>
          <div className='heading'>
            The server is having some problem&hellip;{retryBtn}
          </div>
          <div className='message'>
            Unfortunately, we are unable to {this.props.serverErrorActionText || 'do this'} currently, as something has gone (very) wrong on our server.
          </div>
          {this.props.submessage || null}
          <div className='submessage'>
            <p>Perhaps try again later, and if the problem persists, contact Mao for technical support.</p>
            <p>The url of your request is <code>{err.url || 'undefined'}</code>. Please include this with your report if you plan to contact anyone.</p>
            <p>Sorry about this&hellip;</p>
          </div>
        </div>
      )
    }

    return (
      <div className='error-display'>
        <div className='heading'>
          {err.type === 'generic' ? 'An error occurred\u2026' : `A ${err.type} error occurred\u2026`}{retryBtn}
        </div>
        <div className='message'>
          {err.unknow ? '???' : err.message}
        </div>
        {err.type === 'network' ? (
          <div className='submessage'>
            <p>This may means that SchSrch is down, but please check your network connection.</p>
          </div>
        ) : null}
        {this.props.submessage || null}
      </div>
    )
  }
}

module.exports = {
  then: res => new Promise((resolve, reject) => {
    if (!res.ok) {
      res.text().then(rspText => {
        reject({
          message: res.status.toString() === '500' ? 'Sorry, but something has gone (very) wrong on our server. Please try again later.' : rspText,
          status: res.status.toString(),
          url: res.url
        })
        if (rspText.trim() === 'Authorization token invalid.') {
          AppState.dispatch({type: 'clear-token'})
        }
      }, reject)
    } else {
      resolve(res)
    }
  }),
  error: err => new Promise((resolve, reject) => {
    reject({
      type: 'network',
      message: 'Unable to reach the server'
    })
  }),
  ErrorDisplay
}
