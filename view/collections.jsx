const React = require('react')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')

const AllowedFormattingNodes = /^([biu]|del)$/i // <b>, <i>, <del>, <u>

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
                <Editor structure={col.content.structure || []} onChange={this.handleInputChange} />
              )
            : null}
        </div>
        <div className='bottom'>
          {!col.content ? 'Fetching content from server\u2026' : null}
          {col.lastSave && col.lastSave.done && !col.lastSave.error ? `Last saved: ${Math.round((Date.now() - (col.lastSave.time)) / 1000)}s ago.` : null}
          {col.lastSave && col.lastSave.done && col.lastSave.error ? `Error saving collection: ${col.lastSave.error.message}` : null}
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
    if (structure.length === 0) structure.push({type: 'text', html: ''})
    let emptyParagraph = st => st.type === 'text' && st.html.trim() === ''
    while(structure.length > 1 && emptyParagraph(structure[structure.length - 1])) {
      structure.splice(structure.length - 1, 1)
    }
    return structure
  }
  structure2dom (structure, domElement) {
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
    let moveCursor = false
    if (structure.length === 0) {
      domElement.innerHTML = '<p></p>'
      moveCursor = true
    }
    if (structure.length === 1 && structure[0].type === 'text' && /^.?$/.test(structure[0].html)) {
      moveCursor = true
    }
    if (moveCursor) {
      if (document.activeElement !== domElement) return
      let rge = document.createRange()
      rge.selectNodeContents(domElement.childNodes[0])
      rge.collapse(false)
      let sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(rge)
    }
  }
  handleInput (evt) {
    if (this.props.onChange) {
      let structure = this.html2structure(evt.target.innerHTML)
      this.props.onChange(structure)
    }
  }
  render () {
    return (
      <div className='collectionEditor'>
        <div className='content' contentEditable='true' ref={f => this.editorDOM = f} onInput={this.handleInput} />
      </div>
    )
  }
}

module.exports = { CollectionsView }
