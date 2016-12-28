const React = require('react')

class SsPdfView extends React.Component {
  constructor () {
    super()
    this.state = {
      ctPos: [0, 0],
      ctSize: [0, 0],
      dragOrig: null,
      lastTapTime: 0,
      ctAnimation: null
    }
    this.lastViewWidth = this.lastViewHeight = this.viewWidth = this.viewHeight = 0
    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
  }
  render () {
    let docJson = this.props.docJson
    if (!docJson) {
      return null
    }
    this.viewWidth = window.innerWidth
    this.viewHeight = Math.min(this.viewWidth * (docJson.height / docJson.width), window.innerHeight - 40)
    let svgData = 'data:image/svg+xml,' + encodeURIComponent(docJson.svg)
    svgData = svgData.replace(/\(/g, '%28').replace(/\)/g, '%29')
    let svgStyle = {
      backgroundImage: `url(${svgData})`,
      backgroundPosition: `${this.state.ctPos[0]}px ${this.state.ctPos[1]}px`,
      backgroundSize: `${this.state.ctSize[0]}px ${this.state.ctSize[1]}px`
    }
    // TODO: Resize by wheel and touch, drag to move
    return (
      <div className='sspdfview' style={{height: this.viewHeight + 'px'}}>
        <div className='svglayer' ref={f => this.svgLayer = f} style={svgStyle}
          onMouseDown={this.handleDown}
          onTouchStart={this.handleDown}
          onMouseMove={this.handleMove}
          onTouchMove={this.handleMove}
          onMouseUp={this.handleUp}
          onTouchEnd={this.handleUp} />
      </div>
    )
  }
  handleDown (evt) {
    evt.preventDefault()
    if (!evt.touches) {
      this.setState({dragOrig: {
        touch: null, x: evt.clientX, y: evt.clientY
      }})
      return
    }
    if (evt.touches.length !== 1 || this.state.dragOrig) {
      // TODO: Handle resize
      return
    }
    let touch = evt.changedTouches[0]
    this.setState({dragOrig: {
      touch: touch.identifier, x: touch.clientX, y: touch.clientY
    }})
  }
  handleMove (evt, prevent = true) {
    if (prevent) evt.preventDefault()
    let dragOrig = this.state.dragOrig
    if (!evt.touches && !evt.changedTouches) {
      if (!dragOrig) return
      let [dx, dy] = [evt.clientX - dragOrig.x, evt.clientY - dragOrig.y]
      let [odocX, odocY] = this.ctAnimationGetFinalState().ctPos
      this.setState({ctPos: [odocX + dx, odocY + dy], dragOrig: Object.assign({}, dragOrig, {x: evt.clientX, y: evt.clientY, touch: null})})
      return
    }
    if ((evt.touches.length !== 1 && !(evt.changedTouches.length === 1 && evt.touches.length === 0)) || !this.state.dragOrig) {
      // TODO: Handle resize
      return
    }
    let touch = evt.changedTouches[0]
    if (touch.identifier !== dragOrig.touch) {
      this.setState({dragOrig: null})
      return
    }
    let [dx, dy] = [touch.clientX - dragOrig.x, touch.clientY - dragOrig.y]
    let [odocX, odocY] = this.ctAnimationGetFinalState().ctPos
    this.setState({ctPos: [odocX + dx, odocY + dy], dragOrig: Object.assign({}, dragOrig, {x: touch.clientX, y: touch.clientY})})
  }
  handleUp (evt) {
    evt.preventDefault()
    this.handleMove(evt, false)

    let doubleTapTime = 300
    let isDoubleTap = Date.now() - this.state.lastTapTime < doubleTapTime
    this.setState({lastTapTime: Date.now()})
    if (!evt.touches && !evt.changedTouches) {
      if (isDoubleTap) {
        this.handleDoubleTap([evt.clientX, evt.clientY])
        return
      }
      this.finishDrag()
      return
    }
    if ((evt.changedTouches && evt.changedTouches.length !== 1) || (evt.touches && evt.touches.length !== 0) || !this.state.dragOrig) {
      // TODO: Handle resize
      return
    }
    let touch = evt.changedTouches[0]
    if (isDoubleTap) {
      this.handleDoubleTap([touch.clientX, touch.clientY])
      return
    }
    this.finishDrag()
  }
  finishDrag () {
    if (!this.state.dragOrig) return
    this.setState({dragOrig: null})
    this.ctAnimationStartFromState({ctPos: this.calcBound()})
  }
  handleDoubleTap (point) {
    this.setState({dragOrig: null})
    let currentFactor = this.calcFactorDoc()
    if (currentFactor >= 2) {
      this.ctAnimationStartFromState(this.calcCenter())
    } else {
      let rsState = this.calcResizeOnPoint(this.client2view(point), 2 / currentFactor)
      this.ctAnimationStartFromState({ctPos: this.calcBound(rsState), ctSize: rsState.ctSize})
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
    let [viWid, viHig] = [this.viewWidth, this.viewHeight]
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
  calcResizeOnPoint (point, factor) {
    let [ctX, ctY] = this.ctAnimationGetFinalState().ctPos
    let [npX, npY] = point.map(x => x * factor)
    ctX = ctX - (npX - point[0])
    ctY = ctY - (npY - point[1])
    return {ctPos: [ctX, ctY], ctSize: this.ctAnimationGetFinalState().ctSize.map(x => x * factor)}
  }
  calcFactorDoc () {
    if (!this.props || !this.props.docJson) return 1
    return this.ctAnimationGetFinalState().ctSize[0] / this.props.docJson.width
  }
  componentDidMount () {
    this.componentDidUpdate({}, {})
  }
  componentDidUpdate (prevProps, prevState) {
    if (this.lastViewWidth !== this.viewWidth || this.lastViewHeight !== this.viewHeight) {
      this.lastViewWidth = this.viewWidth
      this.lastViewHeight = this.viewHeight
      this.ctAnimationStopToState(this.calcCenter())
    }
  }
  calcCenter () {
    let [docWid, docHig] = ['width', 'height'].map(p => this.props.docJson[p])
    let [viWid, viHig] = [this.viewWidth, this.viewHeight]
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
    if (this.state.ctAnimation) {
      finalState = {ctPos: this.state.ctAnimation.nctPos, ctSize: this.state.ctAnimation.nctSize}
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
  ctAnimationStart (nctPos, nctSize) {
    let animTime = 200
    if (this.state.ctAnimation) {
      cancelAnimationFrame(this.state.ctAnimation.frameId)
      this.setState({ctAnimation: null})
    }
    let [fromPos, fromSize] = ['ctPos', 'ctSize'].map(p => this.state[p])
    let fromTime = Date.now()
    let doAnim = () => {
      let prog = (Date.now() - fromTime) / animTime
      if (prog >= 1) {
        this.setState({ctAnimation: null, ctPos: nctPos, ctSize: nctSize})
        return
      }
      let revProg = 1 - prog
      this.setState({
        ctPos: [0, 1].map(p => fromPos[p] * revProg + nctPos[p] * prog),
        ctSize: [0, 1].map(p => fromSize[p] * revProg + nctSize[p] * prog)
      })

      let frameId = requestAnimationFrame(doAnim)
      this.setState({ctAnimation: {
        frameId, nctPos, nctSize
      }})
    }
    doAnim()
  }
  ctAnimationStopTo (nctPos, nctSize) {
    if (this.state.ctAnimation) {
      cancelAnimationFrame(this.state.ctAnimation.frameId)
      this.setState({ctAnimation: null})
    }
    this.setState({ctPos: nctPos, ctSize: nctSize})
  }
}

module.exports = SsPdfView
