const React = require('react')

class SsPdfView extends React.Component {
  constructor () {
    super()
    this.state = {
      ctPos: [0, 0],
      ctSize: [0, 0],
      dragOrig: null,
      lastTapTime: 0,
      blobUrl: null,
      cacheCanvas: null
    }
    this.ctAnimation = null
    this.lastViewWidth = this.lastViewHeight = 0
    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
    this.handleScroll = this.handleScroll.bind(this)
    this.ctAnimationId = 0
    this.needPaintDirtyLayer = this.needClearDirtyLayer = false
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  render () {
    if (this.state.server) return null
    if (!this.props.width || !this.props.height) return null
    let docJson = this.props.docJson
    if (!docJson) {
      return null
    }
    let svgUrl = this.state.blobUrl
    if (this.state.cacheCanvas && (this.state.dragOrig || this.ctAnimation)) {
      this.needPaintDirtyLayer = true
    } else {
      this.needClearDirtyLayer = true
    }
    let svgStyle = {
      backgroundImage: svgUrl !== null ? `url(${svgUrl})` : null,
      display: (this.needPaintDirtyLayer ? 'none' : ''),
      backgroundPosition: `${this.state.ctPos[0]}px ${this.state.ctPos[1]}px`,
      backgroundSize: `${this.state.ctSize[0]}px ${this.state.ctSize[1]}px`
    }
    return (
      <div className='sspdfview' style={{width: this.props.width + 'px', height: this.props.height + 'px'}}>
        <div className='pointereventcover' ref={f => this.eventTarget = f}>
          {(this.props.overlay || []).map((item, i) => {
            let ltPoint = this.doc2view(item.lt)
            let rbPoint = this.doc2view(item.rb)
            let xBound = x => item.boundX ? Math.max(Math.min(x, this.props.width), 0) : x
            let yBound = y => item.boundY ? Math.max(Math.min(y, this.props.height), 0) : y
            return (
              <div className={item.className || ''} key={i} style={{
                position: 'absolute',
                left: xBound(ltPoint[0]) + 'px',
                top: yBound(ltPoint[1]) + 'px',
                right: (this.props.width - xBound(rbPoint[0])) + 'px',
                bottom: (this.props.height - yBound(rbPoint[1])) + 'px'
              }} onClick={item.onClick} onTouchEnd={item.onClick}>{item.stuff}</div>
            )
          })}
        </div>
        <div className='svglayer' ref={f => this.svgLayer = f} style={svgStyle} />
        <canvas className='dirtylayer' ref={f => this.dirtyLayer = f} width={this.props.width} height={this.props.height} />
      </div>
    )
  }
  handleDown (evt) {
    if (!evt.touches) {
      evt.preventDefault()
      this.setState({dragOrig: {
        touch: null, x: evt.clientX, y: evt.clientY
      }})
      return
    }
    if (evt.touches.length > 1) {
      evt.preventDefault()
      let t0 = evt.touches[0]
      let t1 = evt.touches[1]
      this.setState({lastTapTime: 0, dragOrig: {
        resize: true,
        pointA: {
          identifier: t0.identifier,
          point: this.client2view([t0.clientX, t0.clientY])
        },
        pointB: {
          identifier: t1.identifier,
          point: this.client2view([t1.clientX, t1.clientY])
        }
      }})
      return
    }
    if (this.isInitialSize()) {
      return
    }
    evt.preventDefault()
    let touch = evt.changedTouches[0]
    this.setState({dragOrig: {
      touch: touch.identifier, x: touch.clientX, y: touch.clientY
    }})
  }
  handleMove (evt, prevent = true) {
    let dragOrig = this.state.dragOrig
    if (!dragOrig) return
    if (prevent) evt.preventDefault()
    if (dragOrig.resize) {
      if (evt.touches.length !== 2) {
        this.setState({dragOrig: null})
        return
      }
      let [t0, t1] = ['A', 'B'].map(p => Array.prototype.find.call(evt.touches, t => t.identifier === dragOrig['point' + p].identifier))
      if (!t0 || !t1) {
        this.setState({dragOrig: null})
        return
      }
      let [op0, op1] = [dragOrig.pointA.point, dragOrig.pointB.point]
      let [np0, np1] = [t0, t1].map(t => this.client2view([t.clientX, t.clientY]))
      this.ctAnimationStopToState(this.calcPointsResize(op0, op1, np0, np1))
      this.setState({lastTapTime: 0, dragOrig: {
        resize: true,
        pointA: {
          identifier: t0.identifier,
          point: this.client2view([t0.clientX, t0.clientY])
        },
        pointB: {
          identifier: t1.identifier,
          point: this.client2view([t1.clientX, t1.clientY])
        }
      }})
      return
    }
    if (!evt.touches && !evt.changedTouches) {
      let [dx, dy] = [evt.clientX - dragOrig.x, evt.clientY - dragOrig.y]
      let [odocX, odocY] = this.ctAnimationGetFinalState().ctPos
      this.setState({dragOrig: Object.assign({}, dragOrig, {x: evt.clientX, y: evt.clientY, touch: null})})
      this.ctAnimationStopToState({ctPos: [odocX + dx, odocY + dy]})
      return
    }
    if ((evt.touches.length !== 1 && !(evt.changedTouches.length === 1 && evt.touches.length === 0)) || !dragOrig) {
      this.setState({dragOrig: null})
      return
    }
    let touch = evt.changedTouches[0]
    if (touch.identifier !== dragOrig.touch) {
      this.setState({dragOrig: null})
      return
    }
    let [dx, dy] = [touch.clientX - dragOrig.x, touch.clientY - dragOrig.y]
    let [odocX, odocY] = this.ctAnimationGetFinalState().ctPos
    this.setState({dragOrig: Object.assign({}, dragOrig, {x: touch.clientX, y: touch.clientY})})
    this.ctAnimationStopToState({ctPos: [odocX + dx, odocY + dy]})
  }
  handleUp (evt) {
    if (!evt.touches && !evt.changedTouches) {
      this.handleMove(evt, false)
      if (this.state.dragOrig) {
        evt.preventDefault()
      }
      this.finishDrag()
      return
    }
    let doubleTapTime = 300
    let isDoubleTap = Date.now() - this.state.lastTapTime < doubleTapTime
    if (this.state.dragOrig || isDoubleTap) {
      evt.preventDefault()
    }
    if (this.state.dragOrig && !this.state.dragOrig.resize) {
      this.handleMove(evt, false)
    }
    let notResize = !this.state.dragOrig || !this.state.dragOrig.resize
    if (!notResize || isDoubleTap) {
      this.setState({lastTapTime: 0})
    } else {
      this.setState({lastTapTime: Date.now()})
    }
    let touch = evt.changedTouches[0]
    if (this.state.dragOrig) {
      this.finishDrag()
    }
    if (notResize && isDoubleTap) {
      this.handleDoubleTap([touch.clientX, touch.clientY])
    }
  }
  finishDrag () {
    if (!this.state.dragOrig) return
    this.ctAnimationStartFromState({ctPos: this.calcBound()})

    // Limit resize (no too big, no too small)
    let nStat = this.ctAnimationGetFinalState()
    let resizeCenter = this.state.dragOrig.resize ? this.state.dragOrig.pointA.point : ['x', 'y'].map(p => this.state.dragOrig[p])
    if (nStat.ctSize[0] > this.props.width * 5) {
      nStat = this.calcResizeOnPoint(this.client2view(resizeCenter), this.props.width * 5 / nStat.ctSize[0])
    } else if (nStat.ctSize[0] < this.props.width && nStat.ctSize[1] < this.props.height) {
      nStat = this.calcCenter()
    } else {
      nStat.ctPos = this.calcBound(nStat)
    }
    this.ctAnimationStartFromState(nStat)

    this.setState({dragOrig: null})
  }
  handleDoubleTap (point) {
    this.setState({dragOrig: null})
    if (!this.isInitialSize()) {
      this.ctAnimationStartFromState(this.calcCenter())
    } else {
      let rsState = this.calcResizeOnPoint(this.client2view(point), 1.5 / this.calcFactorDoc())
      this.ctAnimationStartFromState({ctPos: this.calcBound(rsState), ctSize: rsState.ctSize})
    }
  }
  handleScroll (evt) {
    if (evt.ctrlKey) {
      evt.preventDefault()
      let point = this.client2view([evt.clientX, evt.clientY])
      let nStat = this.calcResizeOnPoint(point, Math.pow(2, -Math.sign(evt.deltaY) * 0.3))
      if (nStat.ctSize[0] > this.props.width * 5) return
      if (nStat.ctSize[0] < this.props.width && nStat.ctSize[1] < this.props.height) {
        nStat = this.calcCenter()
      } else {
        nStat.ctPos = this.calcBound(nStat)
      }
      this.ctAnimationStartFromState(nStat)
    }
  }
  client2view (point) {
    let rect = this.svgLayer.getBoundingClientRect()
    var supportPageOffset = window.pageXOffset !== undefined;
    var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");
    var scrollX = supportPageOffset ? window.pageXOffset : isCSS1Compat ? document.documentElement.scrollLeft : document.body.scrollLeft;
    var scrollY = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;
    return [point[0] - (rect.left + scrollX), point[1] - (rect.top + scrollY)]
  }
  calcBound (viewState = this.ctAnimationGetFinalState()) {
    let [viWid, viHig] = [this.props.width, this.props.height]
    let [ctX, ctY] = viewState.ctPos
    let [ctWid, ctHig] = viewState.ctSize
    if (ctWid < viWid) {
      ctX = (viWid - ctWid) / 2
    } else {
      ctX = Math.min(ctX, 0)
      ctX = Math.max(viWid - ctWid, ctX)
    }
    if (ctHig < viHig) {
      ctY = (viHig - ctHig) / 2
    } else {
      ctY = Math.min(ctY, 0)
      ctY = Math.max(viHig - ctHig, ctY)
    }
    return [ctX, ctY]
  }
  isInitialSize (viewState = this.ctAnimationGetFinalState()) {
    let [viWid, viHig] = [this.props.width, this.props.height]
    let [ctWid, ctHig] = viewState.ctSize
    return viWid >= ctWid && viHig >= ctHig
  }
  calcResizeOnPoint (point, factor) {
    let [ctX, ctY] = this.ctAnimationGetFinalState().ctPos
    let [npX, npY] = [(-ctX + point[0]) * factor + ctX, (-ctY + point[1]) * factor + ctY]
    ctX = ctX - (npX - point[0])
    ctY = ctY - (npY - point[1])
    return {ctPos: [ctX, ctY], ctSize: this.ctAnimationGetFinalState().ctSize.map(x => x * factor)}
  }
  calcPointsResize (op0, op1, np0, np1) {
    let [sr0, sr1] = [[np0, np1], [op0, op1]].map(([[x0, y0], [x1, y1]]) => Math.sqrt(Math.pow(x0 - x1, 2) + Math.pow(y0 - y1, 2)))
    if (sr0 === 0 || sr1 === 0) {
      throw new Error('Messy points.')
    }
    let fact = sr0 / sr1
    return this.calcResizeOnPoint([0, 1].map(p => (np0[p] + np1[p]) / 2), fact)
  }
  calcFactorDoc (state = this.ctAnimationGetFinalState()) {
    if (!this.props || !this.props.docJson) return 1
    return state.ctSize[0] / this.props.docJson.width
  }
  componentDidMount () {
    if (this.props.docJson) {
      this.processDoc(this.props.docJson)
    }
    this.componentDidUpdate({}, {})
  }
  componentDidUpdate (prevProps, prevState) {
    if (this.lastViewWidth !== this.props.width || this.lastViewHeight !== this.props.height) {
      this.lastViewWidth = this.props.width
      this.lastViewHeight = this.props.height
      this.reCenter()
    }
    if (!this.dirtyLayer) return
    let ctx = this.dirtyLayer.getContext('2d')
    if (this.needPaintDirtyLayer) {
      this.needPaintDirtyLayer = false
      let [dx, dy] = this.state.ctPos
      let [dw, dh] = this.state.ctSize
      ctx.clearRect(0, 0, this.dirtyLayer.width, this.dirtyLayer.height)
      ctx.drawImage(this.state.cacheCanvas, dx, dy, dw, dh)
    } else if (this.needClearDirtyLayer) {
      this.needClearDirtyLayer = false
      ctx.clearRect(0, 0, this.dirtyLayer.width, this.dirtyLayer.height)
    }
    const etAttr = 'data-event-bind'
    let et = this.eventTarget
    if (et.getAttribute(etAttr) !== 'true') {
      et.setAttribute(etAttr, 'true')
      let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
      et.addEventListener('mousedown', this.handleDown, noPassiveEventsArgument)
      et.addEventListener('touchstart', this.handleDown, noPassiveEventsArgument)
      et.addEventListener('mousemove', this.handleMove, noPassiveEventsArgument)
      et.addEventListener('touchmove', this.handleMove, noPassiveEventsArgument)
      et.addEventListener('mouseup', this.handleUp, noPassiveEventsArgument)
      et.addEventListener('touchend', this.handleUp, noPassiveEventsArgument)
      et.addEventListener('touchcancel', this.handleUp, noPassiveEventsArgument)
      et.addEventListener('wheel', this.handleScroll, noPassiveEventsArgument)
      et.addEventListener('mousewheel', this.handleScroll, noPassiveEventsArgument)
    }
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.docJson && (!this.props.docJson || this.props.docJson.svg !== nextProps.docJson.svg)) {
      this.processDoc(nextProps.docJson)
    }
  }
  processDoc ({svg, width, height}) {
    const sf = 3
    let oldUrl = this.state.blobUrl
    let blob = new Blob([svg], {type: 'image/svg+xml'})
    let blobUrl = URL.createObjectURL(blob)
    this.setState({blobUrl: blobUrl})
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl)
    }
    let canvas = document.createElement('canvas')
    canvas.width = width * sf
    canvas.height = height * sf
    let ctx = canvas.getContext('2d')
    let img = document.createElement('img')
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width * sf, height * sf)
      this.setState({cacheCanvas: canvas})
    }
    img.src = blobUrl
  }
  reCenter () {
    this.ctAnimationStartFromState(this.calcCenter())
  }
  calcCenter () {
    let [docWid, docHig] = ['width', 'height'].map(p => this.props.docJson[p])
    let [viWid, viHig] = [this.props.width, this.props.height]
    let [sfX, sfY] = [viWid / docWid, viHig / docHig]
    let sfM = Math.min(sfX, sfY)
    let ndocSiz = [docWid * sfM, docHig * sfM]
    let ndocPos = [0, 0]
    if (sfM === sfX) {
      ndocPos[1] = viHig - ndocSiz[1]
    } else {
      ndocPos[0] = viWid - ndocSiz[0]
    }
    ndocPos = ndocPos.map(x => x / 2)
    return {ctPos: ndocPos, ctSize: ndocSiz}
  }
  ctAnimationGetFinalState () {
    let finalState = this.state
    if (this.ctAnimation) {
      finalState = {ctPos: this.ctAnimation.nctPos, ctSize: this.ctAnimation.nctSize}
    }
    return finalState
  }
  ctAnimationStartFromState (nStat) {
    nStat = Object.assign({}, this.ctAnimationGetFinalState(), nStat)
    this.ctAnimationStart(nStat.ctPos, nStat.ctSize)
  }
  ctAnimationStopToState (nStat) {
    nStat = Object.assign({}, this.ctAnimationGetFinalState(), nStat)
    this.ctAnimationStopTo(nStat.ctPos, nStat.ctSize)
  }
  stateSimillar (ctA, ctB) {
    let {ctPos: posA, ctSize: sizeA} = ctA
    let {ctPos: posB, ctSize: sizeB} = ctB
    const threshold = 1
    for (let i = 0; i < 2; i ++) {
      if (Math.abs(posA[i] - posB[i]) > threshold) return false
      if (Math.abs(sizeA[i] - sizeB[i]) > threshold) return false
    }
    return true
  }
  ctAnimationStart (nctPos, nctSize) {
    let aid = this.ctAnimationId++
    let animTime = 200
    if (this.ctAnimation) {
      cancelAnimationFrame(this.ctAnimation.frameId)
      this.ctAnimation = null
    }
    let {ctPos: fromPos, ctSize: fromSize} = this.state
    let fromTime = Date.now()
    let nct = {ctPos: nctPos, ctSize: nctSize}
    if (this.stateSimillar(nct, this.state)) {
      this.setState(nct)
      return
    }
    let doAnim = () => {
      if (!this.ctAnimation || this.ctAnimation.aid !== aid) return
      let prog = Math.max(Date.now() - fromTime, 20) / animTime
      if (prog >= 1) {
        this.ctAnimation = null
        this.setState({ctPos: nctPos, ctSize: nctSize})
        return
      }
      let revProg = 1 - prog
      this.setState({
        ctPos: [0, 1].map(p => fromPos[p] * revProg + nctPos[p] * prog),
        ctSize: [0, 1].map(p => fromSize[p] * revProg + nctSize[p] * prog)
      })

      let frameId = requestAnimationFrame(doAnim)
      this.ctAnimation = {
        frameId, nctPos, nctSize, aid
      }
    }
    this.ctAnimation = {
      frameId: 0, nctPos, nctSize, aid
    }
    doAnim()
  }
  ctAnimationStopTo (nctPos, nctSize) {
    if (this.ctAnimation) {
      cancelAnimationFrame(this.ctAnimation.frameId)
      this.ctAnimation = null
    }
    this.setState({ctPos: nctPos, ctSize: nctSize})
  }
  doc2view ([x, y]) {
    if (x === -Infinity) return [0, this.doc2view([0, y])[1]]
    if (x === Infinity) return [this.props.width, this.doc2view([0, y])[1]]
    let [docWid, docHig] = ['width', 'height'].map(p => this.props.docJson[p])
    return [(x / docWid) * this.state.ctSize[0] + this.state.ctPos[0],
            (y / docHig) * this.state.ctSize[1] + this.state.ctPos[1]]
  }
  view2doc ([x, y]) {
    let [docWid, docHig] = ['width', 'height'].map(p => this.props.docJson[p])
    return [((x - this.state.ctPos[0]) / this.state.ctSize[0]) * docWid,
            ((y - this.state.ctPos[1]) / this.state.ctSize[1]) * docHig]
  }
}

module.exports = SsPdfView
