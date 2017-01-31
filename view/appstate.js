const { createStore } = require('redux')

const init = {
  query: '',
  feedback: {
    show: false,
    search: null,
    feedbackText: '',
    email: ''
  },
  previewing: null,
  serverrender: null,
  view: 'home',
  previewPages: {}
}

function setPreviewPages (previewPages, doc, page) {
  let newPages = Object.assign({}, previewPages)
  newPages[doc] = page
  return newPages
}

let AppState = createStore(function (state = {}, action) {
  switch (action.type) {
    case 'init':
      return Object.assign({}, init)
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
      return Object.assign({}, init, action.state)
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
        },
        previewPages: setPreviewPages(state.previewPages, action.fileId, action.page)
      })
    case 'previewChangePage':
      return Object.assign({}, state, {
        previewing: Object.assign({}, state.previewing, {
          page: action.page
        }),
        previewPages: setPreviewPages(state.previewPages, state.previewing.id, action.page)
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

AppState.browserSupportsPassiveEvents = (() => {
  // https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md#feature-detection
  let supportsPassive = false;
  try {
    let opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassive = true;
      }
    });
    window.addEventListener("test", null, opts);
  } catch (e) {}
  return supportsPassive
})()

module.exports = AppState
