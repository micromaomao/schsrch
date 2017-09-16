const Set = require('es6-set')
const Map = require('es6-map')
const React = require('react')
const ReactDOM = require('react-dom')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const SsPdfView = require('./sspdfview.jsx')
const PaperUtils = require('./paperutils.js')
const AnnotationLayer = require('./annotationlayer.jsx')

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
    this.handleDelete = this.handleDelete.bind(this)
    this.handleSorthand = this.handleSorthand.bind(this)
    // FIXME: this dosen't play well with older browsers an current uglifyjs (3.0.23).
    // if (new.target === BaseEditorNodeComponent) throw new Error('abstract.')
  }
  render () {
    // assert(this.props.structure.type === ...)
    throw new Error('abstract.')
  }
  toDataset () {
    // return { enType: ..., ... }
    throw new Error('abstract.')
  }
  getSorthand () {
    if (this.props.disabled) return null
    return (
      <span className='sorthand' onMouseDown={this.handleSorthand} onMouseUp={this.handleSorthand} onTouchStart={this.handleSorthand}>
        <svg className="icon ii-sorthand"><use href="#ii-sorthand" xlinkHref="#ii-sorthand" /></svg>
      </span>
    )
  }
  getDeleteBtn () {
    if (this.props.disabled) return null
    return (
      <span className='delete' onClick={this.handleDelete}>
        <svg className="icon ii-del"><use href="#ii-del" xlinkHref="#ii-del" /></svg>
      </span>
    )
  }
  handleSorthand () {
    if (this.props.onSorthand) {
      this.props.onSorthand()
    }
  }
  handleDelete (evt) {
    if (!this.props.onUpdateStructure) {
      throw new Error('no props.onUpdateStructure')
    }
    this.props.onUpdateStructure(null)
  }
  getPrintFragments (sketch) {
    return ['<div class="unknowEditorNode">Unknown editor node</div>']
  }
}

class HiderEditorNode extends BaseEditorNodeComponent {
  static structureFromDataset (dataset) {
    if (dataset.enType !== 'hider') throw new Error('dataset invalid.')
    return {
      type: 'hider',
      content: JSON.parse(dataset.content || '[]')
    }
  }
  constructor (props) {
    super(props)
    this.state = {
      hidden: true
    }
    this.handleInputChange = this.handleInputChange.bind(this)
    this.toggleHide = this.toggleHide.bind(this)
  }
  render () {
    return (
      <div className='enHider'>
        <div className='menu'>
          {this.getSorthand()}
          {this.getDeleteBtn()}
          {!this.state.hidden
            ? (
                <span className='hide' onClick={this.toggleHide}>
                  <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
                </span>
              ) : null}
          {this.state.hidden
            ? (
                <span className='show' onClick={this.toggleHide}>
                  Show hidden content
                </span>
              ) : null}
        </div>
        <div className='contentcontain'>
          {!this.state.hidden
            ? (
                <Editor structure={this.props.structure.content || []} onChange={this.handleInputChange} disabled={this.props.disabled} />
              ) : null}
        </div>
      </div>
    )
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.structure.content !== this.props.structure.content) {
      this.setState({
        hidden: false
      })
    }
  }
  handleInputChange (nContent) {
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      content: nContent
    }))
  }
  toDataset () {
    return {
      enType: 'hider',
      content: JSON.stringify(this.props.structure.content || '[]')
    }
  }
  toggleHide () {
    this.setState({
      hidden: !this.state.hidden
    })
  }
}
editorNodeTypeNameTable.hider = HiderEditorNode

class PaperCropEditorNode extends BaseEditorNodeComponent {
  static isValidBoundary (boundary) {
    if (!Array.isArray(boundary)) return false
    if (boundary.length !== 4) return false
    for (let i = 0; i < boundary.length; i ++) {
      let b = boundary[i]
      if (!Number.isFinite(b)) return false
      if (b < 0) return false
    }
    if (boundary[0] >= boundary[2]) return false
    if (boundary[1] >= boundary[3]) return false
    return true
  }
  static structureFromDataset (dataset) {
    if (dataset.enType !== 'paperCrop') throw new Error('dataset invalid.')
    let struct = {
      type: 'paperCrop',
      doc: dataset.doc === 'null' ? null : dataset.doc,
      page: dataset.page === 'null' ? null : parseInt(dataset.page),
      boundary: dataset.boundary ? JSON.parse(dataset.boundary) : null,
      annotations: dataset.annotations ? JSON.parse(dataset.annotations) : null
    }
    if (!Number.isSafeInteger(struct.page) || (Number.isSafeInteger(struct.page) && struct.page < 0)) struct.page = null
    if (!struct.doc) struct.doc = null
    if (!/^[0-9a-f]+$/.test(struct.doc)) struct.doc = null
    if (!PaperCropEditorNode.isValidBoundary(struct.boundary)) struct.boundary = null
    if (struct.doc && (struct.page === null || !struct.boundary)) throw new Error('dataset invalid.')
    return struct
  }

