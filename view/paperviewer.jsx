const React = require('react')
const getDocument = require('./lpdfjs.js')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.jsx')
const PaperUtils = require('./paperutils.js')
const { client2view, pointDistance } = require('./pointutils.js')

class PaperViewer extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      paperFileId: null,
      dirs: null,
      loadError: null,
      mode: null,
      pdfjsObjs: null,
      tCurrentType: null
    }

    this.handleAppStateUpdate = this.handleAppStateUpdate.bind(this)
  }

  loadPaper (fileId) {
    if (this.state.paperFileId === fileId) return
    this.setState({loadError: null})
    if (this.state.paperFileId) {
      for (let t of Object.keys(this.state.pdfjsObjs)) {
        if (this.state.pdfjsObjs[t].document) {
          this.state.pdfjsObjs[t].document.destroy()
        }
        delete this.state.pdfjsObjs[t]
      }
      this.setState({
        dirs: null,
        mode: null,
        pdfjsObjs: null
      })
    }

    this.setState({
      paperFileId: fileId
    })

    if (fileId) {
      fetch(`/dirs/batch/?docid=${encodeURIComponent(fileId)}`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
        if (this.state.paperFileId !== fileId) return

        this.setState({dirs: json, pdfjsObjs: {}})

        // TODO
        if (true) {
          let sortedTypeStrArr = Object.keys(json).sort(PaperUtils.funcSortType)
          this.setState({
            mode: 't',
            tCurrentType: this.state.tCurrentType || sortedTypeStrArr[0]
          })
          for (let type of sortedTypeStrArr) {
            let docid = json[type].docid
            this.loadPDF(type, docid)
          }
        }
      }, err => {
        if (this.state.paperFileId !== fileId) return

        this.setState({loadError: err})
      })
    }
  }

  loadPDF (type, docid) {
    if (!this.state.pdfjsObjs) throw new Error('this.state.pdfjsObjs is not an object.')
    return new Promise((resolve, reject) => {
      let obj = this.state.pdfjsObjs[type]
      if (!obj) {
        obj = {
          loadTask: null,
          document: null,
          progress: 0,
          error: null
        }
        this.state.pdfjsObjs[type] = obj
        getDocument('/doc/' + encodeURIComponent(docid) + '/', loadTask => {
          obj.loadTask = loadTask
          this.forceUpdate()
          loadTask.onProgress = ({loaded, total}) => {
            obj.progress = loaded / total
            this.forceUpdate()
          }
        }).then(pdf => {
          obj.document = pdf
          resolve()
          this.forceUpdate()
        }, err => {
          obj.error = err
          reject(err)
          this.forceUpdate()
        })
        this.forceUpdate()
      } else {
        resolve()
      }
    })
  }

  componentDidMount () {
    this._appstateUnsub = AppState.subscribe(this.handleAppStateUpdate)
    this.handleAppStateUpdate()
  }

  componentWillUnmount () {
    // free resources
    this.loadPaper(null)
    this._appstateUnsub()
    this._appstateUnsub = null
  }

  handleAppStateUpdate () {
    let v2viewing = AppState.getState().v2viewing
    if (!v2viewing) {
      this.loadPaper(null)
    } else {
      this.loadPaper(v2viewing.fileId)
    }
  }

  render () {
    if (!this.state.paperFileId) return null
    if (this.state.loadError) {
      return (
        <div className='paperviewer'>
          <FetchErrorPromise.ErrorDisplay error={this.state.loadError} serverErrorActionText={'get document'} />
        </div>
      )
    }
    if (!this.state.mode) {
      let desc = null
      let progress = null
      if (!this.state.dirs) {
        progress = 0
        desc = 'Loading paper structure'
      } else {
        progress = 0.2
        desc = 'Loading question paper'
      }
      return (
        <div className='paperviewer loading'>
          <div className='loadingtitle'>Downloading&hellip;</div>
          <div className='loadingdesc'>{desc}</div>

          <div className='progressbar'>
            <div className='fill' style={{width: (progress * 100) + '%'}} />
          </div>
        </div>
      )
    } else if (this.state.mode === 't') {
      return (
        <div className='paperviewer mode-t'>
          <div className='typebar'>
            {this.state.pdfjsObjs ? Object.keys(this.state.pdfjsObjs).sort(PaperUtils.funcSortType).map(typeStr => {
              let obj = this.state.pdfjsObjs[typeStr]
              return (
                <div className={'item' + (this.state.tCurrentType === typeStr ? ' current' : '')} key={typeStr}
                  onClick={evt => this.tSwitchTo(typeStr)}>
                  {typeStr}{!obj.document ? '\u2026' : null}
                  {!obj.document ? <div className='loadingfill' style={{width: (obj.progress * 100) + '%'}} /> : null}
                </div>
              )
            }) : null}
          </div>
          {this.state.pdfjsObjs && this.state.pdfjsObjs[this.state.tCurrentType] ? (() => {
            let obj = this.state.pdfjsObjs[this.state.tCurrentType]
            if (!obj.document) {
              return (
                <div className='pdfcontain loading'>
                  <div className='progressbar'>
                    <div className='fill' style={{width: (obj.progress * 100) + '%'}} />
                  </div>
                </div>
              )
            } else {
              return (
                <div className='pdfcontain'>
                  <PDFJSViewer doc={obj.document} />
                </div>
              )
            }
          })() : null}
        </div>
      )
    }
    return (
      <div className='paperviewer'>
        Stub!
      </div>
    )
  }

  tSwitchTo (typeStr) {
    if (this.state.mode === 't') {
      this.setState({tCurrentType: typeStr})
    }
  }
}

