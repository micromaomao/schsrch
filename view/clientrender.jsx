'use strict'

require('babel-polyfill')
require('fetch-polyfill')
require('offline-plugin/runtime').install()
require('fullscreen-api-polyfill')

if (/^https:\/\/beta\.schsrch\.xyz\//.test(window.location.href)) {
  navigator.serviceWorker.getRegistration('/').then(reg => reg.unregister(), err => Promise.resolve()).then(() => {
    window.location.replace('https://schsrch.xyz')
  })
}

// Node.remove polyfill for collections.
// from:https://github.com/jserz/js_piece/blob/master/DOM/ChildNode/remove()/remove().md
;(function (arr) {
  arr.forEach(function (item) {
    if (item.hasOwnProperty('remove')) {
      return
    }
    Object.defineProperty(item, 'remove', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: function remove() {
        this.parentNode.removeChild(this)
      }
    })
  })
})([Element.prototype, CharacterData.prototype, DocumentType.prototype])

// AppState is like a global variable, where UI components can listen to change of state and response.
// States include things like current query, current previewing documents, etc.
// This also make sure that the App won't "reset" once user switch to other Apps and switch back.
const AppState = require('./appstate.js')

const React = require('react')
const ReactDOM = require('react-dom')
const SchSrch = require('./schsrch.jsx')

// Polyfill
window.requestIdleCallback = window.requestIdleCallback || (func => setTimeout(func, 1000))
window.cancelIdleCallback = window.cancelIdleCallback || (id => clearTimeout(id))

function readFromLocalStorage () {
  try {
    let stateData = window.localStorage.getItem('state')
    let parse = JSON.parse(stateData)
    if (typeof parse === 'object') {
      return parse
    } else {
      return false
    }
  } catch (e) {
    return false
  }
}

if (history.state) {
  console.log(history.state)
  AppState.dispatch({type: 'load', state: history.state})
} else {
  AppState.dispatch({type: 'init'})
  let queryMatch
  let loc = location.pathname
  if ((queryMatch = loc.match(/^\/search\/\?/))) {
    try {
      let o = JSON.parse(document.getElementsByClassName('react-root')[0].dataset.querying)
      if (typeof o !== 'object') throw new Error()
      AppState.dispatch({type: 'replaceQuerying', querying: o})
    } catch (e) {
      AppState.dispatch({type: 'query', query: ''})
    }
  } else if (loc === '/disclaim/') {
    AppState.dispatch({type: 'disclaim'})
  } else if ((queryMatch = loc.match(/^\/collection\/([0-9a-f]+)\/view\/$/))) {
    AppState.dispatch({type: 'view-collection', collectionId: queryMatch[1]})
  } else {
    let nsState = readFromLocalStorage()
    nsState && AppState.dispatch({type: 'load', state: nsState})
  }
}

let localStorageAuthToken = window.localStorage.getItem('authToken')
if (localStorageAuthToken && !AppState.getState().authToken) {
  AppState.dispatch({type: 'set-token', token: localStorageAuthToken})
}

// Make it F12 useable
window.AppState = AppState

AppState.subscribe(() => {
  requestIdleCallback(() => {
    let nState = AppState.getState()
    let url = '/'
    let stateView = nState.view
    if (stateView === 'login') {
      stateView = nState.loginView.from
    } else if (stateView === 'challenge-replace') {
      stateView = nState.challengeReplace.from
    }
    if (stateView !== 'home') {
      switch (stateView) {
        case 'collection':
        url = `/collection/${nState.collection.id}/view/`
        break
        default:
        url = '/' + encodeURIComponent(stateView) + '/'
        break
      }
    } else if (nState.querying && nState.querying.query.length > 0) {
      url = '/search/?as=page&query=' + encodeURIComponent(nState.querying.query)
    }
    history.replaceState(nState, 'SchSrch', url)
    window.localStorage.setItem('state', JSON.stringify(nState))
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