  constructor (props) {
    super(props)
    this.state = {
      loading: false,
      error: null,
      docJson: null,
      docMeta: null,
      measuredViewWidth: 0,
      reCropping: null,
      annotating: false,
      contentViewBox: null
    }
    this.handleApplySelection = this.handleApplySelection.bind(this)
    this.handleCropBoundaryChange = this.handleCropBoundaryChange.bind(this)
    this.handleAnnotationChange = this.handleAnnotationChange.bind(this)
    this.handleSspdfViewboxChange = this.handleSspdfViewboxChange.bind(this)
  }

  componentDidMount () {
    this.unsub = AppState.subscribe(() => {this.forceUpdate()})
    if (this.props.structure.doc) {
      this.loadDoc()
    }
    this.measureViewDim()
  }
  componentDidUpdate (prevProps, prevState) {
    let cStruct = this.props.structure
    let pStruct = prevProps.structure
    if ((cStruct.doc !== pStruct.doc || cStruct.page !== pStruct.page) && cStruct.doc) {
      this.loadDoc()
    } else if (!cStruct.doc && pStruct.doc) {
      this.setState({loading: false, error: null, docJson: null, docMeta: null})
    }
    this.measureViewDim()
  }
  measureViewDim () {
    if (!this.docContain) {
      if (this.state.measuredViewWidth === 0) return
      this.setState({
        measuredViewWidth: 0
      })
    } else {
      let cs = window.getComputedStyle(this.docContain)
      let width = parseFloat(cs.width) || 0
      if (Math.abs(this.state.measuredViewWidth - width) < 1) return
      this.setState({measuredViewWidth: width})
    }
  }