class PendingTransform {
  static LINEAR (x) {
    return x
  }
  static EASEOUT (x) {
    return 1 - Math.pow(1-x, 2)
  }

  constructor (nTranslate, nScale, stage) {
    Object.defineProperty(this, 'nTranslate', {value: nTranslate, writable: false})
    Object.defineProperty(this, 'nScale', {value: nScale, writable: false})
    Object.defineProperty(this, 'stage', {value: stage, writable: false})
    this.animationFrame = null
  }

  applyImmediate () {
    let stage = this.stage
    if (stage.currentAnimation) {
      stage.currentAnimation.stop()
      stage.currentAnimation = null
    }

    stage.translate = this.nTranslate
    stage.scale = this.nScale

    if (stage.onUpdate) stage.onUpdate()
  }

  stop () {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
    this.animationFrame = null
    if (this.stage.currentAnimation === this) this.stage.currentAnimation = null
  }

  startAnimation (duration = 400, easing = PendingTransform.EASEOUT) {
    let stage = this.stage
    if (stage.currentAnimation) {
      stage.currentAnimation.stop()
    }
    stage.currentAnimation = this

    let initialState = {translate: stage.translate.slice(), scale: stage.scale}
    let startTime = Date.now()
    let self = this
    this.animationFrame = requestAnimationFrame(function nextFrame () {
      if (stage.currentAnimation !== self) return
      let x = (Date.now() - startTime) / duration
      if (x >= 1) {
        stage.currentAnimation = null
        stage.translate = self.nTranslate
        stage.scale = self.nScale
        if (stage.onUpdate) stage.onUpdate()
        return
      }
      x = easing(x)
      ;[0,1].map(p => {
        stage.translate[p] = initialState.translate[p] + (self.nTranslate[p] - initialState.translate[p]) * x
      })
      stage.scale = initialState.scale + (self.nScale - initialState.scale) * x
      if (stage.onUpdate) stage.onUpdate()
      self.animationFrame = requestAnimationFrame(nextFrame)
    })
  }

  /**
   * @see TransformationStage.canvas2stage
   */
  canvas2stage (point) {
    return [0,1].map(p => (point[p] - this.nTranslate[p])/this.nScale)
  }

