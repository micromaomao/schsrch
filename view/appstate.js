const InterfaceVersion = 18
const { createStore } = require('redux')

const init = {
  querying: null,
  feedback: {
    show: false,
    search: null,
    feedbackText: '',
    email: ''
  },
  showSidebar: false,
  previewing: null,
  serverrender: null,
  collection: null,
  view: 'home',
  previewPages: {},
  version: InterfaceVersion,
  queryFocusing: false,
  authToken: null,
  loginView: null,
  paperCropClipboard: null,
  loginInfo: null
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
      return Object.assign({}, init, action.state, {
        queryFocusing: false,
        loginInfo: null
      })
    case 'query':
      if (action.query.trim().length === 0) {
        return Object.assign({}, state, {
          querying: null
        })
      }
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          query: action.query,
          loading: false,
          result: null,
          error: null
        }),
        showSidebar: false
      })
    case 'query-perpare':
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          query: action.query,
          loading: true
        }),
        showSidebar: false
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
        }),
        showSidebar: false
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
        view: 'disclaim',
        showSidebar: false
      })
    case 'home':
      return Object.assign({}, state, {
        view: 'home',
        collection: Object.assign({}, state.collection || {}, {
          homeFromCollection: false
        }),
        feedback: Object.assign({}, state.feedback || {}, {
          show: false
        }),
        showSidebar: false
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
      if (state.view === 'collections' && state.collection.id === action.collectionId) {
        return Object.assign({}, state, {
          collection: Object.assign({}, state.collection, {
            homeFromCollection: false
          })
        })
      }
      return Object.assign({}, state, {
        view: 'collections',
        collection: {
          id: action.collectionId,
          loading: true,
          loadingError: null,
          content: null,
          contentUndoStack: null,
          contentRedoStack: null,
          lastSave: null,
          homeFromCollection: false
        },
        showSidebar: false
      })
    case 'collection-edit-content':
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          content: action.content,
          homeFromCollection: false,
          contentRedoStack: []
        })
      })
    case 'collection-load-error':
      if (!state.collection) return state
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          error: action.error,
          loading: false,
          lastSave: null
        })
      })
    case 'collection-load-data':
      if (!state.collection) return state
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          error: null,
          content: action.content,
          loading: false,
          lastSave: null
        })
      })
    case 'collection-reload':
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          error: null,
          loading: true,
          lastSave: null
        })
      })
    case 'collection-put-done':
      if (!state.collection) return state
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          lastSave: {
            time: Date.now(),
            error: null,
            done: true,
            contentSaved: action.content
          }
        })
      })
    case 'collection-put-error':
      if (!state.collection) return state
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          lastSave: {
            time: Date.now(),
            error: action.error,
            done: true,
            contentSaved: null
          }
        })
      })
    case 'collection-put-start':
      if (!state.collection) return state
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection, {
          lastSave: {
            time: Date.now(),
            error: null,
            done: false,
            contentSaved: null
          }
        })
      })
    case 'collection-push-undostack':
      return (() => {
        if (!state.collection) return state
        if (!state.collection.content) return state
        let undoStack = (state.collection.contentUndoStack || []).concat([state.collection.content])
        if (undoStack.length >= 2 && undoStack[undoStack.length - 1] === undoStack[undoStack.length - 2]) return state
        if (undoStack.length > 20) {
          undoStack = undoStack.slice(-20)
        }
        return Object.assign({}, state, {
          collection: Object.assign({}, state.collection, {
            contentUndoStack: undoStack,
            contentRedoStack: []
          })
        })
      })()
    case 'collection-undo':
      return (() => {
        if (!state.collection) return state
        if (!state.collection.content) return state
        let undoStack = state.collection.contentUndoStack
        let redoStack = state.collection.contentRedoStack || []
        if (!undoStack || undoStack.length === 0) return state
        undoStack = undoStack.slice()
        let replaceContent = undoStack.pop()
        if (replaceContent === state.collection.content) {
          replaceContent = undoStack.pop()
          if (!replaceContent) return state
        }
        undoStack.push(replaceContent) // The undo stack should always have the last content.
        redoStack = redoStack.concat([state.collection.content])
        return Object.assign({}, state, {
          collection: Object.assign({}, state.collection, {
            content: replaceContent,
            contentUndoStack: undoStack,
            contentRedoStack: redoStack
          })
        })
      })()
    case 'collection-redo':
      return (() => {
        if (!state.collection) return state
        if (!state.collection.content) return state
        let undoStack = state.collection.contentUndoStack || []
        let redoStack = state.collection.contentRedoStack
        if (!redoStack || redoStack.length === 0) return state
        redoStack = redoStack.slice()
        let replaceContent = redoStack.pop()
        undoStack = undoStack.concat([state.collection.content, replaceContent])
        return Object.assign({}, state, {
          collection: Object.assign({}, state.collection, {
            content: replaceContent,
            contentUndoStack: undoStack,
            contentRedoStack: redoStack
          })
        })
      })()
    case 'login-view':
      return Object.assign({}, state, {
        view: 'login',
        loginView: {
          from: state.view
        },
        showSidebar: false
      })
    case 'finish-login':
      return Object.assign({}, state, {
        authToken: action.token,
        loginInfo: null,
        loginView: null,
        view: (state.loginView ? state.loginView.from : state.view)
      })
    case 'cancel-login':
      return Object.assign({}, state, {
        loginView: null,
        view: (state.loginView ? state.loginView.from : state.view)
      })
    case 'clear-token':
      return Object.assign({}, state, {
        authToken: null,
        loginInfo: null
      })
    case 'home-from-collection':
      if (!state.collection) {
        return Object.assign({}, state, {
          view: 'home',
          showSidebar: false
        })
      }
      return Object.assign({}, state, {
        view: 'home',
        collection: Object.assign({}, state.collection, {
          homeFromCollection: true
        }),
        showSidebar: false
      })
    case 'set-paper-crop-clipboard':
      if (!action.doc || !Number.isSafeInteger(action.page)) {
        return Object.assign({}, state, {
          paperCropClipboard: null
        })
      }
      return Object.assign({}, state, {
        paperCropClipboard: {
          doc: action.doc,
          page: action.page,
          docMeta: action.docMeta || null,
          boundary: action.boundary
        }
      })
    case 'clear-home-from-collection':
      return Object.assign({}, state, {
        collection: Object.assign({}, state.collection || {}, {
          homeFromCollection: false
        })
      })
    case 'show-sidebar':
      return Object.assign({}, state, {
        showSidebar: true
      })
    case 'hide-sidebar':
      return Object.assign({}, state, {
        showSidebar: false
      })
    case 'login-info':
      return Object.assign({}, state, {
        loginInfo: action.info
      })
  }
})

AppState.browserSupportsPassiveEvents = (() => {
  // https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md#feature-detection
  let supportsPassive = false
  try {
    let opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassive = true
      }
    });
    window.addEventListener("test", null, opts)
  } catch (e) {}
  return supportsPassive
})()

AppState.shouldResponseKeyboardShortcut = () => !AppState.getState().queryFocusing && !(document.activeElement && document.activeElement.contentEditable === 'true') // TODO: Ugly but quick hack, FIXME!
AppState.sspdfDecacheVersion = 2

module.exports = AppState