  loadDoc (doc = this.props.structure.doc, page = this.props.structure.page) {
    if (!doc || !/^[0-9a-f]+$/.test(doc)) return
    if (!Number.isSafeInteger(page)) return
    if (this.loading) return
    this.setState({loading: null, error: null})
    fetch(`/doc/${doc}/?page=${page}&as=sspdf&decache=${AppState.sspdfDecacheVersion}`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (this.props.structure.doc !== doc || this.props.structure.page !== page) return
      this.setState({loading: false, error: null, docJson: json, docMeta: json.doc})
    }, err => {
      if (this.props.structure.doc !== doc || this.props.structure.page !== page) return
      this.setState({loading: false, error: err, docJson: null, docMeta: null})
    })
    this.setState({loading: true, error: null})
  }

  componentWillUnmount () {
    this.unsub()
  }
  render () {
    let sspdfDim = this.calcSspdfDim()
    return (
      <div className='enPaperCrop'>
        <div className='menu'>
          {this.getSorthand()}
          {this.getDeleteBtn()}
          {!this.props.disabled && !this.state.reCropping && this.props.structure.doc && this.state.docMeta
            ? (
                <span onClick={evt => this.startReCrop()}>
                  <svg className="icon ii-edit"><use href="#ii-edit" xlinkHref="#ii-edit" /></svg>
                </span>
              ) : null}
          {!this.props.disabled && this.state.reCropping
            ? (
                <span onClick={evt => this.finishReCrop()}>
                  <svg className="icon ii-save"><use href="#ii-save" xlinkHref="#ii-save" /></svg>
                </span>
              ) : null}
          {!this.props.disabled && this.state.reCropping
            ? (
                <span onClick={evt => this.cancelReCrop()}>
                  <svg className="icon ii-c"><use href="#ii-c" xlinkHref="#ii-c" /></svg>
                </span>
              ) : null}
          {!this.props.disabled && !this.state.reCropping && this.props.structure.doc && this.state.docMeta && !this.state.annotating
            ? (
                <span onClick={evt => this.startAnnotating()}>
                  <svg className="icon ii-pen"><use href="#ii-pen" xlinkHref="#ii-pen" /></svg>
                </span>
              ) : null}
          {!this.props.disabled && this.state.annotating && !this.state.reCropping
            ? (
                <span onClick={evt => this.finishAnnotating()}>
                  <svg className="icon ii-save"><use href="#ii-save" xlinkHref="#ii-save" /></svg>
                </span>
              ) : null}
          {this.props.disabled && !this.props.structure.doc
            ? (
                <a>Empty clip.</a>
              ) : null}
          {!this.state.reCropping && this.props.structure.doc && this.state.docMeta
            ? (
                <a className='doc' onClick={evt => this.openDoc()}>{PaperUtils.setToString(this.state.docMeta)} - page {this.props.structure.page + 1}</a>
              ) : null}
        </div>
        {!this.props.structure.doc && !AppState.getState().paperCropClipboard && !this.props.disabled
          ? (
              <div className='prompt'>
                Select a paper by&nbsp;
                  <a onClick={evt => AppState.dispatch({type: 'home-from-collection'})}>searching</a>
                  &nbsp;for some and click the <span>
                  <svg className="icon ii-crop"><use href="#ii-crop" xlinkHref="#ii-crop" /></svg>
                </span> button, then go here and apply it.
              </div>
            )
          : null}
        {!this.props.structure.doc && AppState.getState().paperCropClipboard && !this.props.disabled
          ? (
              <div className='prompt apply'>
                <a onClick={this.handleApplySelection}>Apply selection here</a>
              </div>
            )
          : null}
        {!this.props.structure.doc && AppState.getState().paperCropClipboard && this.props.disabled
          ? (
              <div className='prompt'>
                Can't apply your selection here since you can't edit this collection.
              </div>
            )
          : null}
        {this.props.structure.doc && PaperCropEditorNode.isValidBoundary(this.props.structure.boundary)
          ? (
              <div className='doccontain' ref={f => this.docContain = f}>
                {!this.state.error && this.state.docJson
                  ? (
                      <SsPdfView
                        docJson={this.state.docJson}
                        overlay={this.renderOverlay()}
                        width={sspdfDim[0]}
                        height={sspdfDim[1]}
                        fixedBoundary={!this.state.reCropping ? this.props.structure.boundary : null}
                        cropBoundary={this.state.reCropping || null}
                        onCropBoundaryChange={this.state.reCropping ? this.handleCropBoundaryChange : null}
                        onViewboxChange={this.handleSspdfViewboxChange}
                        ref={f => this.sspdf = f} />
                    ) : null}
                {!this.state.error && this.state.docJson && !this.state.reCropping && this.state.contentViewBox
                  ? (
                      <AnnotationLayer
                        width={sspdfDim[0]}
                        height={sspdfDim[1]}
                        disabled={!this.state.annotating}
                        viewOffset={this.state.contentViewBox.ctPos}
                        viewScale={(this.state.contentViewBox.ctSize[0] / this.state.docJson.width + this.state.contentViewBox.ctSize[1] / this.state.docJson.height) / 2}
                        annotations={this.props.structure.annotations}
                        onAnnotationChange={this.handleAnnotationChange} />
                    ) : null}
                {!this.state.error && this.state.loading && !this.state.docJson
                  ? (
                      <div className='loading'>Loading</div>
                    ) : null}
                {this.state.error
                  ? (
                      <div className='error'>{this.state.error.message}</div>
                    ) : null}
              </div>
            )
          : null}
      </div>
    )
  }

  calcSspdfDim () {
    let mw = this.state.measuredViewWidth
    if (mw < 1) return [0, 0]
    if (this.state.reCropping && this.state.docJson) {
      let [dw, dh] = ['width', 'height'].map(p => this.state.docJson[p])
      return [mw, Math.min(mw * (dh / dw), window.innerHeight)]
    }
    let boundary = this.props.structure.boundary
    if (!PaperCropEditorNode.isValidBoundary(this.props.structure.boundary)) return 0
    let [bw, bh] = [boundary[2] - boundary[0], boundary[3] - boundary[1]]
    let priHight =  bh / bw * mw
    if (priHight / bh > 1.5) {
      return [mw, bh * 1.5]
    }
    return [mw, priHight]
  }

  renderOverlay () {
    return []
  }

  toDataset () {
    let structure = this.props.structure
    let dataPage = structure.page
    if (Number.isSafeInteger(dataPage)) dataPage = dataPage.toString()
    else dataPage = 'null'
    return {
      enType: 'paperCrop',
      doc: structure.doc || 'null',
      page: dataPage,
      boundary: JSON.stringify(structure.boundary),
      annotations: JSON.stringify(structure.annotations)
    }
  }

  handleApplySelection () {
    let clip = AppState.getState().paperCropClipboard
    if (!clip) return
    if (!clip.doc) return
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      doc: clip.doc,
      page: clip.page,
      boundary: clip.boundary
    }))
  }
  
  openDoc () {
    if (!this.state.docMeta || !this.props.structure.doc) return
    AppState.dispatch({type: 'home'})
    AppState.dispatch({type: 'query', query: PaperUtils.setToString(this.state.docMeta) + '_' + this.state.docMeta.type})
    AppState.dispatch({type: 'previewFile', psKey: PaperUtils.setToString(this.state.docMeta), fileId: this.props.structure.doc, page: this.props.structure.page})
  }

  handleCropBoundaryChange (boundary) {
    if (!this.state.reCropping) return
    this.setState({reCropping: boundary})
  }

  startReCrop () {
    if (!this.state.docJson || this.state.reCropping) return
    this.setState({reCropping: (this.props.structure.boundary || [0, 0, this.state.docJson.width, this.state.docJson.height])})
  }

  finishReCrop () {
    if (!PaperCropEditorNode.isValidBoundary(this.state.reCropping)) return
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      boundary: this.state.reCropping
    }))
    this.setState({reCropping: null})
  }

  cancelReCrop () {
    this.setState({reCropping: null})
  }

  startAnnotating () {
    if (this.sspdf) {
      this.sspdf.reCenter()
    }
    this.setState({annotating: true})
  }
  finishAnnotating () {
    this.setState({annotating: false})
  }
  handleAnnotationChange (na) {
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      annotations: na
    }))
  }

  handleSspdfViewboxChange (vbox) {
    this.setState({contentViewBox: vbox})
  }
}
editorNodeTypeNameTable.paperCrop = PaperCropEditorNode

