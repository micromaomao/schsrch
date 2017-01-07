const { createStore } = require('redux')

let AppState = createStore(function (state = {}, action) {
  switch (action.type) {
    case 'init':
      return {
        query: '',
        feedback: {
          show: false,
          search: null,
          feedbackText: '',
          email: ''
        },
        previewing: null
      }
    case 'load':
      return action.state
    case 'query':
      return Object.assign({}, state, {
        query: action.query,
        previewing: state.query.trim() === action.query.trim() ? state.previewing : null
      })
    case 'showFeedback':
      return Object.assign({}, state, {
        feedback: Object.assign({}, state.feedback, {
          show: true,
          search: action.search
        })
      })
    case 'hideFeedback':
      return Object.assign({}, state, {
        feedback: Object.assign({}, state.feedback, {
          show: false,
          search: null
        })
      })
    case 'writeFeedbackText':
      return Object.assign({}, state, {
        feedback: Object.assign({}, state.feedback, {
          feedbackText: action.feedbackText,
          show: true
        })
      })
    case 'writeEmail':
      return Object.assign({}, state, {
        feedback: Object.assign({}, state.feedback, {
          email: action.email,
          show: true
        })
      })
    case 'previewFile':
      return Object.assign({}, state, {
        previewing: {
          id: action.fileId,
          page: action.page,
          psKey: action.psKey
        }
      })
    case 'previewChangePage':
      return Object.assign({}, state, {
        previewing: Object.assign({}, state.previewing, {
          page: action.page
        })
      })
    case 'closePreview':
      return Object.assign({}, state, {
        previewing: null
      })
  }
})

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

window.AppState = module.exports = AppState
