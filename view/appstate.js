const InterfaceVersion = 9
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
  collection: null,
  view: 'home',
  previewPages: {},
  version: InterfaceVersion,
  queryFocusing: false
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
        querying: action.serverrender.querying || null,
        collection: action.serverrender.collection || null
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
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          query: action.query,
          loading: true
        })
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
      if (!(state.querying && state.querying.query.trim() === action.query.trim())) return state
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: false,
          error: action.error,
          result: null
        })
      })
    case 'queryResult':
      if (!(state.querying && state.querying.query.trim() === action.query.trim())) return state
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
          psKey: action.psKey || (state.previewing ? state.previewing.psKey : null),
          highlightingQ: action.highlightingQ
        },
        previewPages: setPreviewPages(state.previewPages, action.fileId, action.page)
      })
    case 'previewChangePage':
      return Object.assign({}, state, {
        previewing: Object.assign({}, state.previewing, {
          page: action.page,
          highlightingQ: Number.isSafeInteger(action.highlightingQ) ? action.highlightingQ : state.previewing.highlightingQ
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
    case 'queryFocus':
      return Object.assign({}, state, {
        queryFocusing: true
      })
    case 'queryUnfocus':
      return Object.assign({}, state, {
        queryFocusing: false
      })
    case 'view-collections':
      if (state.view === 'collections' && state.collection.id === action.collectionId) return state
      return Object.assign({}, state, {
        view: 'collections',
        collection: {
          id: action.collectionId,
          loading: true,
          loadingError: null,
          content: null,
          lastSave: null,
          rand: Math.random()
        }
      })
    case 'collection-edit-content':
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          content: action.content,
          rand: Math.random()
        })
      })
    case 'collection-load-error':
      if (!state.collection) return
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          error: action.error,
          loading: false,
          lastSave: null,
          rand: Math.random()
        })
      })
    case 'collection-load-data':
      if (!state.collection) return
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          error: null,
          content: action.content,
          loading: false,
          lastSave: null,
          rand: Math.random()
        })
      })
    case 'collection-reload':
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          error: null,
          loading: true,
          lastSave: null,
          rand: Math.random()
        })
      })
    case 'collection-put-done':
      if (!state.collection) return
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          lastSave: {
            time: new Date(),
            error: null,
            done: true,
            rand: action.rand
          }
        })
      })
    case 'collection-put-error':
      if (!state.collection) return
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          lastSave: {
            time: new Date(),
            error: action.error,
            done: true
          }
        })
      })
    case 'collection-put-start':
      if (!state.collection) return
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          lastSave: {
            time: new Date(),
            error: null,
            done: false,
            rand: action.rand
          }
        })
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

AppState.shouldResponseKeyboardShortcut = () => !AppState.getState().queryFocusing // TODO: Ugly but quick hack, FIXME!

module.exports = AppState
