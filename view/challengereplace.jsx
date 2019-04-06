import * as React from 'react'
import { AppState } from './appstate.js'
import * as FetchErrorPromise from './fetcherrorpromise.jsx'
import hexToAb from './hextoab.js'
const base64js = require('base64-js')

export default class ChallengeReplaceView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      newPasswordInput: '',
      changing: false,
      error: null,
      useAuthn_gettingSignChallenge: false
    }
    this.handleNewPasswordInput = this.handleNewPasswordInput.bind(this)
    this.handleApply = this.handleApply.bind(this)
    this.handleUseWebAuthn = this.handleUseWebAuthn.bind(this)
    this.handleGotServerChallenge = this.handleGotServerChallenge.bind(this)
  }

  render () {
    return (
      <div className='contain'>
        <h1>Change Password&hellip;</h1>
        <br />
        {!this.props.authToken && !this.state.changing ?
          (
            <p>
              You need to login before you can change your password.
            </p>
          ) : null}
        {!this.state.changing ?
          (
            <div className='back' onClick={evt => this.close()}>Cancel</div>
          ) : null}
        {this.props.authToken && !this.state.changing ?
          (
            <div className='main'>
              {this.state.error ?
                (
                  <div className='error bmargin'>{this.state.error.message}</div>
                ) : null}
              <input className='passwordInput' type='password' placeholder='New Password' value={this.state.newPasswordInput} onChange={this.handleNewPasswordInput} />
              <div className='btn'>
                <a onClick={this.handleApply}>Apply</a>
              </div>
              <br />
              <div className='btn'>
                {!this.state.useAuthn_gettingSignChallenge ? (
                  <a onClick={this.handleUseWebAuthn}>Use WebAuthn</a>
                ) : "Awaiting server challenge\u2026"}
              </div>
            </div>
          ) : null}
        {this.state.changing ?
          (
            <div className='progress'>
              Just a moment&hellip;
            </div>
          ) : null}
      </div>
    )
  }

  handleNewPasswordInput (evt) {
    let pwd = evt.target.value
    this.setState({
      newPasswordInput: pwd
    })
  }

  handleApply (evt) {
    this.setState({
      changing: true,
      error: null
    })
    let pwd = this.state.newPasswordInput
    if (pwd.length === 0) {
      this.setState({
        changing: false,
        error: new Error("Password can't be empty.")
      })
      return
    }
    let headers = new Headers()
    headers.append('Authorization', 'Bearer ' + this.props.authToken)
    headers.append('Content-Type', 'application/json')
    fetch('/auths/challenges/replace/', {method: 'POST', headers, body: JSON.stringify({
      type: 'password',
      password: pwd
    })}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
      this.close()
    }, err => {
      this.setState({
        changing: false,
        error: err
      })
    })
  }

  handleUseWebAuthn (evt) {
    this.setState({useAuthn_gettingSignChallenge: true})
    fetch('/auths/signingchallenge/', {method: 'GET'}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.text())
    .then(t => Promise.resolve(base64js.toByteArray(t))).then(this.handleGotServerChallenge, err => {
      this.setState({error: err, useAuthn_gettingSignChallenge: false})
    })
  }

  handleGotServerChallenge (chg) {
    this.setState({useAuthn_gettingSignChallenge: false, changing: true})
    let loginInfo = AppState.getState().loginInfo
    window.navigator.credentials.create({
      publicKey: {
        rp: {
          id: window.location.hostname,
          name: window.location.hostname
        },
        user: {
          displayName: loginInfo.username,
          id: hexToAb(loginInfo._id),
          name: loginInfo.username
        },
        challenge: chg,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        timeout: 60 * 4 * 1000,
        attestation: 'none',
      }
    }).then(cred => {
      let payload = {
        type: 'fido2',
        clientDataJson: String.fromCharCode.apply(null, new Uint8Array(cred.response.clientDataJSON)),
        credId: base64js.fromByteArray(new Uint8Array(cred.rawId)),
        attestationObject: base64js.fromByteArray(new Uint8Array(cred.response.attestationObject))
      }
      let headers = new Headers()
      headers.append('Authorization', 'Bearer ' + this.props.authToken)
      headers.append('Content-Type', 'application/json')
      fetch('/auths/challenges/replace/', {method: 'POST', headers, body: JSON.stringify(payload)})
        .then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
          this.close()
        }, err => {
          this.setState({
            changing: false,
            error: err
          })
        })
    }, err => {
      this.setState({changing: false, error: err})
    })
  }

  close () {
    AppState.dispatch({type: 'close-challenge-replace'})
  }
}
