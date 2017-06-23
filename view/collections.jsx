const React = require('react')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')

const AllowedFormattingNodes = /^([bius])$/i // <b>, <i>, <s>, <u>

class CollectionsView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      noEditAccess: false
    }
    this.setIntervaled = null
    this.handleInputChange = this.handleInputChange.bind(this)
    this.handleTitleChange = this.handleTitleChange.bind(this)
    let col = this.props.collection
    if (!AppState.getState().serverrender) {
      if (col.lastSave && (!col.lastSave.done || col.lastSave.error)) {
        this.uploadContentNow(true)
      } else if (col && col.loading) {
        this.startLoad()
      } else if (col && !col.loading && (!col.lastSave || !col.lastSave.rand || col.rand === col.lastSave.rand)) {
        AppState.dispatch({type: 'collection-reload'})
      }
    }
  }
  handleInputChange (content) {
    AppState.dispatch({type: 'collection-edit-content', content: Object.assign({}, this.props.collection.content, {
      structure: content
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
    let lastSaveError = col.lastSave && col.lastSave.done && col.lastSave.error
    let editDisabled = !AppState.getState().authToken || this.state.noEditAccess
    return (
      <div className='doc'>
        <div className='top'>
          <div className='close'>Close</div>
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
                  Error: {col.error}
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
        <div className={'bottom' + (lastSaveError ? ' error' : '')}>
          {!col.content ? 'Fetching content from server\u2026' : null}
          {col.lastSave && col.lastSave.done && !col.lastSave.error ? `Last saved: ${Math.round((Date.now() - (col.lastSave.time)) / 1000)}s ago.` : null}
          {lastSaveError ? (
            !this.state.noEditAccess
              ? `Error saving collection: ${col.lastSave.error}. Your edit isn't uploaded yet.`
              : `You can't edit this collection.`
          ) : null}
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
        }, 1000)
      }
    } else if (this.setIntervaled) {
      clearInterval(this.setIntervaled)
      this.setIntervaled = null
    }
  }

  startLoad () {
    let col = this.props.collection
    if (!col || !col.loading) return
    let authHeaders = new Headers()
    if (AppState.getState().authToken)
      authHeaders.append('Authorization', 'Bearer ' + AppState.getState().authToken)
    fetch(`/collections/${col.id}/cloudstorage/`, {headers: authHeaders}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
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
      if (col.lastSave.rand === col.rand && !force) return
    }
    AppState.dispatch({type: 'collection-put-start', rand: col.rand})
    let headers = new Headers()
    headers.append('Content-Type', 'application/json')
    if (AppState.getState().authToken)
      headers.append('Authorization', 'Bearer ' + AppState.getState().authToken)
    fetch(`/collections/${col.id}/cloudstorage/`, {method: 'PUT', body: JSON.stringify(col.content), headers: headers})
      .then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => {
        AppState.dispatch({type: 'collection-put-done', rand: col.rand})
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
    if (!col.lastSave || col.lastSave.done && col.lastSave.time <= Date.now() - 1000) {
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
  constructor (props) {
    super(props)
    this.handleInput = this.handleInput.bind(this)
    this.currentDOMStructure = null
  }
  componentDidMount () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
  }
  componentDidUpdate () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
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
      if (AllowedFormattingNodes.test(node.nodeName)) {
        let newElement = parsedDOM.createElement(node.nodeName)
        newElement.innerHTML = this.normalizeHTML(node.innerHTML)
        parsedDOM.body.replaceChild(newElement, nodes[i])
      } else if (/^(del|strike)$/i.test(node.nodeName)) {
        let newElement = parsedDOM.createElement('s') // <del>/<strike> -> <s>
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

  html2structure (html) {
    let parser = new DOMParser()
    let parsedDOM = parser.parseFromString(html, 'text/html')
    if (!parsedDOM.body) {
      throw new Error('HTML invalid.')
    }
    let structure = [] // This get stored in the content of the collection.
    /*
      Each element of this structure array is either a:
        * Paragraph containing formatted text: { type: 'text', html: normalizedHTML }
          Mergeable.
    */
    let isLastNodeInline = false // Whether the last node is a part of a paragraph. I.e. #text, b, i, etc., rather than a concrete paragraph.
    let nodes = parsedDOM.body.childNodes
    for (let i = 0; i < nodes.length; i ++) {
      let node = nodes[i]
      if (node.nodeName.toLowerCase() === '#text' || AllowedFormattingNodes.test(node.nodeName)) {
        if (isLastNodeInline && structure.length > 0) {
          let lastStructure = Object.assign({}, structure[structure.length - 1])
          if (!lastStructure.type === 'text') {
            throw new Error("lastStructure isn't of type text but isLastNodeInline == true.")
          }
          lastStructure.html = this.normalizeHTML(lastStructure.html + (node.outerHTML || node.nodeValue || ''))
          structure[structure.length - 1] = lastStructure
        } else {
          structure.push({
            type: 'text',
            html: this.normalizeHTML(node.outerHTML || node.nodeValue || '')
          })
        }
        isLastNodeInline = true
      } else if (node.nodeName.toLowerCase() === 'p') {
        structure.push({
          type: 'text',
          html: this.normalizeHTML(node.innerHTML || node.nodeValue || '')
        })
        isLastNodeInline = false
      } else if (node.nodeName.toLowerCase() === 'br') {
        isLastNodeInline = false
      } else {
        isLastNodeInline = true
      }
    }
    let emptyParagraph = st => st.type === 'text' && st.html.replace(/<br>/i, '').trim() === ''
    while (structure.length >= 2 && emptyParagraph(structure[structure.length - 1]) && emptyParagraph(structure[structure.length - 2])) {
      structure.splice(structure.length - 1, 1)
    }
    return structure // Do not modify on top of this. Always create a new one.
  }

  structure2dom (structure, domElement) {
    if (this.currentDOMStructure === structure) {
      return
    }
    console.log('structure2dom')
    let createReplacementElementFromStructure = current => {
      let newElement
      switch (current.type) {
        case 'text':
        newElement = document.createElement('p')
        newElement.innerHTML = this.normalizeHTML(current.html)
        return newElement
        default: return null
      }
    }
    let i
    for (i = 0; i < structure.length; i ++) {
      let current = structure[i]
      let currentElement = domElement.childNodes[i]
      if (!currentElement) {
        domElement.appendChild(createReplacementElementFromStructure(current))
        continue
      }
      switch (current.type) {
        case 'text':
          if (currentElement.nodeName.toLowerCase() === 'p'
              && currentElement.innerHTML === this.normalizeHTML(current.html)) continue
          else {
            domElement.replaceChild(createReplacementElementFromStructure(current), currentElement)
          }
          break
        default:
          break
      }
    }
    // i == structure.length
    while (domElement.childNodes.length > i) {
      domElement.childNodes[i].remove()
    }
    if (structure.length === 0) {
      domElement.innerHTML = '<p></p>'
    }
    if (document.activeElement === domElement) {
      document.execCommand('insertBrOnReturn', null, false)
    }
    this.currentDOMStructure = structure
  }

  handleInput (evt) {
    if (this.props.onChange) {
      let structure = this.html2structure(evt.target.innerHTML)
      this.props.onChange(structure)
    }
  }
  execCommandDirect (cmd) {
    let ele = this.editorDOM
    if (this.commandBtnDisabled(cmd)) return
    document.execCommand('styleWithCSS', null, false)
    document.execCommand(cmd)
  }
  commandBtnDisabled (cmd) {
    let ele = this.editorDOM
    if (!ele || document.activeElement !== ele || (document.queryCommandEnabled && !document.queryCommandEnabled(cmd))) return true
    return false
  }

  render () {
    let commandBtnClass = cmd => cmd + (this.commandBtnDisabled(cmd) ? ' disabled' : '')
    return (
      <div className='collectionEditor'>
        <div className='sidebar' onMouseDown={evt => evt.preventDefault()}>
          <div className='description'>fmt&hellip;</div>
          <div className={commandBtnClass('bold')} title='bold' onClick={evt => this.execCommandDirect('bold')}><b>B</b></div>
          <div className={commandBtnClass('italic')} title='italic' onClick={evt => this.execCommandDirect('italic')}><i>I</i></div>
          <div className={commandBtnClass('strikeThrough')} title='strike through' onClick={evt => this.execCommandDirect('strikeThrough')}><s>D</s></div>
          <div className={commandBtnClass('underline')} title='underline' onClick={evt => this.execCommandDirect('underline')}><u>U</u></div>
        </div>
        <div
          className={'content' + (this.props.disabled ? ' disabled' : '')}
          contentEditable={this.props.disabled ? 'false' : 'true'}
          ref={f => this.editorDOM = f}
          onInput={this.handleInput} />
      </div>
    )
  }
}

module.exports = { CollectionsView }
