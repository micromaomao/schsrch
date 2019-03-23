import * as React from 'react'
import { AppState } from './appstate.js'

export default class Disclaimer extends React.Component {
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
          <li>This program itself is free software. It comes without any warranty, to the extent permitted by applicable law. You can redistribute it and/or modify it under the terms of the MIT License.</li>
          <li>The past papers hosted here is copyrighted by&nbsp;
            {this.state.server ?
              (
                <a href='http://www.cambridgeassessment.org.uk/' target='_blank'>UCLES</a>
              ) :
              (
                <a onClick={evt => window.open('http://www.cambridgeassessment.org.uk/')}>UCLES</a>
              )}. PDF files is gathered from the Web.</li>
          <li>All papers are provided solely for educational purpose.</li>
          <li>This website and its content is provided AS-IS, with no guarantee of correctness, and is entirely non-profit.</li>
        </ul>
      </div>
    )
  }
}
