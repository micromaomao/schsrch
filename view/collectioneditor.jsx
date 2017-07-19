const Set = require('es6-set')
const Map = require('es6-map')
const React = require('react')
const ReactDOM = require('react-dom')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const SsPdfView = require('./sspdfview.jsx')
const PaperUtils = require('./paperutils.js')
const { assertValidPoint, client2view, pointDistance } = require('./pointutils.js')

const etAttr = 'data-event-bind'

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
    if (new.target === BaseEditorNodeComponent) throw new Error('abstract.')
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
}

class HiderEditorNode extends BaseEditorNodeComponent {
  static structureFromDataset (dataset) {
    if (dataset.enType !== 'hider') throw new Error('dataset invalid.')
    return {
      type: 'hider',
      hidden: dataset.hidden === 'true',
      content: JSON.parse(dataset.content || '[]')
    }
  }
  constructor (props) {
    super(props)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.toggleHide = this.toggleHide.bind(this)
  }
  render () {
    return (
      <div className='enHider'>
        <div className='menu'>
          {this.getSorthand()}
          {this.getDeleteBtn()}
          <span className='hide' onClick={this.toggleHide}>
            <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
          </span>
        </div>
        <div className='contentcontain'>
          {this.props.structure.hidden
            ? (
                <div className='hiddenplaceholder'>
                  Content hidden. Click&nbsp;
                  <span onClick={this.toggleHide}>
                    <svg className="icon ii-hider"><use href="#ii-hider" xlinkHref="#ii-hider" /></svg>
                  </span>
                  &nbsp;to reveal.
                </div>
              )
            : (
                <Editor structure={this.props.structure.content || []} onChange={this.handleInputChange} disabled={this.props.disabled} />
              )}
        </div>
      </div>
    )
  }
  handleInputChange (nContent) {
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      content: nContent
    }))
  }
  toDataset () {
    return {
      enType: 'hider',
      hidden: (this.props.structure.hidden ? 'true' : 'false'),
      content: JSON.stringify(this.props.structure.content || '[]')
    }
  }
  toggleHide () {
    this.props.onUpdateStructure(Object.assign({}, this.props.structure, {
      hidden: !this.props.structure.hidden
    }))
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
    fetch(`/doc/${doc}/?page=${page}&as=sspdf`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
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
          {this.props.disabled && !this.props.structure.doc
            ? (
                <a>Empty clip.</a>
              ) : null}
          {!this.state.reCropping && this.props.structure.doc && this.state.docMeta
            ? (
                <a className='doc' onClick={evt => this.openDoc()}>{PaperUtils.setToString(this.state.docMeta)} - page {this.props.structure.page + 1}</a>
              ) : null}
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
                        onViewboxChange={this.handleSspdfViewboxChange} />
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

class AnnotationLayer extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      downEventTimestamp: null,
      downEventPos: null,
      tapValid: false,
      tapIdentifier: null,
      creating: null,
      highlightAno: null
    }
    this.documentEventBound = false
    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
  }
  emptyAnnotations () {
    return this.props.annotations === null || !Array.isArray(this.props.annotations) || this.props.annotations.length === 0
  }
  render () {
    if (!this.props.width || !this.props.height) return null
    if (!this.props.viewOffset || !this.props.viewScale) return null
    return (
      <div className='annotations' ref={f => this.eventTarget = f} onMouseMove={this.handleMouseMove}
        style={{
          width: this.props.width + 'px',
          height: this.props.height + 'px',
          pointerEvents: (this.props.disabled ? 'none' : 'auto')}} >
        {this.emptyAnnotations() && !this.props.disabled && !this.state.creating
          ? (
              <div className='placeholder'>
                <div className='pen'>
                  <svg className="icon ii-pen"><use href="#ii-pen" xlinkHref="#ii-pen" /></svg>
                </div>
                No annotations yet. Tap anywhere to create one.<br />
              </div>
            ) : null}
        {this.state.creating && !this.props.disabled
          ? (() => {
                let creating = this.state.creating
                if (creating.type === 'prompt') {
                  const promptWidth = 40 * 2 + 2*2
                  const promptHeight = 40 + 2*2
                  // 2*2 for borders.

                  let viewPoint = this.doc2view(creating.point)
                  viewPoint[0] -= promptWidth / 2
                  viewPoint[1] -= promptHeight / 2
                  return (
                    <div className='creationPrompt' ref={f => this.creationPrompt = f} style={{
                        left: Math.max(0, Math.min(viewPoint[0], this.props.width - promptWidth)) + 'px',
                        top: Math.max(0, Math.min(viewPoint[1], this.props.height - promptHeight)) + 'px',
                        width: promptWidth + 'px',
                        height: promptHeight + 'px'
                      }}>
                      <span ref={f => this.creationPromptSketch = f}>
                        <svg className="icon ii-pencil"><use href="#ii-pencil" xlinkHref="#ii-pencil" /></svg>
                      </span>
                      <span>
                        <svg className="icon ii-textbox"><use href="#ii-textbox" xlinkHref="#ii-textbox" /></svg>
                      </span>
                    </div>
                  )
                }
                if (creating.type === 'sketch') {
                  return (
                    <div className='sketchCreate' ref={f => this.sketchCreateDoneBtn = f}>
                      Done
                    </div>
                  )
                }
                return null
              }
            )() : null}
        {!this.emptyAnnotations()
          ? (
              this.props.annotations.map((ano, i) => {
                let highlight = this.state.highlightAno === ano
                if (ano.type === 'sketch') {
                  let svgPath = ano.paths.map(path => {
                    if (!Array.isArray(path)) return ''
                    if (path.length < 2) return ''
                    let haveValidLead = false
                    let svgSubPath = path.map((point, i) => {
                      try {
                        let viewPoint = this.doc2view(point)
                        let lead = 'L'
                        if (i === 0) {
                          lead = 'M'
                          haveValidLead = true
                        }
                        return `${lead} ${viewPoint[0]} ${viewPoint[1]}`
                      } catch (e) {
                        return ''
                      }
                    }).join(' ')
                    if (!haveValidLead) return ''
                    return svgSubPath
                  }).join(' ')
                  if (svgPath.trim().length === 0) return null
                  return (
                    <div className='ano sketch' key={i}>
                      <svg width={this.props.width} height={this.props.height}>
                        <path d={svgPath} stroke='#FF5722' fill='none' strokeWidth={highlight ? '2' : '1'} />
                      </svg>
                    </div>
                  )
                }
                return null
              })
            ) : null}
      </div>
    )
  }
  componentDidMount () {
    this.bindEvents()
  }
  componentDidUpdate (prevProps, prevState) {
    this.bindEvents()
    if (prevProps.disabled !== this.props.disabled) {
      this.setState({
        downEventTimestamp: null,
        downEventPos: null,
        tapValid: false,
        tapIdentifier: null,
        creating: null
      })
    }
  }
  componentWillUnmount () {
    this.unbindEvents()
  }
  bindEvents () {
    let et = this.eventTarget
    if (!et) return
    if (et.getAttribute(etAttr) === 'true') return
    let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
    et.addEventListener('touchstart', this.handleDown, noPassiveEventsArgument)
    et.addEventListener('mousedown', this.handleDown, noPassiveEventsArgument)
    et.setAttribute(etAttr, 'true')
  }
  unbindEvents () {
    let et = this.eventTarget
    if (!et) return
    if (et.getAttribute(etAttr) !== 'true') return
    et.removeEventListener('touchstart', this.handleDown)
    et.removeEventListener('mousedown', this.handleDown)
    et.setAttribute(etAttr, 'false')
  }

  handleDown (evt) {
    let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false

    evt.preventDefault()
    if (!evt.touches) {
      // MOUSE
      if (!this.documentEventBound) {
        document.addEventListener('mousemove', this.handleMove, noPassiveEventsArgument)
        document.addEventListener('mouseup', this.handleUp, noPassiveEventsArgument)
        this.documentEventBound = true
      }

      let pos = this.client2view([evt.clientX, evt.clientY])
      this.pressDown(pos, evt.target)
      this.setState({
        downEventTimestamp: Date.now(),
        downEventPos: pos,
        tapValid: true,
        tapIdentifier: null
      })
    } else {
      // TOUCH
      if (!this.documentEventBound) {
        document.addEventListener('touchmove', this.handleMove, noPassiveEventsArgument)
        document.addEventListener('touchend', this.handleUp, noPassiveEventsArgument)
        document.addEventListener('touchcancel', this.handleUp, noPassiveEventsArgument)
        this.documentEventBound = true
      }

      if (evt.touches.length === 1) {
        // 1 point touch
        let t = evt.touches[0]
        let pos = this.client2view([t.clientX, t.clientY])
        this.pressDown(pos, evt.target)
        this.setState({
          downEventTimestamp: Date.now(),
          downEventPos: pos,
          tapValid: true,
          tapIdentifier: t.identifier
        })
      } else {
        // multi point touches
        this.setState({
          downEventTimestamp: null,
          downEventPos: null,
          tapValid: false,
          tapIdentifier: null
        })
      }
    }
  }
  handleMove (evt) {
    evt.preventDefault()
    if (!evt.touches) {
      // MOUSE
      let nPoint = this.client2view([evt.clientX, evt.clientY])
      this.pressMove(nPoint)
      if (this.state.tapValid) {
        let pPoint = this.state.downEventPos
        if (pointDistance(pPoint, nPoint) >= 3) {
          this.setState({
            tapValid: false
          })
        }
      }
    } else {
      // TOUCH
      if (evt.touches.length === 1 && evt.changedTouches.length <= 1 && evt.touches[0].identifier === this.state.tapIdentifier) {
        // 1 point touch
        let t = evt.touches[0]
        let nPoint = this.client2view([t.clientX, t.clientY])
        this.pressMove(nPoint)
        if (this.state.tapValid) {
          let pPoint = this.state.downEventPos
          if (pointDistance(pPoint, nPoint) >= 3) {
            this.setState({
              tapValid: false
            })
          }
        }
      } else {
        // multi point touches
        this.setState({
          downEventTimestamp: null,
          downEventPos: null,
          tapValid: false,
          tapIdentifier: false
        })
      }
    }
  }
  handleMouseMove (evt) {
    if (!this.state.creating) {
      let point = this.client2view([evt.clientX, evt.clientY])
      requestAnimationFrame(() => {
        if (this.state.creating) return
        if (this.state.downEventTimestamp === null) {
          let docPoint = this.view2doc(point)
          let ano = this.rayAnnotations(docPoint)
          this.setState({highlightAno: ano})
        }
      })
    }
  }
  handleUp (evt) {
    evt.preventDefault()
    if (!evt.touches) {
      if (this.documentEventBound) {
        document.removeEventListener('mousemove', this.handleMove)
        document.removeEventListener('mouseup', this.handleUp)
        this.documentEventBound = false
      }
    } else {
      if (this.documentEventBound) {
        document.removeEventListener('touchmove', this.handleMove)
        document.removeEventListener('touchend', this.handleUp)
        document.removeEventListener('touchcancel', this.handleUp)
        this.documentEventBound = false
      }
    }
    this.pressUp()
    if (this.state.tapValid) {
      this.handleTap(evt)
    }
    this.setState({
      downEventTimestamp: null,
      downEventPos: null,
      tapValid: false,
      tapIdentifier: false
    })
  }

  handleTap (evt) {
    if (!this.props.disabled && !this.state.creating) {
      let point = this.view2doc(this.state.downEventPos)
      this.setState({creating: {
        type: 'prompt',
        point
      }})
    } else if (this.state.creating && this.state.creating.type === 'prompt' && this.creationPrompt) {
      if (!this.creationPrompt.contains(evt.target)) {
        this.setState({creating: null})
      } else if (this.creationPromptSketch.contains(evt.target) || evt.target === this.creationPromptSketch) {
        this.sketchCreate()
      }
    } else if (this.state.creating && this.state.creating.type === 'sketch' && !this.state.creating.sketching &&
        (this.sketchCreateDoneBtn && (this.sketchCreateDoneBtn.contains(evt.target) || evt.target === this.sketchCreateDoneBtn))) {
      this.setState({
        creating: null
      })
    }
  }

  pressDown (point, target) {
    if (this.state.creating && this.state.creating.type === 'sketch') {
      if (this.sketchCreateDoneBtn && (this.sketchCreateDoneBtn.contains(target) || target === this.sketchCreateDoneBtn)) {
        this.setState({
          creating: Object.assign({}, this.state.creating, {
            sketching: false
          })
        })
      } else {
        this.delayedSketchUpdates = []
        let creatingState = this.state.creating
        let sketchingPath = [this.view2doc(point)]
        let modAno = Object.assign({}, creatingState.target)
        modAno.paths = modAno.paths.concat([sketchingPath])
        let annotationChanged = !this.commitAnnotationObjectModification(modAno, creatingState.target)
        if (!annotationChanged) {
          this.setState({
            creating: {
              type: 'sketch',
              target: modAno,
              sketching: true
            }
          })
        } else {
          this.sketchCreate()
          this.pressDown(point, target)
        }
      }
    }
  }
  pressMove (point) {
    if (this.state.creating && this.state.creating.type === 'sketch' && this.state.creating.sketching) {
      if (!this.delayedSketchUpdates) this.delayedSketchUpdates = []
      if (!this.lastSketchUpdateTime || Date.now() - this.lastSketchUpdateTime > 50) {
        let oldAno = this.state.creating.target
        if (oldAno.paths.length > 0) {
          let newAno = Object.assign({}, oldAno, {
            paths: oldAno.paths.slice()
          })
          let newPaths = newAno.paths
          let newPath = newPaths[newPaths.length - 1].concat(this.delayedSketchUpdates).concat([this.view2doc(point)])
          newPaths[newPaths.length - 1] = newPath
          this.commitAnnotationObjectModification(newAno, oldAno)
          this.setState({
            creating: {
              type: 'sketch',
              target: newAno,
              sketching: true
            }
          })
        }
        this.lastSketchUpdateTime = Date.now()
        this.delayedSketchUpdates = []
      } else {
        this.delayedSketchUpdates.push(this.view2doc(point))
      }
    }
  }
  pressUp () {
    if (this.state.creating && this.state.creating.type === 'sketch' && this.state.creating.sketching) {
      let oldAno = this.state.creating.target
      let newAno = Object.assign({}, oldAno, {
        paths: oldAno.paths.slice()
      })
      let newPaths = newAno.paths
      let newPath = newPaths[newPaths.length - 1].concat(this.delayedSketchUpdates)
      newPaths[newPaths.length - 1] = newPath
      this.commitAnnotationObjectModification(newAno, oldAno)
      this.setState({
        creating: {
          type: 'sketch',
          target: newAno,
          sketching: false
        }
      })
      this.lastSketchUpdateTime = null
      this.delayedSketchUpdates = []
    }
  }

  client2view (point) {
    return client2view(point, this.eventTarget)
  }
  view2doc (point) {
    assertValidPoint(point)
    let [x, y] = point
    let [offX, offY] = this.props.viewOffset
    let scale = this.props.viewScale
    return [(x - offX) / scale, (y - offY) / scale]
  }
  doc2view (point) {
    assertValidPoint(point)
    let [x, y] = point
    let [offX, offY] = this.props.viewOffset
    let scale = this.props.viewScale
    return [x * scale + offX, y * scale + offY]
  }

  getNewAnnotationObject (prototype) {
    if (!this.props.onAnnotationChange) throw new Error('No onAnnotationChange')
    let annotations = this.props.annotations || []
    let ano = Object.assign({}, prototype)
    this.props.onAnnotationChange(annotations.concat([ano]))
    return ano
  }
  commitAnnotationObjectModification (newObj, oldObj) {
    if (!this.props.onAnnotationChange) throw new Error('No onAnnotationChange')
    if (newObj === oldObj) throw new Error('Two objects are the same')
    let oldAnnotations = this.props.annotations || []
    let index = oldAnnotations.indexOf(oldObj)
    if (index < 0) return false
    let modAnnotations = oldAnnotations.slice()
    modAnnotations[index] = newObj
    this.props.onAnnotationChange(modAnnotations)
    return true
  }

  sketchCreate () {
    let sketchAnnotation = this.getNewAnnotationObject({
      type: 'sketch',
      paths: []
    })
    this.setState({
      creating: {
        type: 'sketch',
        target: sketchAnnotation,
        sketching: true
      }
    })
  }

  rayAnnotations (point) {
    let annotations = this.props.annotations
    let scale = this.props.viewScale || 1
    let threshold = 10 / scale
    if (!annotations) return null
    for (let ano of annotations) {
      if (ano.type === 'sketch') {
        let paths = ano.paths
        for (let path of paths) {
          if (path.length === 0) continue
          if (path.length === 1) {
            let pt = path[0]
            if (pointDistance(pt, point) <= threshold) return ano
          } else {
            for (let i = 0; i < path.length - 1; i ++) {
              let p1 = path[i]
              let p2 = path[i + 1]
              let pDist = pointDistance(p1, p2)
              if (pDist < threshold) {
                if (pointDistance(p1, point) <= threshold || pointDistance(p2, point) <= threshold) return ano
              } else {
                for (let i = 0; i < pDist; i += threshold) {
                  let weight = i / pDist
                  let np = [0, 1].map(a => p1[a] * (1 - weight) + p2[a] * weight)
                  if (pointDistance(np, point) <= threshold) return ano
                }
              }
            }
          }
        }
      }
    }
    return null
  }
}

