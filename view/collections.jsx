const React = require('react')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')

class CollectionsView extends React.Component {
  constructor (props) {
    super(props)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.handleTitleChange = this.handleTitleChange.bind(this)
    let col = this.props.collection
    if (!AppState.getState().serverrender) {
      if (col.lastSave && !col.lastSave.done) {
        this.uploadContentNow(true)
      } else if (col && col.loading) {
        this.startLoad()
      } else if (col && !col.loading && col.rand === col.lastSave.rand) {
        AppState.dispatch({type: 'collection-reload'})
      }
    }
  }
  handleInputChange (content) {
    AppState.dispatch({type: 'collection-edit-content', content: Object.assign({}, this.props.collection.content, {
      text: content
    })})
  }
  handleTitleChange (evt) {
    AppState.dispatch({type: 'collection-edit-content', content: Object.assign({}, this.props.collection.content, {
      name: evt.target.value
    })})
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
    if (col.lastSave && col.lastSave.done) {
      setTimeout(() => {
        this.forceUpdate()
      }, 1000)
    }
    return (
      <div className='list'>
        <div className='top'>
          <div className='close'>Close</div>
          <h1>
            {col.loading || col.error ? 'Collection\u2026'
              : (col.content ? (typeof col.content.name === 'string' ? (
                <input type='text' value={col.content.name} onInput={this.handleTitleChange} placeholder='(empty title)' />
              ) : (
                <input type='text' value='' placeholder='Untitled' className='untitled' onInput={this.handleTitleChange} />
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
                  Error: {col.error.message}
                  <div className='retry' onClick={evt => AppState.dispatch({type: 'collection-reload'})}>Retry</div>
                </div>
              )
            : null}
          {col.content !== null && !col.loading
            ? (
                <Editor content={col.content.text || ''} onChange={this.handleInputChange} />
              )
            : null}
        </div>
        <div className='bottom'>
          {!col.content ? 'Fetching content from server\u2026' : null}
          {col.lastSave && col.lastSave.done ? `Last saved: ${Math.round((Date.now() - (col.lastSave.time)) / 1000)}s ago.` : null}
          {col.lastSave && !col.lastSave.done ? 'Saving\u2026' : null}
        </div>
      </div>
    )
  }
  componentDidUpdate (prevProps, prevState) {
    let col = this.props.collection
    if (col && col.loading && (!prevProps.col || !prevProps.col.loading)) {
      this.startLoad()
    } else if (col && !col.loading && col.content) {
      this.tryUpload()
    }
  }

  startLoad () {
    let col = this.props.collection
    if (!col || !col.loading) return
    fetch(`/collections/${col.id}/cloudstorage/`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
      if (this.props.collection.id !== col.id) return
      if (result.error) {
        AppState.dispatch({type: 'collection-load-error', error: result.error})
      } else {
        AppState.dispatch({type: 'collection-load-data', content: result})
      }
    }, err => {
      if (this.props.collection.id !== col.id) return
      AppState.dispatch({type: 'collection-load-error', error: err})
    })
  }

  uploadContentNow (force) {
    let col = this.props.collection
    if (!col || !col.content) return
    if (col.lastSave) {
      if (col.lastSave.rand === col.rand && !force) return
    }
    AppState.dispatch({type: 'collection-put-start', rand: col.rand})
    let ctHeaders = new Headers()
    ctHeaders.append('Content-Type', 'application/json')
    fetch(`/collections/${col.id}/cloudstorage/`, {method: 'PUT', body: JSON.stringify(col.content), headers: ctHeaders})
      .then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
        AppState.dispatch({type: 'collection-put-done', rand: col.rand})
      }, err => {
        AppState.dispatch({type: 'collection-put-error', error: err})
      })
  }

  tryUpload () {
    let col = this.props.collection
    if (!col || col.loading || !col.content) return
    if (!col.lastSave || col.lastSave.done) {
      this.uploadContentNow()
    } else {
      if (!this.last1sTimeout) {
        this.last1sTimeout = setTimeout(() => {
          this.last1sTimeout = null
          this.tryUpload()
        }, 1000)
      }
      let lastSaveRand = col.lastSave.rand
      if (!this.last5sTimeout) {
        this.last5sTimeout = setTimeout(() => {
          this.last5sTimeout = null
          if (this.props.collection.lastSave && this.props.collection.lastSave.rand === lastSaveRand && !this.props.collection.lastSave.done) {
            this.uploadContentNow(true)
          }
        }, 5000)
      }
    }
  }
}

class Editor extends React.Component {
  constructor () {
    super()
    this.handleInput = this.handleInput.bind(this)
  }
  normalizeHTML (html = '') {
    let parser = new DOMParser()
    let parsedDOM = parser.parseFromString(html, 'text/html')
    if (!parsedDOM.body) {
      return html
    }
    let nodes = parsedDOM.body.childNodes
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i]
      if (node.nodeName === '#text') continue
      if (node.nodeName.match(/^([bi]|del)$/i)) {
        let newElement = parsedDOM.createElement(node.nodeName)
        newElement.innerHTML = this.normalizeHTML(node.innerHTML)
        parsedDOM.body.replaceChild(newElement, nodes[i])
      } else if (node.nodeName.toLowerCase() === 'br' && i === nodes.length - 1) { // Firefox wired behavior
        let newNode = parsedDOM.createElement('br')
        parsedDOM.body.replaceChild(newNode, nodes[i])
      } else {
        let newNode = parsedDOM.createTextNode(node.innerText)
        parsedDOM.body.replaceChild(newNode, nodes[i])
      }
    }
    return parsedDOM.body.innerHTML
  }
  handleInput (evt) {
    if (this.props.onChange) {
      this.props.onChange(this.normalizeHTML(evt.target.innerHTML))
    }
  }
  shouldComponentUpdate(nextProps, nextState) {
    if (!this.editorDOM) return true
    if (this.normalizeHTML(nextProps.content) === this.editorDOM.innerHTML) {
      return false
    }
    return true
  }
  render () {
    return (
      <div className='collectionEditor'>
        <div className='content' contentEditable='true' ref={f => this.editorDOM = f} onInput={this.handleInput}
          dangerouslySetInnerHTML={{__html: this.normalizeHTML(this.props.content)}} />
      </div>
    )
  }
}

module.exports = { CollectionsView }
