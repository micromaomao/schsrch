'use strict'

const AppState = require('./appstate.js')
const SchSrch = require('./schsrch.jsx')
const React = require('react')
const { renderToString } = require('react-dom/server')
const style = require('./layout.sass')

global.serverRender = module.exports = state => {
  AppState.dispatch({type: 'init-server', serverrender: state})
  return renderToString(<SchSrch />)
}
