import * as React from 'react'
import * as FetchErrorPromise from './fetcherrorpromise.jsx'
import { AppState } from './appstate.js'

class LoginView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      stage: 'username', // username, authToken, setPassword
      tokenInput: '',
      usernameInput: '',
      passwordInput: '',
      usernameCheckState: null,
      requestState: null,
      lastError: null,
      regNewToken: null
    }
    this.handleUsernameInput = this.handleUsernameInput.bind(this)
    this.handlePasswordInput = this.handlePasswordInput.bind(this)
    this.handleTryPassword = this.handleTryPassword.bind(this)
    this.handleRegister = this.handleRegister.bind(this)
    this.handleSetPassword = this.handleSetPassword.bind(this)
    this.handleTokenInput = this.handleTokenInput.bind(this)
    this.handleTryToken = this.handleTryToken.bind(this)
  }
  render () {
    return (
      <div className='contain'>
        <h1>Login / Register&hellip;</h1>
        {this.state.lastError
          ? (
              <FetchErrorPromise.ErrorDisplay error={this.state.lastError} serverErrorActionText={'log you in'} />
            )
          : null}
        {!this.state.requestState && this.state.stage === 'username'
          ? (
              <div className='stage username'>
                <div className='back bmargin' onClick={evt => this.cancel()}>Close</div>
                <input type='text' placeholder='Your username' className='usernameInput' value={this.state.usernameInput} onChange={this.handleUsernameInput} />
                {this.state.usernameCheckState !== 'exist'
                  ? (
                      <p>
                        If you haven't registered before, simply enter the username you want to use.
                        This name can be changed later but must be unique. Must not contain space.
                      </p>
                    ) : null}
                {this.state.usernameCheckState
                  ? (() => {
                      let checkState = this.state.usernameCheckState
                      if (checkState === 'checking') {
                        return (
                          <div className='cstate loading'>
                            Just a moment&hellip;
                          </div>
                        )
                      } else if (checkState === 'exist') {
                        return (
                          <div className='cstate exist'>
                            <p>
                              Welcome back, {this.state.usernameInput}.
                            </p>
                            <input type='password' placeholder='Password' className='passwordInput' value={this.state.passwordInput} onChange={this.handlePasswordInput}/>
                            <div className='btn'>
                              <a onClick={this.handleTryPassword}>Login</a>
                            </div>
                            <p>
                              Sorry, there is no "forget password" yet.
                            </p>
                          </div>
                        )
                      } else if (checkState === 'notexist') {
                        return (
                          <div className='cstate notexist'>
                            <p>
                              There is no user with the name "{this.state.usernameInput}".
                            </p>
                            <div className='btn'>
                              <a onClick={this.handleRegister}>Register</a>
                            </div>
                            <p className='license'>
                              By registering on this site, you allow all your public collections to be
                              published under any Creative Common license of your choice that do not prohibit
                              adaptations of your work to be shared. This is the only condition for your
                              registration.
                            </p>
                          </div>
                        )
                      } else return null
                    })() : null}
                {!this.state.usernameCheckState
                  ? (
                      <div className='btn'>
                        <a onClick={evt => this.setState({stage: 'authToken'})}>Use session token (for nerd)</a>
                      </div>
                    ) : null}
              </div>
            )
          : null}
        {!this.state.requestState && this.state.stage === 'setPassword'
          ? (
              <div className='stage setPassword'>
                <p>
                  You have been logged-in, but unless you set a password, you won't be able to access this account again.
                </p>
                <input type='password' className='passwordInput' placeholder='New Password' value={this.state.passwordInput} onChange={this.handlePasswordInput} />
                <div className='btn'>
                  <a onClick={this.handleSetPassword}>Set password</a>
                  <a onClick={evt => this.cancel()}>Later</a>
                </div>
              </div>
            )
          : null}
        {!this.state.requestState && this.state.stage === 'authToken'
          ? (
              <div className='stage authToken'>
                <div className='back bmargin' onClick={evt => this.setState({stage: 'username', lastError: null})}>Back</div>
                <input className='tokenInput' value={this.state.tokenInput} onChange={this.handleTokenInput} placeholder='Auth token' />
                <div className='btn'>
                  <a onClick={this.handleTryToken}>Login</a>
                </div>
              </div>
            ) : null}
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

  handleTryToken () {
    let token = this.state.tokenInput
    let tokenHex = token.replace(/[^0-9a-f]/g, '')
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
        lastError: err
      })
    })
  }

  handleUsernameInput (evt) {
    let username = evt.target.value.replace(/\s/g, '')
    this.setState({usernameInput: username, usernameCheckState: 'checking', lastError: null})
    if (username.trim().length === 0) {
      this.setState({usernameCheckState: null})
      return
    }
    fetch(`/auth/${encodeURIComponent(username)}/`, {method: 'HEAD'}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
      if (this.state.usernameInput !== username) return
      this.setState({usernameCheckState: 'exist'})
    }, err => {
      if (this.state.usernameInput !== username) return
      if (err.status === '404') {
        this.setState({usernameCheckState: 'notexist'})
      } else {
        this.setState({usernameCheckState: null, lastError: err})
      }
    })
  }

  handleRegister () {
    let username = this.state.usernameInput
    if (username.length === 0) {
      return
    }
    this.setState({
      requestState: {
        progressText: `Registering ${username}`
      },
      lastError: null
    })
    let ctHeaders = new Headers()
    ctHeaders.append('Content-Type', 'application/json')
    let tokenHex = null
    let timeout = null
    try {
      if (!window.crypto || !window.crypto.getRandomValues) throw new Error('Browser no getRandomValues support.')
      let byteArray = new Uint8Array(16)
      window.crypto.getRandomValues(byteArray)
      tokenHex = Array.prototype.map.call(byteArray, b => {
        let str = '00' + b.toString(16)
        return str.slice(-2)
      }).join('')
      timeout = setTimeout(function () {
        AppState.dispatch({type: 'set-token', token: tokenHex})
      }, 2000)
    } catch (e) {
      console.error(e)
      tokenHex = null
    }
    fetch(`/auth/${encodeURIComponent(username)}/`, {method: 'POST', headers: ctHeaders, body: JSON.stringify({
      authToken: tokenHex
    })}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(res => {
      AppState.dispatch({type: 'set-token', token: res.authToken})
      this.setState({
        stage: 'setPassword',
        regNewToken: res.authToken,
        requestState: null,
        lastError: null
      })
      if (timeout) clearTimeout(timeout)
    }, err => {
      this.setState({
        requestState: null,
        lastError: err
      })
      if (timeout) clearTimeout(timeout)
    })
  }

  handlePasswordInput (evt) {
    let password = evt.target.value
    this.setState({passwordInput: password, lastError: null})
  }

  handleTryPassword (evt) {
    let {usernameInput: username, passwordInput: password} = this.state
    this.setState({
      requestState: {
        progressText: 'Logging in'
      },
      lastError: null
    })
    let ctHeaders = new Headers()
    ctHeaders.append('Content-Type', 'application/json')
    fetch(`/auth/${encodeURIComponent(username)}/newSession/`, {method: 'POST', headers: ctHeaders, body: JSON.stringify({
      type: 'password',
      password
    })}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      let token = json.authToken
      AppState.dispatch({type: 'finish-login', token})
    }, err => {
      this.setState({
        requestState: null,
        lastError: err
      })
    })
  }

  handleSetPassword (evt) {
    let {passwordInput: password} = this.state
    this.setState({
      requestState: {
        progressText: 'Setting password'
      },
      lastError: null
    })
    let authHeaders = new Headers()
    authHeaders.append('Authorization', 'Bearer ' + this.state.regNewToken)
    authHeaders.append('Content-Type', 'application/json')
    fetch('/auths/challenges/replace/', {method: 'POST', headers: authHeaders, body: JSON.stringify({
      type: 'password',
      password
    })}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(() => {
      AppState.dispatch({type: 'finish-login', token: this.state.regNewToken})
    }, err => {
      this.setState({
        requestState: null,
        lastError: err
      })
    })
  }

  cancel () {
    AppState.dispatch({type: 'cancel-login'})
  }
}

(function () {
  function fetchLoginInfo () {
    // At this point, AppState.loginInfo is (already) null, since changing token in AppState will cause loginInfo to be null.
    let token = AppState.getState().authToken
    if (!token) {
      window.localStorage.removeItem('authToken', token)
    } else {
      let authHeaders = new Headers({
        'Authorization': 'Bearer ' + token
      })
      fetch('/auth/', {headers: authHeaders}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(res => {
        if (AppState.getState().authToken === token) {
          AppState.dispatch({type: 'login-info', info: res})
        }
        window.localStorage.setItem('authToken', token)
      }, err => {})
    }
  }

  let lastAuthToken = AppState.getState() ? AppState.getState().authToken : null
  if (lastAuthToken) {
    fetchLoginInfo()
  }
  AppState.subscribe(() => {
    let newAuthToken = AppState.getState().authToken
    if (newAuthToken !== lastAuthToken || (!AppState.getState().loginInfo && newAuthToken)) {
      fetchLoginInfo()
      lastAuthToken = newAuthToken
    }
  })
})()

export default LoginView
