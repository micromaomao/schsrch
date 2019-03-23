'use strict'

import { AppState } from './appstate.js'
import SchSrch from './schsrch.jsx'
import * as React from 'react'
const { renderToString } = require('react-dom/server')
const style = require('./layout.sass')

export default function serverRender (state) {
  AppState.dispatch({type: 'init-server', serverrender: state})
  return renderToString(<SchSrch />)
}
global.serverRender = serverRender
