const InterfaceVersion = 23
import { createStore } from 'redux'
import * as bowser from 'bowser'

import init from './appstateinit.js'
init.version = InterfaceVersion

export function setPreviewPages (previewPages, doc, page) {
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
        showSidebar: false,
        v2viewing: false
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
    case 'query-clear':
      return Object.assign({}, state, {
        querying: null,
        previewing: null,
        v2viewing: null
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
    case 'show-sidebar':
      return Object.assign({}, state, {
        showSidebar: true
      })
    case 'hide-sidebar':
      return Object.assign({}, state, {
        showSidebar: false
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
          showPaperSetTitle: action.showPaperSetTitle || null,
          asPopup: action.asPopup || false,
          popupClosing: false
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
    case 'v2view-close':
      return Object.assign({}, state, {
        v2viewing: null
      })
    case 'v2view-popup-close':
      if (!state.v2viewing) return state
      return Object.assign({}, state, {
        v2viewing: Object.assign({}, state.v2viewing, {
          popupClosing: true
        })
      })
    case 'v2view-to-inline':
      if (!state.v2viewing) return state
      return Object.assign({}, state, {
        v2viewing: Object.assign({}, state.v2viewing, {
          asPopup: false
        })
      })
  }
})

export { AppState }

let browserSupportsPassiveEvents = (() => {
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

AppState.browserSupportsPassiveEvents = browserSupportsPassiveEvents

export { browserSupportsPassiveEvents }

AppState.focusingInput = null

AppState.shouldResponseKeyboardShortcut = () => {
  let { focusingInput } = AppState
  return !focusingInput && !(document.activeElement && document.activeElement.contentEditable === 'true')
}
AppState.sspdfDecacheVersion = 2
AppState.isSafari = bowser.safari || bowser.ios
if (AppState.isSafari) {
  AppState.supportSspdfView = bowser.check({
    safari: '9'
  })
  AppState.supportOverall = bowser.check({
    safari: '9'
  })
} else {
  AppState.supportSspdfView = bowser.check({
    msie: '11',
    chrome: '35',
    firefox: '50'
  })
  AppState.supportOverall = bowser.check({
    msie: '11',
    chrome: '29',
    firefox: '23'
  })
}
