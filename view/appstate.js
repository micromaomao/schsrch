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
        }
      }
    case 'load':
      return action.state
    case 'query':
      return Object.assign({}, state, {
        query: action.query
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
  }
})

if (window.sessionStorage) {
  let storedState = window.sessionStorage.getItem('state')
  try {
    if (!storedState) {
      throw new Error()
    }
    let state = JSON.parse(storedState)
    if (typeof state !== 'object') {
      throw new Error()
    }
    AppState.dispatch({type: 'load', state: state})
  } catch (e) {
    AppState.dispatch({type: 'init'})
  }
  AppState.subscribe(() => {
    let nState = AppState.getState()
    window.sessionStorage.setItem('state', JSON.stringify(nState))
  })
} else {
  AppState.dispatch({type: 'init'})
}

module.exports = AppState
