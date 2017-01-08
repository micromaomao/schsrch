'use strict'

require('babel-polyfill')
require('fetch-polyfill')

require('offline-plugin/runtime').install()

const AppState = require('./appstate.js')
const React = require('react')
const ReactDOM = require('react-dom')
const SchSrch = require('./schsrch.jsx')

window.requestIdleCallback = window.requestIdleCallback || (func => setTimeout(func, 1000))
window.cancelIdleCallback = window.cancelIdleCallback || (id => clearTimeout(id))

let setHashTimeout = null
let hashIdle = null

if (history.state) {
  AppState.dispatch({type: 'load', state: history.state})
} else {
  AppState.dispatch({type: 'init'})
}

AppState.subscribe(() => {
  if (hashIdle) {
    cancelIdleCallback(hashIdle)
    hashIdle = null
  }
  requestIdleCallback(() => {
    let nState = AppState.getState()
    history.replaceState(nState, 'SchSrch', '/')
  })
})

window.addEventListener('popstate', evt => {
  let state = evt.state
  AppState.dispatch({type: 'load', state})
})

let ui = ReactDOM.render(
  <SchSrch />,
  document.getElementsByClassName('react-root')[0]
)

window.addEventListener('resize', evt => {
  setTimeout(() => ui.forceUpdate(), 1)
})
