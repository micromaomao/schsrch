const React = require('react')
const AppState = require('./appstate.js')

class Disclaimer extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  render () {
    let back = (
      <div className='back' onClick={evt => AppState.dispatch({type: 'home'})}>Back</div>
    )
    if (this.state.server) {
      back = (
        <a className='back' href='/'>Back</a>
      )
    }
    return (
      <div className='disclaimer'>
        {back}
        <h1>Disclaimer</h1>
        <div className='tldr'>tl; dr</div>
        <ul>
          <li>This program itself, which is a part of maowtm.org, is free software. It comes without any warranty, to the extent permitted by applicable law. You can redistribute it and/or modify it under the terms of the MIT License.</li>
          <li>The past papers hosted here is copyrighted by UCLES. PDF files is gathered from the Web.</li>
          <li>For educational purpose, I can't account for copyright issues on Cambridge papers. Many websites are doing this anyway.</li>
          <li>This website is provided AS-IS, with no guarantee of correctness. This website is entirely non-profit. No advertisements shall appear.</li>
        </ul>
      </div>
    )
  }
}

module.exports = Disclaimer
