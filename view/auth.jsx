const React = require('react')
const FetchErrorPromise = require('./fetcherrorpromise.js')

class LoginView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      loginRegister: 'select', // 'select', 'login', 'register'
      tokenInput: '',
      requestState: null,
      lastError: null,
      usernameInput: '',
      usernameCheckState: null
    }
    this.handleTokenInput = this.handleTokenInput.bind(this)
    this.handleUsernameInput = this.handleUsernameInput.bind(this)
  }
  render () {
    if (!this.props.loginState) return null
    let existingToken = AppState.getState().authToken
    return (
      <div className='contain'>
        <h1>Login to SchSrch&hellip;</h1>
        {this.state.lastError
          ? (
              <div className='error'>
                {this.state.lastError.toString()}
              </div>
            )
          : null}
        {!this.state.requestState && !existingToken && this.state.loginRegister === 'select'
          ? (
              <div className='rlSelect'>
                <p>
                  If you haven't created a SchSrch authentication token yet, please choose "New
                  Token". If you did created a token before and you backed it up, please enter
                  the token below.
                </p>
                <p>
                  If you have a token before and don't have a backup of that token, than
                  unfortunately you have lost access to it permanently. Please create a new one.
                </p>
                <input type='text' className='tokenInput' placeholder='Input token here' value={this.state.tokenInput} onInput={this.handleTokenInput} />
                <div className='btn'>
                  <a onClick={evt => this.setState({loginRegister: 'register', lastError: null})}>New Token</a>
                  &nbsp;
                  <a onClick={evt => this.tryToken(this.state.tokenInput)}>Login</a>
                </div>
              </div>
            )
          : null}
        {!this.state.requestState && !existingToken && this.state.loginRegister === 'register'
          ? (
              <div className='rlRegister'>
                <div className='back' onClick={evt => this.setState({loginRegister: 'select', lastError: null})}>Back</div>
                <p>
                  Please provide a username that will be displayed to others on stuff your
                  create. This name can be changed later but must be unique.
                </p>
                <input
                  type='text'
                  className={'usernameInput ' + (this.state.usernameCheckState || 'normal')}
                  placeholder='Must not contain space.'
                  value={this.state.usernameInput}
                  onInput={this.handleUsernameInput} />
                {this.state.usernameCheckState !== 'exist'
                  ? (
                      <div className='btn'>
                        <a onClick={evt => this.doRegister(this.state.usernameInput)}>Get me token!</a>
                      </div>
                    )
                  : null}
              </div>
            )
          : null}
        {this.state.requestState
          ? (
              <div className='progress'>
                {this.state.requestState.progressText}&hellip;
              </div>
            )
          : null}
      </div>
    )
  }

  handleTokenInput (evt) {
    let tokenInput = evt.target.value
    let tokenFormatted = ''
    let j = 0
    for (let i = 0; i < tokenInput.length; i ++) {
      if (j >= 16 * 2) break
      let iChar = tokenInput[i].toLowerCase()
      if (/^[0-9a-f]$/.test(iChar)) {
        j ++
        tokenFormatted += iChar
        if (j % 2 === 0)
          tokenFormatted += ' '
      }
    }
    if (tokenFormatted[tokenFormatted.length - 1] === ' ')
      tokenFormatted = tokenFormatted.substr(0, tokenFormatted.length - 1)
    this.setState({tokenInput: tokenFormatted, lastError: null})
  }

  tryToken (token = this.state.tokenInput) {
    let tokenHex = token.replace(/[^0-9a-f]/g, '')
    if (tokenHex.length <= 0) {
      this.setState({
        lastError: 'Please enter your token.'
      })
      return
    }
    this.setState({
      requestState: {
        progressText: 'Checking your token'
      },
      lastError: null
    })
    let authHeaders = new Headers({
      'Authorization': 'Bearer ' + tokenHex
    })
    fetch('/auth/', {headers: authHeaders}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(res => {
      AppState.dispatch({type: 'finish-login', token: tokenHex})
    }, err => {
      this.setState({
        requestState: null,
        lastError: err.message
      })
    })
  }
  
  handleUsernameInput (evt) {
    let username = evt.target.value.replace(/\s/g, '')
    this.setState({usernameInput: username, usernameCheckState: null, lastError: null})
    if (username.trim().length === 0) {
      return
    }
    fetch(`/auth/${encodeURIComponent(username)}/`, {method: 'HEAD'}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
      if (this.state.usernameInput !== username) return
      this.setState({usernameCheckState: 'exist', lastError: 'Username already existed.'})
    }, err => {
      if (this.state.usernameInput !== username) return
      if (/404/.test(err.message)) {
        this.setState({usernameCheckState: 'ok', lastError: null})
      } else {
        this.setState({usernameCheckState: null, lastError: err})
      }
    })
  }
  doRegister (username = this.state.usernameInput) {
    if (username.length === 0) {
      this.setState({
        requestState: null,
        lastError: 'Username required.'
      })
      return
    }
    this.setState({
      requestState: {
        progressText: `Getting new token with username ${username}`
      },
      lastError: null
    })
    fetch(`/auth/${encodeURIComponent(username)}/`, {method: 'POST'}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(res => {
      AppState.dispatch({type: 'finish-login', token: res.authToken})
    }, err => {
      this.setState({
        requestState: null,
        lastError: err.message
      })
    })
  }
}

module.exports = { LoginView }
