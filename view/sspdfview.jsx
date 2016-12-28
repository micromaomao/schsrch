const React = require('react')

class SsPdfView extends React.Component {
  constructor () {
    super()
    this.state = {
      ctPos: [0, 0],
      ctSize: [0, 0],
      dragOrig: null,
      lastTapTime: 0,
    }
    this.ctAnimation = null
    this.lastViewWidth = this.lastViewHeight = this.viewWidth = this.viewHeight = 0
    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
    this.handleScroll = this.handleScroll.bind(this)
    this.ctAnimationId = 0
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
          onTouchEnd={this.handleUp}
          onTouchCancel={this.handleUp}
          onWheel={this.handleScroll} />
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
    if (evt.touches.length > 1 || this.state.dragOrig) {
      // TODO: Handle resize
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
    let touch = evt.changedTouches[0]
    this.setState({dragOrig: {
      touch: touch.identifier, x: touch.clientX, y: touch.clientY
    }})
  }
  handleMove (evt, prevent = true) {
    if (prevent) evt.preventDefault()
    let dragOrig = this.state.dragOrig
    if (!dragOrig) return
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
      let touchLeft = evt.changedTouches[0] || evt.touches[0]
      let nStat = this.ctAnimationGetFinalState()
      if (nStat.ctSize[0] > this.viewWidth * 5) {
        nStat = this.calcResizeOnPoint(this.client2view([touchLeft.clientX, touchLeft.clientY]), this.viewWidth * 5 / nStat.ctSize[0])
      } else if (nStat.ctSize[0] < this.viewWidth && nStat.ctSize[1] < this.viewHeight) {
        nStat = this.calcCenter()
      } else {
        nStat.ctPos = this.calcBound(nStat)
      }
      this.ctAnimationStartFromState(nStat)
      return
    }
    this.finishDrag()
    let touch = evt.changedTouches[0]
    if (isDoubleTap) {
      this.handleDoubleTap([touch.clientX, touch.clientY])
      return
    }
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
  handleScroll (evt) {
    if (evt.ctrlKey) {
      evt.preventDefault()
      let point = this.client2view([evt.clientX, evt.clientY])
      let nStat = this.calcResizeOnPoint(point, Math.pow(2, -evt.deltaY/100))
      if (nStat.ctSize[0] > this.viewWidth * 5) return
      if (nStat.ctSize[0] < this.viewWidth && nStat.ctSize[1] < this.viewHeight) {
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
    let [npX, npY] = [(-ctX + point[0]) * factor + ctX, (-ctY + point[1]) * factor + ctY]
    ctX = ctX - (npX - point[0])
    ctY = ctY - (npY - point[1])
    return {ctPos: [ctX, ctY], ctSize: this.ctAnimationGetFinalState().ctSize.map(x => x * factor)}
  }
  calcPointsResize (op0, op1, np0, np1) {
    // TODO: Better math
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
    this.componentDidUpdate({}, {})
  }
  componentDidUpdate (prevProps, prevState) {
    if (this.lastViewWidth !== this.viewWidth || this.lastViewHeight !== this.viewHeight) {
      this.lastViewWidth = this.viewWidth
      this.lastViewHeight = this.viewHeight
      this.reCenter()
    }
  }
  reCenter () {
    this.ctAnimationStartFromState(this.calcCenter())
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
  ctAnimationStart (nctPos, nctSize) {
    let aid = this.ctAnimationId++
    let animTime = 200
    if (this.ctAnimation) {
      cancelAnimationFrame(this.ctAnimation.frameId)
      this.ctAnimation = null
    }
    let [fromPos, fromSize] = ['ctPos', 'ctSize'].map(p => this.state[p])
    let fromTime = Date.now()
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
}

module.exports = SsPdfView
