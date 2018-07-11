const InterfaceVersion = 23
const { createStore } = require('redux')
const bowser = require('bowser')

const init = require('./appstateinit.js')
init.version = InterfaceVersion

function setPreviewPages (previewPages, doc, page) {
  let newPages = Object.assign({}, previewPages)
  newPages[doc] = page
  return newPages
}

let AppState = createStore(function (state = {}, action) {
  // console.log(action, state)
  switch (action.type) {
    case 'init':
      return Object.assign({}, init)
    case 'init-server':
      AppState.supportOverall = AppState.supportSspdfView = AppState.browserSupportsPassiveEvents = true
      return Object.assign({}, init, action.serverrender, {
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
        loginInfo: null
      })
    case 'query':
      if (action.query.trim().length === 0) {
        return Object.assign({}, state, {
          querying: null
        })
      }
      if (state.querying && state.querying.query.trim() === action.query.trim()) {
        return Object.assign({}, state, {
          querying: Object.assign({}, state.querying || {}, {
            query: action.query,
          }),
          showSidebar: false
        })
      }
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          query: action.query,
          loading: true,
          error: null
        }),
        showSidebar: false
      })
    case 'retry-query':
      if (!state.querying) return state
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: true,
          error: null,
          result: null
        })
      })
    case 'replaceQuerying':
      return Object.assign({}, state, {
        querying: action.querying
      })
    case 'query-error':
      if (!(state.querying && state.querying.query.trim() === action.query.trim())) return state
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: false,
          error: action.error,
          result: null
        })
      })
    case 'query-load':
      if (!(state.querying && state.querying.query.trim() === action.query.trim())) return state
      return Object.assign({}, state, {
        querying: Object.assign({}, state.querying || {}, {
          loading: false,
          error: null,
          result: action.result
        })
      })
    case 'show-help':
      return Object.assign({}, state, {
        showHelp: true
      })
    case 'hide-help':
      return Object.assign({}, state, {
        showHelp: false
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
      if (!AppState.supportSspdfView) {
        window.open('/doc/' + encodeURIComponent(action.fileId))
        return state
      }
      return Object.assign({}, state, {
        previewing: {
          id: action.fileId,
          page: action.page,
          psKey: action.psKey || (state.previewing ? state.previewing.psKey : null),
          highlightingDirIndex: action.highlightingDirIndex,
          jumpToHighlight: action.jumpToHighlight || false
        },
        v2viewing: null,
        previewPages: setPreviewPages(state.previewPages, action.fileId, action.page)
      })
    case 'doJumpToHighlight':
      if (!state.previewing) return state
      return Object.assign({}, state, {
        previewing: Object.assign({}, state.previewing, {
          page: action.page,
          jumpToHighlight: false
        }),
        previewPages: setPreviewPages(state.previewPages, state.previewing.id, action.page)
      })
    case 'previewChangePage':
      return Object.assign({}, state, {
        previewing: Object.assign({}, state.previewing, {
          page: action.page,
          highlightingDirIndex: action.highlightingDirIndex !== null && typeof action.highlightingDirIndex !== 'undefined' ? action.highlightingDirIndex : state.previewing.highlightingDirIndex,
          jumpToHighlight: false
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
    case 'view-collection':
      if (state.view === 'collection' && state.collection.id === action.collectionId) {
        return Object.assign({}, state, {
          collection: Object.assign({}, state.collection, {
            homeFromCollection: false
          })
        })
      }
      return Object.assign({}, state, {
        view: 'collection',
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
      if (state.view === 'login') return state
      return Object.assign({}, state, {
        view: 'login',
        loginView: {
          from: state.view
        },
        showSidebar: false
      })
    case 'set-token':
      return Object.assign({}, state, {
        authToken: action.token,
        loginInfo: null
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
    case 'view-challenge-replace':
      if (!state.authToken || state.view === 'challenge-replace') return state
      return Object.assign({}, state, {
        showSidebar: false,
        view: 'challenge-replace',
        challengeReplace: {
          from: state.view
        }
      })
    case 'close-challenge-replace':
      return Object.assign({}, state, {
        view: (state.challengeReplace ? state.challengeReplace.from : state.view),
        challengeReplace: null
      })
    case 'subjects':
      return Object.assign({}, state, {
        view: 'subjects',
        subjectStatistics: null
      })
    case 'subjects-stst-perpare':
      return Object.assign({}, state, {
        subjectStatistics: Object.assign({}, state.subjectStatistics || {}, {
          loading: true,
          error: null
        })
      })
    case 'subjects-stst-load':
      return Object.assign({}, state, {
        subjectStatistics: Object.assign({}, state.subjectStatistics || {}, {
          loading: false,
          error: null,
          result: action.data
        })
      })
    case 'subjects-stst-load-and-show':
      return Object.assign({}, state, {
        view: 'subjects',
        subjectStatistics: {
          loading: false,
          error: null,
          result: action.data
        }
      })
    case 'subjects-stst-error':
      return Object.assign({}, state, {
        subjectStatistics: Object.assign({}, state.subjectStatistics || {}, {
          loading: false,
          error: action.error
        })
      })
    case 'v2view':
      if (!AppState.supportSspdfView) {
        window.open('/doc/' + encodeURIComponent(action.fileId))
        return state
      }
      return Object.assign({}, state, {
        previewing: null,
        v2viewing: {
          fileId: action.fileId,
          tCurrentType: action.tCurrentType ? action.tCurrentType : (state.v2viewing ? state.v2viewing.tCurrentType : null),
          stageTransforms: {},
          viewDir: action.viewDir || null,
          searchIndex: action.searchIndex || null,
          showPaperSetTitle: action.showPaperSetTitle || null
        }
      })
    case 'v2view-set-tCurrentType':
      return (() => {
        if (!state.v2viewing) return state
        let stageTransformAssign = {}
        if (action.stageTransform || action.stageTransform === null) {
          stageTransformAssign[action.tCurrentType] = action.stageTransform
        }
        return Object.assign({}, state, {
          v2viewing: Object.assign({}, state.v2viewing, {
            tCurrentType: action.tCurrentType,
            stageTransforms: Object.assign({}, state.v2viewing.stageTransforms, stageTransformAssign),
            viewDir: action.viewDir || null
          })
        })
      })()
    case 'v2view-user-move-page':
      return (() => {
        if (!state.v2viewing) return state
        let stageTransformAssign = {}
        stageTransformAssign[state.v2viewing.tCurrentType] = action.stageTransform
        return Object.assign({}, state, {
          v2viewing: Object.assign({}, state.v2viewing, {
            stageTransforms: Object.assign({}, state.v2viewing.stageTransforms, stageTransformAssign),
            viewDir: null
          })
        })
      })()
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

AppState.focusingInput = null

AppState.shouldResponseKeyboardShortcut = () => {
  let { focusingInput } = AppState
  return !focusingInput && !(document.activeElement && document.activeElement.contentEditable === 'true')
}
AppState.sspdfDecacheVersion = 2
AppState.supportSspdfView = bowser.check({
  msie: '11',
  chrome: '35',
  firefox: '50',
  safari: '9'
})
AppState.supportOverall = bowser.check({
  msie: '11',
  chrome: '29',
  firefox: '23',
  safari: '9'
})

module.exports = AppState