  /**
   * @see TransformationStage.stage2canvas
   */
  stage2canvas (point) {
    return [0,1].map(p => point[p]*this.nScale + this.nTranslate[p])
  }

  /**
   * Return a new transform with a translation that will make the point pStage on stage map to pCanvas on canvas after
   * the stage transform.
   * @param {Array<number>} pStage
   * @param {Array<number>} pCanvas
   * @return {PendingTransform} new transform
   */
  mapPointToPoint (pStage, pCanvas) {
    let canvasNow = this.stage2canvas(pStage)
    let canvasDesired = pCanvas
    let newTranslate = [0,1].map(p => this.nTranslate[p] + canvasDesired[p] - canvasNow[p])
    return new PendingTransform(newTranslate, this.nScale, this.stage)
  }

  boundInContentBox () {
    let stage = this.stage
    let [tX, tY] = this.nTranslate
    if (this.nScale * stage.contentSize[0] <= stage.viewportSize[0]) {
      tX = stage.viewportSize[0] / 2 - (this.nScale * stage.contentSize[0] / 2)
    } else {
      tX = Math.min(0, tX)
      tX = Math.max(stage.viewportSize[0] - this.nScale * stage.contentSize[0], tX)
    }
    if (this.nScale * stage.contentSize[1] <= stage.viewportSize[1]) {
      tY = stage.viewportSize[1] / 2 - (this.nScale * stage.contentSize[1] / 2)
    } else {
      tY = Math.min(0, tY)
      tY = Math.max(stage.viewportSize[1] - this.nScale * stage.contentSize[1], tY)
    }
    return new PendingTransform([tX, tY], this.nScale, this.stage)
  }

  shift ([dx, dy]) {
    return new PendingTransform([this.nTranslate[0] + dx, this.nTranslate[1] + dy], this.nScale, this.stage)
  }
}

/**
 * An utility for dealing with dragging and pinch-zooming
 */
class TransformationStage {
  constructor () {
    // this.rotate = 0 // not implemented
    this.translate = [0, 0] // which canvas coordinate should the 0,0 point on stage maps to?
    this.scale = 1
    this.destroyed = false
    this.viewportSize = [0, 0]
    this.contentSize = [0, 0]
    this.currentAnimation = null

    this.pressState = null
    this.lastTapTime = null

    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
    this.handleWheel = this.handleWheel.bind(this)
    this.handleMouseWheel = this.handleMouseWheel.bind(this)

    this.eventTarget = null

    this.onUpdate = null
    this.onAfterUserInteration = null

    this.minScale = 0.2
    this.maxScale = 7
  }

  destroy () {
    this.destroyed = true
    if (this.eventTarget) {
      this.removeTouchEvents(this.eventTarget)
    }
  }

  /**
   * Map a coordinate on canvas into stage
   * @param {Array<number>} point
   * @return {Array<number>}
   */
  canvas2stage (point) {
    return [0,1].map(p => (point[p] - this.translate[p])/this.scale)
  }

  /**
   * Map a coordinate out of stage into the canvas space
   * @param {Array<number>} point
   * @return {Array<number>}
   */
  stage2canvas (point) {
    return [0,1].map(p => point[p]*this.scale + this.translate[p])
  }

  setViewportSize (w, h) {
    this.viewportSize = [w, h]
  }

  setContentSize (w, h) {
    this.contentSize = [w, h]
  }

  animationGetFinalState () {
    if (this.currentAnimation) {
      return new PendingTransform(this.currentAnimation.nTranslate, this.currentAnimation.nScale, this)
    } else {
      return new PendingTransform(this.translate, this.scale, this)
    }
  }

