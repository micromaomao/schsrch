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

function initFromHash () {
  try {
    let hashMatch = window.location.hash.match(/^#(.+)$/)
    if (!hashMatch) throw new Error()
    let stateData = hashMatch[1]
    let state = JSON.parse(stateData)
    if (typeof state !== 'object') {
      throw new Error()
    }
    AppState.dispatch({type: 'load', state: state})
  } catch (e) {
    AppState.dispatch({type: 'init'})
  }
}
initFromHash()

AppState.subscribe(() => {
  let nState = AppState.getState()
  let nsd = JSON.stringify(nState)
  if (location.hash.substr(1) === nsd) return
  window.location.replace('#' + nsd)
})

window.addEventListener("hashchange", evt => {
  setTimeout(initFromHash, 1)
})

module.exports = AppState
