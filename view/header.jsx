import React from 'react'
import { AppState } from './appstate.js'

export default class Header extends React.Component {
  constructor (props) {
    super(props)
    this.state = { theme: AppState.getState().theme || 'light' }
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleToggleTheme = this.handleToggleTheme.bind(this)
  }

  componentDidMount () {
    this.unsub = AppState.subscribe(this.handleUpdate)
  }

  componentWillUnmount () {
    if (this.unsub) this.unsub()
  }

  handleUpdate () {
    const state = AppState.getState()
    if (state.theme !== this.state.theme) {
      this.setState({ theme: state.theme })
    }
  }

  handleToggleTheme () {
    AppState.dispatch({ type: 'toggle-theme' })
  }

  render () {
    return (
      <div
        className='top-header' style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '1rem',
          alignItems: 'center',
          backgroundColor: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className='nav-links' style={{ display: 'flex', gap: '1rem' }}>
          <a style={{ cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'bold' }} onClick={() => AppState.dispatch({ type: 'home' })}>SchSrch</a>
          <a style={{ cursor: 'pointer', color: 'var(--color-link)' }} onClick={() => AppState.dispatch({ type: 'subjects' })}>Subjects</a>
          <a style={{ cursor: 'pointer', color: 'var(--color-link)' }} onClick={() => AppState.dispatch({ type: 'disclaim' })}>Disclaimer</a>
          <a style={{ cursor: 'pointer', color: 'var(--color-link)' }} onClick={() => AppState.dispatch({ type: 'show-help' })}>Help</a>
        </div>
        <div className='theme-toggle'>
          <button
            onClick={this.handleToggleTheme}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-color)',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {this.state.theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>
    )
  }
}