  /**
   * Return a transformation to the stage that will make a rectangle in the stage space be displayed at the center of the viewport.
   * @param {Array<number>} rect [x, y, w, h]
   * @return {undefined}
   */
  putOnCenter (rect) {
    let rectRatio = rect[2] / rect[3]
    let viewportRatio = this.viewportSize[0] / this.viewportSize[1]
    if (rectRatio < viewportRatio) {
      // space on left and right
      let scale = this.viewportSize[1] / rect[3]
      let x = this.viewportSize[0] / 2 - rect[2] * scale / 2
      return new PendingTransform([0, 0], scale, this).mapPointToPoint([rect[0], rect[1]], [x, 0])
    } else {
      // space on top and bottom
      let scale = this.viewportSize[0] / rect[2]
      let y = this.viewportSize[1] / 2 - rect[3] * scale / 2
      return new PendingTransform([0, 0], scale, this).mapPointToPoint([rect[0], rect[1]], [0, y])
    }
  }

  bindTouchEvents (element) {
    this.eventTarget = element
    let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
    element.addEventListener('mousedown', this.handleDown, noPassiveEventsArgument)
    element.addEventListener('touchstart', this.handleDown, noPassiveEventsArgument)
    element.addEventListener('touchmove', this.handleMove, noPassiveEventsArgument)
    element.addEventListener('touchend', this.handleUp, noPassiveEventsArgument)
    element.addEventListener('touchcancel', this.handleUp, noPassiveEventsArgument)
    element.addEventListener('wheel', this.handleWheel, noPassiveEventsArgument)
    element.addEventListener('mousewheel', this.handleMouseWheel, noPassiveEventsArgument)
  }

  removeTouchEvents (element) {
    element.removeEventListener('mousedown', this.handleDown)
    element.removeEventListener('touchstart', this.handleDown)
    element.removeEventListener('touchmove', this.handleMove)
    element.removeEventListener('touchend', this.handleUp)
    element.removeEventListener('touchcancel', this.handleUp)
    element.removeEventListener('wheel', this.handleWheel)
    element.removeEventListener('mousewheel', this.handleMouseWheel)
    document.removeEventListener('mousemove', this.handleMove)
    document.removeEventListener('mouseup', this.handleUp)
    this.eventTarget = null
  }

  handleMouseWheel (evt) {
    evt.preventDefault()
  }

  handleDown (evt) {
    document.removeEventListener('mousemove', this.handleMove)
    document.removeEventListener('mouseup', this.handleUp)
    if (this.moveEventFrame) {
      cancelAnimationFrame(this.moveEventFrame)
      this.moveEventFrame = null
    }
    if (this.currentAnimation) this.currentAnimation.stop()

    if (evt.touches) {
      evt.preventDefault()
      if (evt.touches.length === 1) {
        let t = evt.touches[0]
        if (this.lastTapTime !== null && Date.now() - this.lastTapTime < 500) {
          this.pressState = null
          this.lastTapTime = null
          this.handleDoubleTap([t.clientX, t.clientY])
          return
        }
        this.initMove(t)
        this.lastTapTime = Date.now()
      } else if (evt.touches.length === 2) {
        let [tA, tB] = evt.touches
        this.initPinch(tA, tB)
        this.lastTapTime = null
      } else {
        this.lastTapTime = null
      }
    }
  }

  initMove (t) {
    this.pressState = {
      mode: 'single-touch',
      touchId: t.identifier,
      stagePoint: this.canvas2stage(client2view([t.clientX, t.clientY], this.eventTarget)),
      startingClientPoint: [t.clientX, t.clientY],
      timestamp: Date.now()
    }
  }
  initPinch (tA, tB) {
    let stagePoint = this.canvas2stage(client2view([tA.clientX + tB.clientX, tA.clientY + tB.clientY].map(x => x / 2), this.eventTarget))
    this.pressState = {
      mode: 'double-touch',
      A: tA.identifier,
      B: tB.identifier,
      initialDistance: pointDistance([tA.clientX, tA.clientY], [tB.clientX, tB.clientY]),
      initialScale: this.scale,
      stagePoint
    }
  }

