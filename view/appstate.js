const InterfaceVersion = 4
const { createStore } = require('redux')

const init = {
  querying: null,
  feedback: {
    show: false,
    search: null,
    feedbackText: '',
    email: ''
  },
  previewing: null,
  serverrender: null,
  view: 'home',
  previewPages: {},
  version: InterfaceVersion
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
      return Object.assign({}, init, {
        serverrender: action.serverrender || true,
        view: action.serverrender.view || 'home',
        querying: action.serverrender.querying || null
      })
    case 'load':
      if (action.state.version !== InterfaceVersion) {
        console.log(`Not loading from state data of older version - ${action.state.version || '0'} !== ${InterfaceVersion}`)
        return Object.assign({}, init)
      }
      return Object.assign({}, init, action.state)
    case 'query':
      if (action.query.trim().length === 0) {
        return Object.assign({}, state, {
          querying: null
        })
      }
      if (state.querying && state.querying.query === action.query.trim()) return state // Search query not changed.
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          query: action.query.trim(),
          loading: true
        }),
        previewing: null
      })
    case 'replaceQuerying':
      return Object.assign({}, state, {
        querying: action.querying
      })
    case 'queryStartRequest':
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: true,
          error: null
        })
      })
    case 'queryError':
      if (!(state.querying && state.querying.query === action.query.trim())) return state
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: false,
          error: action.error,
          result: null
        })
      })
    case 'queryResult':
      if (!(state.querying && state.querying.query === action.query.trim())) return state
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: false,
          error: null,
          result: action.result
        })
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
          psKey: action.psKey || state.previewing.psKey,
          highlightingQ: action.highlightingQ
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