class Editor extends React.Component {
  constructor (props) {
    super(props)
    this.btnStateInterval = null
    this.handleInput = this.handleInput.bind(this)
    this.currentDOMStructure = null
    this.currentEditorNodes = new Map() // dom node -> component
    this.currentEditorNodesFromStructure = new Map() // structure item -> component
    this.inputEventMergeTimeout = null
  }
  componentDidMount () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
    if (this.btnStateInterval === null) this.btnStateInterval = setInterval(() => this.forceUpdate(), 1000)
  }
  componentWillUnmount () {
    this.cancelDelayedInputEvent()
    if (this.btnStateInterval !== null) {
      clearInterval(this.btnStateInterval)
      this.btnStateInterval = null
    }
    if (this.editorDOM) this.structure2dom({}, this.editorDOM) // Unrender react components.
    this.currentDOMStructure = null
  }
  componentDidUpdate () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
    this.currentEditorNodes.forEach(comp => {comp.forceUpdate()})
  }
  nodeIsEditorNode (node) {
    return node.dataset.editornode === 'true'
  }

  normalizeHTML (html = '', nestedEditorNodeCallback = null) {
    if (html.endsWith && html.endsWith('<br>')) {
      let rest = html.substr(0, html.length - 4)
      if (!/[<>]/.test(rest)) {
        return html
      }
    }
    if (!/[<>]/.test(html)) {
      return html
    }

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
    let newHtml = parsedDOM.body.innerHTML
    if (newHtml === '') {
      return '&nbsp;'
    }
    return newHtml
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
    if (structure.length >= 1 && structure[structure.length - 1].type !== 'text') {
      structure.push({
        type: 'text',
        html: '<br>'
      })
    }
    if (structure.length >= 1 && structure[0].type !== 'text') {
      structure.splice(0, 0, {
        type: 'text',
        html: '<br>'
      })
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
    console.log('recycling ', node)
    if (this.currentEditorNodes.has(node)) {
      this.currentEditorNodes.delete(node)
    }
    ReactDOM.unmountComponentAtNode(node)
  }

  structure2dom (structure, domElement) {
    if (this.currentDOMStructure === structure) {
      return
    }
    let timeStart
    if (process.env.NODE_ENV !== 'production') {
      timeStart = window.performance.now()
    }

    let touchedEditorNodes = new Set()
    this.currentEditorNodesFromStructure.clear()
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
      let thisEditor = this
      let enDOM = null
      let reactElement = React.createElement(componentClass, {
        structure: current,
        disabled: thisEditor.props.disabled,
        onUpdateStructure: function (newStructure) {
          thisEditor.runDelayedInputEventNow()
          if (thisEditor.props.structure !== structure) {
            thisEditor.forceUpdate()
            return
          }
          let newStructureArr = structure.map(st => (st === current ? newStructure : st))
            .filter(a => a !== null)
          thisEditor.props.onChange(newStructureArr)
        },
        onSorthand: function () {
          if (enDOM !== null) {
            let sel = window.getSelection()
            let range = document.createRange()
            range.selectNode(enDOM)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
      })
      let nodeSet = this.currentEditorNodes
      let nodeSetFromStructure = this.currentEditorNodesFromStructure
      if (currentElement && this.nodeIsEditorNode(currentElement)) {
        currentElement.dataset.editornode = 'true'
        currentElement.dataset.enType = current.type
        currentElement.contentEditable = 'false'
        ReactDOM.render(reactElement, currentElement, function () {
          // `this` is the component.
          nodeSet.set(currentElement, this)
          nodeSetFromStructure.set(current, this)
          Object.assign(currentElement.dataset, this.toDataset())
        })
        touchedEditorNodes.add(currentElement)
        enDOM = currentElement
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
          nodeSetFromStructure.set(current, this)
          Object.assign(newNode.dataset, this.toDataset())
        })
        touchedEditorNodes.add(newNode)
        enDOM = newNode
        return newNode
      }
    }

    let replacementElementFromCurrentStructure = current => {
      if (!current || !current.type) {
        let errorMsg = document.createElement('p')
        errorMsg.innerText = '<invalid structure>'
        return errorMsg
      }
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
      if (!current || !current.type) {
        this.recycleNode(currentElement)
        domElement.replaceChild(replacementElementFromCurrentStructure(current), currentElement)
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
    if (document.activeElement === domElement) {
      document.execCommand('insertBrOnReturn', null, false)
    }
    this.currentDOMStructure = structure

    this.currentEditorNodes.forEach((comp, node) => {
      if (!touchedEditorNodes.has(node)) {
        this.recycleNode(node)
      }
    })

    if (process.env.NODE_ENV !== 'production') {
      let timeEnd = window.performance.now()
      console.log(`structure2dom took ${timeEnd - timeStart} ms.`)
    }
  }

  handleInput (evt) {
    if (this.props.onChange) {
      if (!this.editorDOM) return
      if (evt && evt.target !== this.editorDOM) return
      if (this.inputEventMergeTimeout !== null) {
        clearTimeout(this.inputEventMergeTimeout)
      }
      this.inputEventMergeTimeout = setTimeout(() => {
        this.inputEventMergeTimeout = null
        let structure = this.dom2structure(this.editorDOM)
        this.props.onChange(structure)
      }, 200)
    }
  }

  runDelayedInputEventNow () {
    if (this.inputEventMergeTimeout === null || !this.editorDOM) return
    this.cancelDelayedInputEvent()
    let structure = this.dom2structure(this.editorDOM)
    this.props.onChange(structure)
  }
  cancelDelayedInputEvent () {
    if (this.inputEventMergeTimeout !== null) {
      clearTimeout(this.inputEventMergeTimeout)
      this.inputEventMergeTimeout = null
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
  canInsertNow () {
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
        {this.props.disabled
          ? null
          : (
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
                <div className={canInsertBtnClass('paperCrop')} title='paper crop' onClick={evt => this.insertEditorNode('paperCrop')}>
                  <svg className="icon ii-crop"><use href="#ii-crop" xlinkHref="#ii-crop" /></svg>
                </div>
              </div>
            )}
        <div
          className={'content' + (this.props.disabled ? ' disabled' : '')}
          contentEditable={this.props.disabled ? 'false' : 'true'}
          ref={f => this.editorDOM = f}
          onInput={this.handleInput} />
      </div>
    )
  }
  createPrintFragments (sketch) {
    let structure = this.props.structure
    this.structure2dom(structure, this.editorDOM)
    let fragments = []
    for (let current of structure) {
      switch (current.type) {
        case 'text':
        fragments.push('<p>' + this.normalizeHTML(current.html) + '</p>') // TODO
        break
        default:
        let editorNodeComponent = this.currentEditorNodesFromStructure.get(current)
        if (!editorNodeComponent) {
          throw new Error("Can't find the corrosponding editorNodeComponent of structure " + JSON.stringify(current) + '.')
        }
        Array.prototype.push.apply(fragments, editorNodeComponent.getPrintFragments(sketch))
        break
      }
    }
    return fragments
  }
}

module.exports = { Editor }
