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
        previewing: null,
        serverrender: null,
        view: 'home'
      }
    case 'init-server':
      return {
        query: '',
        feedback: {
          show: false,
          search: null,
          feedbackText: '',
          email: ''
        },
        previewing: null,
        serverrender: action.serverrender || true,
        view: action.serverrender.view || 'home'
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
    case 'disclaim':
      return Object.assign({}, state, {
        view: 'disclaim'
      })
    case 'home':
      return Object.assign({}, state, {
        feedback: Object.assign({}, state.feedback, {
          show: false
        }),
        view: 'home'
      })
  }
})

module.exports = AppState
