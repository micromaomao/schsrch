const React = require('react')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const { Editor } = require('./collectioneditor.jsx')

class CollectionView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      noEditAccess: false
    }
    this.setIntervaled = null
    this.handleInputChange = this.handleInputChange.bind(this)
    this.handleTitleChange = this.handleTitleChange.bind(this)
    this.handleGlobaleKey = this.handleGlobaleKey.bind(this)
    this.pushUndoStackTimeout = null
  }
  handleInputChange (content) {
    AppState.dispatch({type: 'collection-edit-content', content: Object.assign({}, this.props.collection.content, {
      structure: content
    })})
    this.perparePushUndoStack()
  }
  perparePushUndoStack () {
    if (this.pushUndoStackTimeout !== null) {
      clearTimeout(this.pushUndoStackTimeout)
    }
    this.pushUndoStackTimeout = setTimeout(() => {
      AppState.dispatch({type: 'collection-push-undostack'})
      this.pushUndoStackTimeout = null
    }, 500)
  }
  handleTitleChange (evt) {
    AppState.dispatch({type: 'collection-edit-content', content: Object.assign({}, this.props.collection.content, {
      name: evt.target.value
    })})
    this.perparePushUndoStack()
  }
  render () {
    let col = this.props.collection
    if (col === null) return null
    if (AppState.getState().serverrender) {
      return (
        <noscript>
          Collections can only be shown if you enable JavaScript.
          <div className='small'>Sorry about that.</div>
        </noscript>
      )
    }
    let lastSaveError = col.lastSave && col.lastSave.done && col.lastSave.error
    let editDisabled = !AppState.getState().authToken || this.state.noEditAccess

    let haveUndo = col.contentUndoStack && col.contentUndoStack.length > 0
    let haveRedo = col.contentRedoStack && col.contentRedoStack.length > 0
    return (
      <div className='doc'>
        <div className='top'>
          <div className='close'>
            <svg className="icon ii-c"><use href="#ii-c" xlinkHref="#ii-c" /></svg>
          </div>
          {!editDisabled
            ? (
                <div className={'undo' + (!haveUndo ? ' disabled' : '')} title='Undo' onClick={evt => this.undo()}>
                  <svg className="icon ii-undo"><use href="#ii-undo" xlinkHref="#ii-undo" /></svg>
                </div>
              ) : null}
          {!editDisabled
            ? (
                <div className={'redo' + (!haveRedo ? ' disabled' : '')} title='Redo' onClick={evt => this.redo()}>
                  <svg className="icon ii-redo"><use href="#ii-redo" xlinkHref="#ii-redo" /></svg>
                </div>
              ) : null}
          <h1>
            {col.loading || col.error ? 'Collection\u2026'
              : (col.content ? (typeof col.content.name === 'string' ? (
                <input type='text' value={col.content.name} onInput={this.handleTitleChange} placeholder='(empty title)' disabled={editDisabled} />
              ) : (
                <input type='text' value='' placeholder='Untitled' className='untitled' onInput={this.handleTitleChange} disabled={editDisabled} />
              )) : null)}
          </h1>
          <div className='menu'>&hellip;</div>
        </div>
        <div className='editorcontain'>
          {col.loading
            ? (
                <div className='loading'>Loading&hellip;</div>
              )
            : null}
          {col.error
            ? (
                <div className='error'>
                  {col.error}
                  <div className='retry' onClick={evt => AppState.dispatch({type: 'collection-reload'})}>Retry</div>
                </div>
              )
            : null}
          {!AppState.getState().authToken
            ? (
                <div className='nologin'>
                  <div className='big'>You aren't logged in.</div>
                  <div>Please <a onClick={evt => AppState.dispatch({type: 'login-view'})}>log in</a> in order to edit or fork this collection.</div>
                </div>
              )
            : null}
          {col.content !== null && !col.loading
            ? (
                <Editor structure={col.content.structure || []} onChange={this.handleInputChange} disabled={editDisabled} />
              )
            : null}
        </div>
        <div className={'bottom' + ((lastSaveError || this.state.noEditAccess) ? ' error' : '')}>
          {col.loading ? 'Fetching content from server\u2026' : null}
          {!this.state.noEditAccess && col.lastSave && col.lastSave.done && !col.lastSave.error ? `Last saved: ${Math.round((Date.now() - (col.lastSave.time)) / 1000)}s ago.` : null}
          {!this.state.noEditAccess && lastSaveError ? `Error saving collection: ${col.lastSave.error}. Your edit isn't uploaded yet.` : null}
          {this.state.noEditAccess ? `You can't edit this collection.` : null}
          {col.lastSave && !col.lastSave.done ? 'Saving\u2026' : null}
        </div>
      </div>
    )
  }

  componentDidUpdate (prevProps, prevState) {
    let col = this.props.collection
    if (col && col.loading // New collection not yet loaded
      && (!prevProps.collection || !(prevProps.collection.loading && prevProps.collection.id === col.id))) {
      this.startLoad()
    } else if (col && !col.loading && col.content) {
      this.tryUpload()
    }
    if (col.lastSave && col.lastSave.done && !col.lastSave.error) {
      if (!this.setIntervaled) {
        this.setIntervaled = setInterval(() => {
          this.forceUpdate()
        }, 500)
      }
    } else if (this.setIntervaled) {
      clearInterval(this.setIntervaled)
      this.setIntervaled = null
    }
    if (col.content && (!prevProps.collection || !prevProps.collection.content)) {
      AppState.dispatch({type: 'collection-push-undostack'})
    }
  }

  startLoad () {
    let col = this.props.collection
    if (!col || !col.loading) return
    let authHeaders = new Headers()
    if (AppState.getState().authToken)
      authHeaders.append('Authorization', 'Bearer ' + AppState.getState().authToken)
    fetch(`/collection/${col.id}/content/`, {headers: authHeaders}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
      if (this.props.collection.id !== col.id) return
      if (result.error) {
        AppState.dispatch({type: 'collection-load-error', error: result.error})
      } else {
        AppState.dispatch({type: 'collection-load-data', content: result})
      }
    }, err => {
      if (this.props.collection.id !== col.id) return
      AppState.dispatch({type: 'collection-load-error', error: err.message})
    })
  }

  uploadContentNow (force) {
    let col = this.props.collection
    if (!col || !col.content) return
    if (col.lastSave) {
      if (col.lastSave.contentSaved && col.lastSave.contentSaved === col.content && !force) return
    }
    AppState.dispatch({type: 'collection-put-start'})
    let headers = new Headers()
    headers.append('Content-Type', 'application/json')
    if (AppState.getState().authToken)
      headers.append('Authorization', 'Bearer ' + AppState.getState().authToken)
    let content = col.content
    fetch(`/collection/${col.id}/content/`, {method: 'PUT', body: JSON.stringify(content), headers: headers})
      .then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
        AppState.dispatch({type: 'collection-put-done', content: content})
      }, err => {
        if (err.message.toString().match(/401/)) {
          this.setState({noEditAccess: true})
          AppState.dispatch({type: 'collection-reload'})
        }
        AppState.dispatch({type: 'collection-put-error', error: err.message})
      })
  }

  tryUpload () {
    let col = this.props.collection
    if (!col || col.loading || !col.content || this.state.noEditAccess) return
    if (!col.lastSave || (col.lastSave.done && col.lastSave.time <= Date.now() - 1000)) {
      this.uploadContentNow()
    } else {
      // last saved within 1s, don't try too often.
      if (!this.last1sTimeout) {
        this.last1sTimeout = setTimeout(() => {
          this.last1sTimeout = null
          this.tryUpload()
        }, 1000)
      }
      let lastSaveObject = col.lastSave
      if (!this.last5sTimeout) {
        this.last5sTimeout = setTimeout(() => {
          this.last5sTimeout = null
          if (this.props.collection.lastSave && this.props.collection.lastSave === lastSaveObject && !this.props.collection.lastSave.done) {
            // Stalled. Let's retry.
            this.uploadContentNow(true)
          }
        }, 5000)
      }
    }
  }

  undo () {
    if (this.pushUndoStackTimeout !== null) {
      clearTimeout(this.pushUndoStackTimeout)
      this.pushUndoStackTimeout = null
    }
    let col = this.props.collection
    if (!col || !col.content) return
    if (col.contentUndoStack && col.contentUndoStack.length > 0) {
      AppState.dispatch({type: 'collection-undo'})
    }
  }
  redo () {
    if (this.pushUndoStackTimeout !== null) {
      clearTimeout(this.pushUndoStackTimeout)
      this.pushUndoStackTimeout = null
    }
    let col = this.props.collection
    if (!col || !col.content) return
    if (col.contentRedoStack && col.contentRedoStack.length > 0) {
      AppState.dispatch({type: 'collection-redo'})
    }
  }

  handleGlobaleKey (evt) {
    if (evt.ctrlKey && !evt.shiftKey && (evt.key.toLowerCase() === 'z' || evt.keyCode === 90)) {
      evt.preventDefault()
      this.undo()
    } else if (evt.ctrlKey && (
        (!evt.shiftKey && (evt.key.toLowerCase() === 'y' || evt.keyCode === 89)) ||
        (evt.shiftKey && (evt.key.toLowerCase() === 'z' || evt.keyCode === 90))
      )) {
      evt.preventDefault()
      this.redo()
    }
  }

  componentDidMount () {
    window.document.addEventListener('keydown', this.handleGlobaleKey, AppState.browserSupportsPassiveEvents ? {passive: false} : false)
    if (this.props.collection && this.props.collection.content) {
      AppState.dispatch({type: 'collection-push-undostack'})
    }
    let col = this.props.collection
    if (col.lastSave && (!col.lastSave.done || col.lastSave.error) && col.content && !col.loading) {
      this.uploadContentNow(true)
    } else if (col && col.loading) {
      this.startLoad()
    } else if (col && !col.loading && (!col.content || !col.lastSave || (!col.lastSave.error && col.lastSave.done) || !col.lastSave.contentSaved || col.contentSaved === col.content)) {
      AppState.dispatch({type: 'collection-reload'})
    } else {
      this.uploadContentNow(true)
    }
  }
  componentWillUnmount () {
    window.document.removeEventListener('keydown', this.handleGlobaleKey)
    if (this.setIntervaled) {
      clearInterval(this.setIntervaled)
    }
    if (this.pushUndoStackTimeout != null) {
      clearTimeout(this.pushUndoStackTimeout)
      this.pushUndoStackTimeout = null
    }
  }
}

module.exports = { CollectionView }
