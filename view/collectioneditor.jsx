const Set = require('es6-set')
const Map = require('es6-map')
const React = require('react')
const ReactDOM = require('react-dom')

const AllowedFormattingNodes = /^([bius])$/i // <b>, <i>, <s>, <u>
let editorNodeTypeNameTable = {}

class BaseEditorNodeComponent extends React.Component {
  static structureFromDataset (dataset) {
    // return { type: ..., ... }
    throw new Error('abstract.')
  }
  constructor (props) {
    super(props)
    // props.structure: structure for this editor node.
    if (new.target === Abstract) throw new Error('abstract.')
  }
  render () {
    // assert(this.props.structure.type === ...)
    throw new Error('abstract.')
  }
  toDataset () {
    // return { enType: ..., ... }
    throw new Error('abstract.')
  }
}

class HiderEditorNode extends React.Component {
  static structureFromDataset (dataset) {
    if (dataset.enType !== 'hider') throw new Error('dataset invalid.')
    return {
      type: 'hider'
    }
  }
  render () {
    return (
      <div>
        Hello world! Time: {Date.now()}.
      </div>
    )
  }
  toDataset () {
    return {
      enType: 'hider'
    }
  }
}
editorNodeTypeNameTable.hider = HiderEditorNode

class Editor extends React.Component {
  constructor (props) {
    super(props)
    this.handleInput = this.handleInput.bind(this)
    this.currentDOMStructure = null
    this.currentEditorNodes = new Map() // dom node -> component
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
  nodeIsEditorNode (node) {
    return node.dataset.editornode === 'true'
  }
  normalizeHTML (html = '', nestedEditorNodeCallback = null) {
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
        newElement.innerHTML = this.normalizeHTML(node.innerHTML, nestedEditorNodeCallback)
        parsedDOM.body.replaceChild(newElement, node)
      } else if (/^(del|strike)$/i.test(node.nodeName)) {
        let newElement = parsedDOM.createElement('s') // <del>/<strike> -> <s>
        newElement.innerHTML = this.normalizeHTML(node.innerHTML, nestedEditorNodeCallback)
        parsedDOM.body.replaceChild(newElement, node)
      } else if (node.nodeName.toLowerCase() === 'br' && i === nodes.length - 1) { // Firefox wired behavior
        let newNode = parsedDOM.createElement('br')
        parsedDOM.body.replaceChild(newNode, node)
      } else if (this.nodeIsEditorNode(node)) {
        if (nestedEditorNodeCallback) {
          nestedEditorNodeCallback(node)
          this.recycleNode(node)
          node.remove()
        } else {
          let newNode = parsedDOM.createTextNode('<Invalid editor node>')
          parsedDOM.body.replaceChild(newNode, node)
        }
      } else {
        let newNode = parsedDOM.createTextNode(node.innerText)
        parsedDOM.body.replaceChild(newNode, node)
      }
    }
    return parsedDOM.body.innerHTML
  }

  dom2structure (domElement) {
    let structure = [] // This get stored in the content of the collection.
    /*
      Each element of this structure array is either a:
        * Paragraph containing formatted text: { type: 'text', html: normalizedHTML }
          Mergeable.
    */
    let isLastNodeInline = false // Whether the last node is a part of a paragraph. I.e. #text, b, i, etc., rather than a concrete paragraph.
    let nodes = domElement.childNodes
    for (let i = 0; i < nodes.length; i ++) {
      let node = nodes[i]
      let hangingEditorNodes = []
      if (node.nodeName.toLowerCase() === '#text' || AllowedFormattingNodes.test(node.nodeName)) {
        if (isLastNodeInline && structure.length > 0) {
          let lastStructure = Object.assign({}, structure[structure.length - 1])
          if (!lastStructure.type === 'text') {
            throw new Error("lastStructure isn't of type text but isLastNodeInline == true.")
          }
          lastStructure.html = this.normalizeHTML(lastStructure.html + (node.outerHTML || node.nodeValue || ''), editorNode => {
            hangingEditorNodes.push(editorNode)
          })
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
          html: this.normalizeHTML(node.innerHTML || node.nodeValue || '', editorNode => {
            hangingEditorNodes.push(editorNode)
          })
        })
        isLastNodeInline = false
      } else if (node.nodeName.toLowerCase() === 'br') {
        isLastNodeInline = false
      } else if (this.nodeIsEditorNode(node)) {
        structure.push(this.editorNode2Structure(node))
        isLastNodeInline = false
      } else {
        isLastNodeInline = true
      }
      hangingEditorNodes.forEach(node => {
        structure.push(this.editorNode2Structure(node))
      })
    }
    let emptyParagraph = st => st.type === 'text' && st.html.replace(/<br>/i, '').trim() === ''
    while (structure.length >= 2 && emptyParagraph(structure[structure.length - 1]) && emptyParagraph(structure[structure.length - 2])) {
      structure.splice(structure.length - 1, 1)
    }
    return structure // Do not modify on top of this. Always create a new one.
  }

  editorNode2Structure (node) {
    let component = this.currentEditorNodes.get(node)
    if (!component) {
      // Probably copy-pasted orphan node. Lets construct component for it (but don't render, cuz pure function).
      let componentClass = editorNodeTypeNameTable[node.dataset.enType]
      if (!componentClass) {
        return {
          type: 'text',
          html: '&lt;Invalid node&gt;'
        }
      }
      try {
        return componentClass.structureFromDataset(node.dataset)
      } catch (e) {
        console.error(e)
        return {
          type: 'text',
          html: '&lt;Invalid node data&gt;'
        }
      }
    } else {
      return component.props.structure
    }
  }

  recycleNode (node) {
    if (!(node instanceof Element)) return
    if (this.currentEditorNodes.has(node)) {
      this.currentEditorNodes.delete(node)
    }
    ReactDOM.unmountComponentAtNode(node)
  }

  structure2dom (structure, domElement) {
    if (this.currentDOMStructure === structure) {
      return
    }
    console.log('structure2dom')
    let touchedEditorNodes = new Set()
    let processEditorNode = (current, currentElement) => {
      // React.render into old node will update the content (and the component's props).
      let componentClass = editorNodeTypeNameTable[current.type]
      if (!componentClass) {
        if (currentElement) {
          this.recycleNode(currentElement)
          currentElement.remove() // To not complicate matters.
        }
        return null
      }
      let reactElement = React.createElement(componentClass, {
        structure: current
      })
      let nodeSet = this.currentEditorNodes
      if (currentElement && this.nodeIsEditorNode(currentElement)) {
        currentElement.dataset.editornode = 'true'
        currentElement.dataset.enType = current.type
        currentElement.contentEditable = 'false'
        ReactDOM.render(reactElement, currentElement, function () {
          // `this` is the component.
          nodeSet.set(currentElement, this)
        })
        touchedEditorNodes.add(currentElement)
        return null
      } else {
        // Create a new node and render it.
        let newNode = document.createElement('div')
        newNode.dataset.editornode = 'true'
        newNode.dataset.enType = current.type
        newNode.contentEditable = 'false'
        // <div data-editornode="true" data-en-type="hider"></div>
        if (currentElement) {
          this.recycleNode(currentElement)
          domElement.replaceChild(newNode, currentElement)
        }
        ReactDOM.render(reactElement, newNode, function () {
          nodeSet.set(newNode, this)
          if (this instanceof Editor || !this.props) {
            debugger
          }
        })
        touchedEditorNodes.add(newNode)
        return newNode
      }
    }

    let replacementElementFromCurrentStructure = current => {
      let newElement
      switch (current.type) {
        case 'text':
        newElement = document.createElement('p')
        newElement.innerHTML = this.normalizeHTML(current.html)
        return newElement
        default:
        return processEditorNode(current, null)
      }
    }
    let i
    for (i = 0; i < structure.length; i ++) {
      let current = structure[i]
      let currentElement = domElement.childNodes[i]
      if (!currentElement) {
        domElement.appendChild(replacementElementFromCurrentStructure(current))
        continue
      }
      switch (current.type) {
        case 'text':
          if (currentElement.nodeName.toLowerCase() === 'p'
              && currentElement.innerHTML === this.normalizeHTML(current.html)) continue
          else {
            this.recycleNode(currentElement)
            domElement.replaceChild(replacementElementFromCurrentStructure(current), currentElement)
          }
          break
        default:
          processEditorNode(current, currentElement)
      }
    }
    // i == structure.length
    while (domElement.childNodes.length > i) {
      let node = domElement.childNodes[i]
      this.recycleNode(node)
      node.remove()
    }
    if (structure.length === 0) {
      domElement.innerHTML = '<p></p>'
    }
    if (document.activeElement === domElement) {
      document.execCommand('insertBrOnReturn', null, false)
    }
    this.currentDOMStructure = structure
    // TODO: call this.recycleNode for node disappeared.

    this.currentEditorNodes.forEach((comp, node) => {
      if (!touchedEditorNodes.has(node)) {
        this.recycleNode(node)
        console.log('node gc')
      }
    })
  }

  handleInput (evt) {
    if (this.props.onChange) {
      if (!evt && !this.editorDOM) return
      let structure = this.dom2structure(evt ? evt.target : this.editorDOM)
      this.props.onChange(structure)
    }
  }
  execCommandDirect (cmd) {
    let ele = this.editorDOM
    if (this.commandBtnDisabled(cmd)) return
    document.execCommand('styleWithCSS', null, false)
    document.execCommand(cmd)
    this.handleInput()
  }
  commandBtnDisabled (cmd) {
    let ele = this.editorDOM
    if (!ele || document.activeElement !== ele || (document.queryCommandEnabled && !document.queryCommandEnabled(cmd))) return true
    return false
  }
  canInsertNow (type) {
    let ele = this.editorDOM
    if (!ele || document.activeElement !== ele) return false
    let sel = window.getSelection()
    if (sel.rangeCount !== 1) return false
    if (document.queryCommandEnabled && !document.queryCommandEnabled('insertHTML')) return false
      // Although this command is not used, queryCommandEnabled can be used to test if the cursor is in areas editable.
    return true
  }
  insertEditorNode (type) {
    if (!this.canInsertNow(type)) return
    let sel = window.getSelection()
    if (sel.rangeCount > 0) {
      let range = sel.getRangeAt(0)
      range.collapse(false)
      let newNode = document.createElement('div')
      newNode.dataset.editornode = 'true'
      newNode.dataset.enType = type
      newNode.contentEditable = 'false'
      range.insertNode(newNode)
      this.handleInput()
    }
  }

  render () {
    let commandBtnClass = cmd => cmd + (this.commandBtnDisabled(cmd) ? ' disabled' : '')
    let canInsertBtnClass = cmd => cmd + (!this.canInsertNow(cmd) ? ' disabled' : '')
    return (
      <div className='collectionEditor'>
        <div className='sidebar' onMouseDown={evt => evt.preventDefault()}>
          <div className='description'>Aa</div>
          <div className={commandBtnClass('bold')} title='bold' onClick={evt => this.execCommandDirect('bold')}><b>B</b></div>
          <div className={commandBtnClass('italic')} title='italic' onClick={evt => this.execCommandDirect('italic')}><i>I</i></div>
          <div className={commandBtnClass('strikeThrough')} title='strike through' onClick={evt => this.execCommandDirect('strikeThrough')}><s>D</s></div>
          <div className={commandBtnClass('underline')} title='underline' onClick={evt => this.execCommandDirect('underline')}><u>U</u></div>
          <div className='description'>+</div>
          <div className={canInsertBtnClass('hider')} title='hider' onClick={evt => this.insertEditorNode('hider')}>
            <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
          </div>
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

module.exports = { Editor }
