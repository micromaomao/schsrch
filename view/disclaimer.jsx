/* eslint-disable lines-between-class-members, object-curly-spacing, operator-linebreak, indent, react/jsx-no-target-blank, react/jsx-closing-tag-location */
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
    return (
      <div className='disclaimer-page modern-page-container'>
        <button className='escape-home-btn' onClick={() => AppState.dispatch({type: 'home'})} title='Return Home'>
          <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' /></svg>
        </button>

        <div className='modern-hero'>
          <div className='breadcrumb'>
            <span onClick={() => AppState.dispatch({type: 'home'})}>Home</span>
            <span className='separator'>/</span>
            <span className='current'>Disclaimer</span>
          </div>
          <h1>Disclaimer</h1>
          <p className='hero-description'>Important information about SchSrch, copyright, licensing and educational use.</p>
        </div>

        <div className='modern-card summary-card'>
          <h2>Summary</h2>
          <ul className='checklist'>
            <li><svg className='icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='20 6 9 17 4 12' /></svg> Free and open source</li>
            <li><svg className='icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='20 6 9 17 4 12' /></svg> Educational use only</li>
            <li><svg className='icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='20 6 9 17 4 12' /></svg> No affiliation with Cambridge</li>
            <li><svg className='icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='20 6 9 17 4 12' /></svg> Papers remain property of Cambridge International</li>
          </ul>
        </div>

        <div className='cards-grid'>
          <div className='modern-card'>
            <div className='card-header'>
              <span className='card-icon'>⚖️</span>
              <h3>Licensing</h3>
            </div>
            <p>
              This program itself is free software. It comes without any warranty, to the extent permitted by applicable law. You can redistribute it and/or modify it under the terms of the MIT License.
            </p>
          </div>

          <div className='modern-card'>
            <div className='card-header'>
              <span className='card-icon'>©️</span>
              <h3>Copyright</h3>
            </div>
            <p>
              The past papers hosted here are copyrighted by {this.state.server ?
                (<a href='http://www.cambridgeassessment.org.uk/' target='_blank'>UCLES</a>) :
                (<a onClick={evt => window.open('http://www.cambridgeassessment.org.uk/')}>UCLES</a>)}.
              PDF files are gathered from the Web.
            </p>
          </div>

          <div className='modern-card'>
            <div className='card-header'>
              <span className='card-icon'>🎓</span>
              <h3>Educational Use</h3>
            </div>
            <p>All papers are provided solely for revision and educational purposes.</p>
          </div>

          <div className='modern-card'>
            <div className='card-header'>
              <span className='card-icon'>⚠️</span>
              <h3>Disclaimer</h3>
            </div>
            <p>This website and its content are provided AS-IS, with no guarantee of completeness or correctness, and the project is entirely non-profit.</p>
          </div>
        </div>
      </div>
    )
  }
}
