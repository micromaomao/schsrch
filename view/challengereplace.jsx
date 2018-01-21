const React = require('react')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.jsx')

class ChallengeReplaceView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      newPasswordInput: '',
      changing: false,
      error: null
    }
    this.handleNewPasswordInput = this.handleNewPasswordInput.bind(this)
    this.handleApply = this.handleApply.bind(this)
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

  close () {
    AppState.dispatch({type: 'close-challenge-replace'})
  }
}

module.exports = ChallengeReplaceView