  handleMove (evt) {
    evt.preventDefault()
    if (!this.pressState) return
    this.lastTapTime = null
    if (!this.moveEventFrame) {
      this.moveEventFrame = requestAnimationFrame(() => {
        this.moveEventFrame = null
        if (evt.touches) {
          if (evt.touches.length === 1) {
            let t = evt.touches[0]
            if (this.pressState.mode === 'single-touch' && t.identifier === this.pressState.touchId) {
              new PendingTransform([0, 0], this.scale, this)
                .mapPointToPoint(this.pressState.stagePoint, client2view([t.clientX, t.clientY], this.eventTarget))
                .applyImmediate()
            } else {
              this.initMove(t)
              if (this.onAfterUserInteration) {
                this.onAfterUserInteration()
              }
            }
          } else if (evt.touches.length === 2) {
            if (this.pressState.mode !== 'double-touch') {
              let [tA, tB] = evt.touches
              this.initPinch(tA, tB)
              if (this.onAfterUserInteration) {
                this.onAfterUserInteration()
              }
            } else {
              let [tA, tB] = [this.pressState.A, this.pressState.B]
                              .map(id => Array.prototype.find.call(evt.touches, t => t.identifier === id))
              if (!tA || !tB) return
              let newDistance = pointDistance([tA.clientX, tA.clientY], [tB.clientX, tB.clientY])
              let newScale = this.pressState.initialScale * Math.pow(newDistance / this.pressState.initialDistance, 1.5)
              if (this.minScale && newScale < this.minScale) newScale = this.minScale
              let nCanvasMidpoint = client2view([tA.clientX + tB.clientX, tA.clientY + tB.clientY].map(x => x / 2), this.eventTarget)
              new PendingTransform([0, 0], newScale, this).mapPointToPoint(this.pressState.stagePoint, nCanvasMidpoint)
                  .applyImmediate()
            }
          }
        }
      })
    }
  }

  handleUp (evt) {
    evt.preventDefault()
    if (this.moveEventFrame) {
      cancelAnimationFrame(this.moveEventFrame)
      this.moveEventFrame = null
    }
    if (!this.pressState) return
    if (evt.touches.length === 0) {
      this.pressState = null
    } else if (evt.touches.length === 1) {
      this.initMove(evt.touches[0])
    }

    new PendingTransform(this.translate, this.scale, this).boundInContentBox().startAnimation()

    if (this.onAfterUserInteration) {
      this.onAfterUserInteration()
    }
  }

  handleDoubleTap (point) {
    let cPoint = client2view(point, this.eventTarget)
    let sPoint = this.canvas2stage(cPoint)
    let nScale = this.scale > 1 ? 0.9 : 2
    new PendingTransform([0, 0], nScale, this).mapPointToPoint(sPoint, cPoint).boundInContentBox().startAnimation(200)
    if (this.onAfterUserInteration) {
      this.onAfterUserInteration()
    }
  }

  handleWheel (evt) {
    function boundDelta (x) { return Math.max(-1, Math.min(1, x)) }
    evt.preventDefault()
    if (!evt.ctrlKey) {
      let dx = -boundDelta(evt.deltaX) * 80
      let dy = -boundDelta(evt.deltaY) * 80
      if (evt.shiftKey) {
        let t = dx
        dx = dy
        dy = t
      }
      this.animationGetFinalState().shift([dx, dy]).boundInContentBox().startAnimation(200)
    } else {
      let nScale = this.scale * Math.pow(1.5, -boundDelta(evt.deltaY))
      if (this.minScale) {
        nScale = Math.max(this.minScale, nScale)
      }
      if (this.maxScale) {
        nScale = Math.min(this.maxScale, nScale)
      }
      let cPoint = client2view([evt.clientX, evt.clientY], this.eventTarget)
      let sPoint = this.canvas2stage(cPoint)
      new PendingTransform([0, 0], nScale, this).mapPointToPoint(sPoint, cPoint).boundInContentBox().startAnimation(200)
    }

    if (this.handleWheel_userInteractionTimeout) {
      clearTimeout(this.handleWheel_userInteractionTimeout)
    }
    this.handleWheel_userInteractionTimeout = setTimeout(() => {
      this.handleWheel_userInteractionTimeout = null
      if (this.onAfterUserInteration) {
        this.onAfterUserInteration()
      }
    }, 100)
  }
}