class Editor extends React.Component {
  constructor (props) {
    super(props)
    this.btnStateInterval = null
    this.handleInput = this.handleInput.bind(this)
    this.currentDOMStructure = null
    this.currentEditorNodes = new Map() // dom node -> component
  }
  componentDidMount () {
    if (this.props.structure && this.editorDOM) {
      this.structure2dom(this.props.structure, this.editorDOM)
    }
    if (this.btnStateInterval === null) this.btnStateInterval = setInterval(() => this.forceUpdate(), 1000)
  }
  componentWillUnmount () {
    if (this.btnStateInterval !== null) {
      clearInterval(this.btnStateInterval)
      this.btnStateInterval = null
    }
    if (this.editorDOM) this.structure2dom({}, this.editorDOM) // Unrender react components.
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
    let emptyParagraph = st => st.type === 'text' && st.html.replace(/<br>/i, '').trim() === ''
    while (structure.length >= 2 && emptyParagraph(structure[structure.length - 1]) && emptyParagraph(structure[structure.length - 2])) {
      structure.splice(structure.length - 1, 1)
    }
    if (structure.length >= 1 && structure[structure.length - 1].type !== 'text') {
      structure.push({
        type: 'text',
        html: '&nbsp;'
      })
    }
    if (structure.length >= 1 && structure[0].type !== 'text') {
      structure.splice(0, 0, {
        type: 'text',
        html: '&nbsp;'
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
      let thisEditor = this
      let enDOM = null
      let reactElement = React.createElement(componentClass, {
        structure: current,
        disabled: thisEditor.props.disabled,
        onUpdateStructure: function (newStructure) {
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
      if (currentElement && this.nodeIsEditorNode(currentElement)) {
        currentElement.dataset.editornode = 'true'
        currentElement.dataset.enType = current.type
        currentElement.contentEditable = 'false'
        ReactDOM.render(reactElement, currentElement, function () {
          // `this` is the component.
          nodeSet.set(currentElement, this)
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
  }

  handleInput (evt) {
    if (this.props.onChange) {
      if (!this.editorDOM) return
      if (evt && evt.target !== this.editorDOM) return
      let structure = this.dom2structure(this.editorDOM)
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
}

module.exports = { Editor }