class PDFJSViewer extends React.Component {
  static get NOT_READY () {return 0}
  constructor (props) {
    super(props)
    this.elem = null
    this.paintCanvas = null
    this.textLayersContain = null
    this.textLayers = []
    this.aframeMeasureSize = null
    this.viewDim = [0, 0]
    this.paintCanvas = null
    this.pdfjsDocument = null
    this.pages = null // [ManagedPage]
    this.readyState = PDFJSViewer.NOT_READY
    this.stage = new TransformationStage()

    this.measureViewDim = this.measureViewDim.bind(this)
    this.paint = this.paint.bind(this)
    this.deferredPaint = this.deferredPaint.bind(this)
  }

  componentDidMount () {
    if (!this.elem) throw new Error('this.elem is ' + this.elem)
    this.paintCanvas = document.createElement('canvas')
    this.elem.appendChild(this.paintCanvas)
    this.textLayersContain = document.createElement('div')
    this.textLayersContain.className = 'textlayercontain'
    this.elem.appendChild(this.textLayersContain)
    this.measureViewDim()
    this.startSizeMeasurementAFrame()
    this.stage.bindTouchEvents(this.textLayersContain)
    this.stage.onUpdate = this.deferredPaint.bind(this)
    this.stage.onAfterUserInteration = this.updatePages.bind(this)

    this.setDocument(this.props.doc)
  }

  componentDidUpdate () {
    this.setDocument(this.props.doc)
  }

  startSizeMeasurementAFrame () {
    if (this.aframeMeasureSize !== null) {
      cancelAnimationFrame(this.aframeMeasureSize)
      this.aframeMeasureSize = null
    }
    this.aframeMeasureSize = requestAnimationFrame(this.measureViewDim)
  }
  measureViewDim () {
    let cStyle = window.getComputedStyle(this.elem)
    let newDim = [parseInt(cStyle.width), parseInt(cStyle.height)]
    let oldDim = this.viewDim
    if (Math.abs(oldDim[0] - newDim[0]) >= 1 || Math.abs(oldDim[1] - newDim[1]) >= 1) {
      this.viewDim = newDim
      this.handleViewportSizeUpdate()
    }
    this.aframeMeasureSize = null
    this.startSizeMeasurementAFrame()
  }

  handleViewportSizeUpdate () {
    let [w, h] = this.viewDim
    this.paintCanvas.width = w
    this.paintCanvas.height = h
    let lastViewportSize = this.stage.viewportSize
    this.stage.setViewportSize(w, h)
    this.paint()
    let pendingTransform = this.stage.animationGetFinalState().boundInContentBox()
    if (lastViewportSize[0] < 1) {
      pendingTransform.applyImmediate()
    } else {
      pendingTransform.startAnimation(100)
    }
  }

  componentWillUnmount () {
    if (this.aframeMeasureSize !== null) {
      cancelAnimationFrame(this.aframeMeasureSize)
      this.aframeMeasureSize = null
    }
    this.setDocument(null)
    this.stage.removeTouchEvents(this.textLayersContain)
    this.stage.destroy()
    this.stage = null
    this.paintCanvas.width = this.paintCanvas.height = 0
    this.paintCanvas.remove()
    this.paintCanvas = null
  }

  render () {
    return (
      <div className='pdfjsviewer' ref={f => this.elem = f} />
    )
  }

  setDocument (doc) {
    if (this.pdfjsDocument === doc) return
    this.pdfjsDocument = doc
    if (this.pages) {
      for (let p of this.pages) {
        p.destroy()
      }
      delete this.pages
    }
    this.textLayersContain.innerHTML = ''
    this.textLayers = []
    this.pages = []
    if (doc) {
      this.initDocument()
    }
  }

  async initDocument () {
    let doc = this.pdfjsDocument
    let pages = this.pages
    for (let i = 0; i < doc.numPages; i ++) {
      if (this.pages !== pages) return
      let pdfjsPage = await doc.getPage(i + 1)
      if (this.pages !== pages) return
      pages[i] = new ManagedPage(pdfjsPage)
    }
    if (this.pages !== pages) return
    this.layoutDocument()
  }

  layoutDocument () {
    let pages = this.pages
    let maxW = 0
    for (let page of pages) {
      if (page.stageWidth > maxW) maxW = page.stageWidth
    }
    let cY = 0
    for (let page of pages) {
      page.stageOffset = [maxW / 2 - page.stageWidth / 2, cY]
      cY += page.stageHeight
    }
    this.stage.setContentSize(maxW, cY)
    this.initStagePosAndSize()
  }

  initStagePosAndSize () {
    let firstPage = this.pages[0]
    if (!firstPage) return
    this.stage.putOnCenter([firstPage.stageOffset[0], firstPage.stageOffset[1] - 10, firstPage.stageWidth, firstPage.stageHeight + 20])
                .applyImmediate()
    this.paint()
    this.updatePages()
  }

  paint () {
    let ctx = this.paintCanvas.getContext('2d')
    ctx.clearRect(0, 0, this.viewDim[0], this.viewDim[1])
    if (!this.pages) return
    let stage = this.stage
    for (let i = 0; i < this.pages.length; i ++) {
      let p = this.pages[i]
      if (!this.pageInView(p)) {
        if (this.textLayers[i]) {
          this.textLayers[i].remove()
          this.textLayers[i] = null
        }
        continue
      }
      let [x, y] = stage.stage2canvas(p.stageOffset)
      let scale = stage.scale
      let [w, h] = [p.stageWidth * scale, p.stageHeight * scale]
      if (!p.renderedCanvas) {
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.stroke()
        p.render(stage.scale).then(this.deferredPaint)
        if (this.textLayers[i]) {
          this.textLayers[i].remove()
          this.textLayers[i] = null
        }
      } else {
        let pCanvasScale = p.renderedCanvas.width / p.initWidth
        let [sx, sy, sw, sh] = p.clipRectangle.map(x => x * pCanvasScale)
        ctx.drawImage(p.renderedCanvas, sx, sy, sw, sh, x, y, w, h)
        if (p.textLayer) {
          if (this.textLayers[i] != p.textLayer) {
            if (this.textLayers[i]) {
              this.textLayers[i].remove()
            }
            this.textLayers[i] = p.textLayer
            this.textLayersContain.appendChild(p.textLayer)
          }
          let cssTScale = w / sw
          Object.assign(this.textLayers[i].style, {
            position: 'absolute',
            left: x + 'px',
            top: y + 'px',
            transformOrigin: 'top left',
            transform: 'scale(' + cssTScale + ')'
          })
        } else {
          if (this.textLayers[i]) {
            this.textLayers[i].remove()
            this.textLayers[i] = null
          }
        }
      }
    }
  }

  deferredPaint () {
    if (!this.paintAniFrame) {
      this.paintAniFrame = requestAnimationFrame(() => {
        this.paintAniFrame = null
        this.paint()
      })
    }
  }

  updatePages () {
    let stage = this.stage
    if (!this.pages) return
    let scale = stage.animationGetFinalState().nScale
    for (let p of this.pages) {
      if (this.pageInView(p)) {
        p.render(scale).then(this.deferredPaint)
      } else {
        p.freeCanvas()
      }
    }
  }

  pageInView (p) {
    let stage = this.stage
    let y1 = stage.stage2canvas(p.stageOffset)[1]
    let y2 = stage.stage2canvas([0, p.stageOffset[1] + p.stageHeight])[1]
    let yTop = 0
    let yBottom = stage.viewportSize[1]

    if (yTop > y2 || yBottom < y1) {
      return false
    } else {
      return true
    }
  }
}

class ManagedPage {
  constructor (pdfjsPage) {
    this.pdfjsPage = pdfjsPage
    this.unitViewport = pdfjsPage.getViewport(1)
    this.initWidth = this.unitViewport.width
    this.initHeight = this.unitViewport.height
    this.stageOffset = [0, 0]
    this.clipRectangle = [0, 0, this.initWidth, this.initHeight] // [x, y, w, h]
    this.renderedCanvas = null
    this.textContent = null
    this.textLayer = null
    this.renderedScale = null
    this.renderTask = null
    this.renderringScale = null
  }

  get stageWidth () {
    return this.clipRectangle[2]
  }
  get stageHeight () {
    return this.clipRectangle[3]
  }

  destroy () {
    this.pdfjsPage.cleanup()
    this.pdfjsPage = null
  }

  render (scale) {
    scale += 0.3 // gives better result
    if (scale > 10) scale = 10 // avoid excessive memory usage
    if (this.renderedScale && this.renderedCanvas && Math.abs(this.renderedScale - scale) < 0.00001) return Promise.resolve()
    if (this.renderringScale && Math.abs(this.renderringScale - scale) < 0.00001) return Promise.resolve()
    console.log('Rendering page ' + this.pdfjsPage.pageNumber)
    if (this.renderTask) {
      this.renderTask.cancel()
      this.renderTask = null
    }
    this.renderringScale = scale
    let nCanvas = document.createElement('canvas')
    let viewport = this.pdfjsPage.getViewport(scale)
    nCanvas.width = viewport.width
    nCanvas.height = viewport.height
    let ctx = nCanvas.getContext('2d', {alpha: false})
    let renderTask = this.pdfjsPage.render({
      enableWebGL: true,
      canvasContext: ctx,
      viewport,
      renderInteractiveForms: false
    })
    this.renderTask = renderTask
    return renderTask.then(() => {
      if (this.renderTask !== renderTask) {
        ctx = null
        nCanvas.width = nCanvas.height = 0
        nCanvas = null
        return Promise.resolve()
      }
      this.renderringScale = null
      this.renderedScale = scale
      this.renderedCanvas = nCanvas
      this.textContent = null
      this.textLayer = null
      return this.pdfjsPage.getTextContent({
        disableCombineTextItems: false
      }).then(tc => {
        if (this.renderTask !== renderTask) {
          return Promise.resolve()
        }
        this.textContent = tc
        if (window.pdfjsLib) {
          this.textLayer = document.createElement('div')
          let nViewport = viewport.clone()
          nViewport.offsetX = viewport.offsetX - this.clipRectangle[0] * scale
          nViewport.offsetY = viewport.offsetY - this.clipRectangle[1] * scale
          nViewport = nViewport.clone() // to recalculate transformation matrix and stuff
          pdfjsLib.renderTextLayer({
            textContent: tc,
            container: this.textLayer,
            viewport: nViewport,
            enhanceTextSelection: true,
          })
          this.textLayer.style.width = (this.clipRectangle[2] * scale) + 'px'
          this.textLayer.style.height = (this.clipRectangle[3] * scale) + 'px'
          this.textLayer.style.overflow = 'hidden'
        }
        return Promise.resolve()
      }, () => Promise.resolve())
    }, () => {})
  }

  freeCanvas () {
    this.renderringScale = this.renderedScale = null
    if (this.renderTask) {
      this.renderTask.cancel()
      this.renderTask = null
    }
    if (this.renderedCanvas) {
      console.log('Freeing cache for page ' + this.pdfjsPage.pageNumber)
      this.renderedCanvas.width = this.renderedCanvas.height = 0
      delete this.renderedCanvas
    }
    if (this.textLayer) {
      this.textLayer.innerHTML = ''
      this.textLayer.remove()
      this.textLayer = null
    }
    this.textContent = null
  }
}

module.exports = PaperViewer