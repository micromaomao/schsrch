const React = require('react')
const rbush = require('rbush')
const copyStuff = require('./copystuff.js')

const delayEvent = function (handler, prevent = true) {
  return evt => {
    if (prevent) {
      evt.preventDefault()
    }
    setTimeout(() => {
      // By this time the event handlers for children, which is called by
      // React, has completed. Let's call this

      // NOTE: by this time the handlers for the parents, which is called by
      // React, has also been called. But this isn't an issue yet.
      handler(evt, false)
    }, 0)
  }
  /*
    Since React handles all events at the topest level, some events need to be
    addEventListener'd manually (i.e. not by using React's on props). This means
    that if a child of the addEventListener'd element triggered a event that
    propagates, e.g. touchstart, and the child uses React's event props, event
    handler for the parent element (the element that is being addEventListener'd),
    which should have been the handler that's being passed into this function, will
    be called first - before handler for the child is called. This violates the
    rules of event handling. Therefore, this function is intended to fix it.
  */
}
const etAttr = 'data-event-bind'

const RectSort = (rect1, rect2) => {
  let s1 = rect1.minY - rect2.minY
  if (Math.abs(s1) > 10) {
    return Math.sign(s1)
  }
  return Math.sign(rect1.minX - rect2.minX)
}

class SsPdfView extends React.Component {
  constructor (props) {
    super(props)
    this.md = Math.floor(Math.random() * 1000)
    this.state = {
      ctPos: [0, 0],
      ctSize: [0, 0],
      dragOrig: null,
      lastTapTime: 0,
      blobUrl: null,
      cacheCanvas: null, // will be set as a cached image of the document svg on `processDoc`
      cropDragState: null,
      touchClickValidIdentifier: null,
      clickValid: false,
      pressTime: null,
      longPressDetectionTimeout: null,
      textSelection: null,
      textSelectionTouchId: null,
      textSelectionPressing: false
    }
    this.ctAnimation = null
    this.mounted = false
    this.lastViewWidth = this.lastViewHeight = 0
    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
    this.handleScroll = this.handleScroll.bind(this)
    this.handleCropDown = this.handleCropDown.bind(this)
    this.handleCropMove = this.handleCropMove.bind(this)
    this.handleCropUp = this.handleCropUp.bind(this)
    this.longPressDetect = this.longPressDetect.bind(this)
    this.ctAnimationId = 0
    this.needPaintDirtyLayer = this.needClearDirtyLayer = false // set by `render`: indicating whether to paint/clear the canvas once react rendered it.
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
    this.rbush = rbush(14)
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
      visibility: (this.needPaintDirtyLayer ? 'hidden' : 'visible'),
      backgroundPosition: (this.needPaintDirtyLayer ? '0 0' : `${this.state.ctPos[0]}px ${this.state.ctPos[1]}px`),
      backgroundSize: (this.needPaintDirtyLayer ? '0 0' : `${this.state.ctSize[0]}px ${this.state.ctSize[1]}px`)
    }
    let overlays = this.props.overlay || []
    overlays = overlays.concat(this.getWordOverlay())
    let cropOverlay = null
    let cropMask = null
    if (this.props.cropBoundary) {
      let [x1, y1, x2, y2] = this.props.cropBoundary
      let lt = this.doc2view([x1, y1])
      let rb = this.doc2view([x2, y2])
      const markerSize = 40
      const maskLineStroke = 1
      cropOverlay = (
          <div className='cropoverlay' ref={f => this.cropOverlay = f}>
            <div className='lt'
              style={{
                left: (lt[0] - markerSize) + 'px',
                top: (lt[1] - markerSize) + 'px'
              }} />
            <div className='t'
              style={{
                left: lt[0] + 'px',
                top: (lt[1] - markerSize) + 'px',
                width: (rb[0] - lt[0]) + 'px'
              }} />
            <div className='rt'
              style={{
                left: rb[0] + 'px',
                top: (lt[1] - markerSize) + 'px'
              }} />
            <div className='r'
              style={{
                left: rb[0] + 'px',
                top: lt[1] + 'px',
                height: (rb[1] - lt[1]) + 'px'
              }} />
            <div className='rb'
              style={{
                left: rb[0] + 'px',
                top: rb[1] + 'px'
              }} />
            <div className='b'
              style={{
                left: lt[0] + 'px',
                top: rb[1] + 'px',
                width: (rb[0] - lt[0]) + 'px'
              }} />
            <div className='lb'
              style={{
                left: (lt[0] - markerSize) + 'px',
                top: rb[1] + 'px'
              }} />
            <div className='l'
              style={{
                left: (lt[0] - markerSize) + 'px',
                top: lt[1] + 'px',
                height: (rb[1] - lt[1]) + 'px'
              }} />
          </div>
        )
        cropMask = (
          <div className='cropmask'>
            <div style={{
              top: '0',
              left: '0',
              width: Math.max(lt[0] - maskLineStroke, 0) + 'px',
              height: Math.max(lt[1] - maskLineStroke, 0) + 'px'
            }} />
            <div style={{
              top: '0',
              left: lt[0] + 'px',
              width: Math.max(rb[0] - lt[0], 0) + 'px',
              height: Math.max(lt[1] - maskLineStroke, 0) + 'px'
            }} />
            <div style={{
              top: '0',
              left: (rb[0] + maskLineStroke) + 'px',
              right: 0,
              height: Math.max(lt[1] - maskLineStroke, 0) + 'px'
            }} />
            <div style={{
              top: lt[1] + 'px',
              left: (rb[0] + maskLineStroke) + 'px',
              height: Math.max(rb[1] - lt[1], 0) + 'px',
              right: 0
            }} />
            <div style={{
              left: (rb[0] + maskLineStroke) + 'px',
              top: (rb[1] + maskLineStroke) + 'px',
              right: 0,
              bottom: 0
            }} />
            <div style={{
              left: lt[0] + 'px',
              top: (rb[1] + maskLineStroke) + 'px',
              width: Math.max(rb[0] - lt[0], 0) + 'px',
              bottom: 0
            }} />
            <div style={{
              left: 0,
              width: Math.max(lt[0] - maskLineStroke, 0) + 'px',
              top: (rb[1] + maskLineStroke) + 'px',
              bottom: 0
            }} />
            <div style={{
              left: 0,
              width: Math.max(lt[0] - maskLineStroke, 0) + 'px',
              top: lt[1] + 'px',
              height: Math.max(rb[1] - lt[1], 0) + 'px'
            }} />
          </div>
        )
    }
    return (
      <div className={'sspdfview' + (this.state.textSelection ? ' textsel' : '')} style={{width: this.props.width + 'px', height: this.props.height + 'px'}}>
        <div className='pointereventcover' ref={f => this.eventTarget = f}>
          {overlays.map((item, i) => {
            let ltPoint = this.doc2view(item.lt)
            let rbPoint = this.doc2view(item.rb)
            let xBound = x => item.boundX ? Math.max(Math.min(x, this.props.width), 0) : x
            let yBound = y => item.boundY ? Math.max(Math.min(y, this.props.height), 0) : y
            let handleClickTap = evt => {
              if (this.isClickOrTap(evt) && item.onClick) item.onClick(evt)
            }
            return (
              <div className={item.className || ''} key={i} style={{
                position: 'absolute',
                left: xBound(ltPoint[0]) + 'px',
                top: yBound(ltPoint[1]) + 'px',
                right: (this.props.width - xBound(rbPoint[0])) + 'px',
                bottom: (this.props.height - yBound(rbPoint[1])) + 'px'
              }} onMouseUp={handleClickTap} onTouchEnd={handleClickTap}>{item.stuff}</div>
            )
          })}
          {cropOverlay}
          {cropMask}
        </div>
        <div className='svglayer' ref={f => this.svgLayer = f} style={svgStyle} />
        <canvas className='dirtylayer' ref={f => this.dirtyLayer = f} width={this.props.width} height={this.props.height} />
      </div>
    )
  }

  handleDown (evt) {
    document.removeEventListener('mousemove', this.handleMove)
    document.removeEventListener('mouseup', this.handleUp)
    if (!this.svgLayer) return
    if (this.state.cropDragState) return
    this.setState({
      textSelectionTouchId: null
    })
    if (this.props.onDragState) this.props.onDragState(true)
    if (!evt.touches) {
      let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
      document.addEventListener('mousemove', this.handleMove, noPassiveEventsArgument)
      document.addEventListener('mouseup', this.handleUp, noPassiveEventsArgument)
      let [ncx, ncy] = this.client2view([evt.clientX, evt.clientY])
      this.setState({dragOrig: {
        touch: null, x: ncx, y: ncy
      }, clickValid: true, pressTime: Date.now(), longPressDetectionTimeout: setTimeout(this.longPressDetect, 500)})
      return
    }
    if (evt.touches.length > 1) {
      this.setState({touchClickValidIdentifier: null, pressTime: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
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
    this.setState({pressTime: Date.now()})
    if (evt.touches.length === 1) {
      this.setState({touchClickValidIdentifier: evt.touches[0].identifier})
      this.setState({longPressDetectionTimeout: setTimeout(this.longPressDetect, 500)})
    } else {
      this.setState({touchClickValidIdentifier: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
    }
    if (this.isInitialSize()) {
      return
    }
    let touch = evt.changedTouches[0]
    let [ncx, ncy] = this.client2view([touch.clientX, touch.clientY])
    this.setState({dragOrig: {
      touch: touch.identifier, x: ncx, y: ncy
    }})
  }
  longPressDetect () {
    if (!this.state.clickValid && this.state.touchClickValidIdentifier === null || !this.state.dragOrig || this.state.pressTime === null) return
    if (this.state.pressTime > 500) {
      this.handleLongPress()
    } else {
      this.setState({longPressDetectionTimeout: setTimeout(this.longPressDetect, 500 - this.state.pressTime)})
    }
  }
  handleMove (evt, prevent = true) {
    if (!this.svgLayer) {
      this.setState({clickValid: false, touchClickValidIdentifier: null, pressTime: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
      return
    }
    let dragOrig = this.state.dragOrig
    if (!dragOrig) {
      this.handleMove2(evt)
      return
    }
    if (prevent) evt.preventDefault()
    if (dragOrig.resize) {
      this.setState({touchClickValidIdentifier: null, pressTime: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
      if (evt.touches.length !== 2) {
        this.setState({dragOrig: null})
        return
      }

      // Find respective touch points for dragOrig.pointA and dragOrig.pointB
      let [tA, tB] = ['A', 'B'].map(p => Array.prototype.find.call(evt.touches, t => t.identifier === dragOrig['point' + p].identifier))

      if (!tA || !tB) {
        this.setState({dragOrig: null})
        return
      }

      // Points on last handleMove
      let [opA, opB] = [dragOrig.pointA.point, dragOrig.pointB.point]
      // New points
      let [npA, npB] = [tA, tB].map(t => this.client2view([t.clientX, t.clientY]))

      this.ctAnimationStopToState(this.calcPointsResize(opA, opB, npA, npB))
      this.setState({lastTapTime: 0, dragOrig: {
        resize: true,
        pointA: {
          identifier: tA.identifier,
          point: this.client2view([tA.clientX, tA.clientY])
        },
        pointB: {
          identifier: tB.identifier,
          point: this.client2view([tB.clientX, tB.clientY])
        }
      }})
      return
    }
    if (!evt.touches && !evt.changedTouches) {
      let [ncx, ncy] = this.client2view([evt.clientX, evt.clientY])
      let [dx, dy] = [ncx - dragOrig.x, ncy - dragOrig.y]
      if (Math.pow(dx, 2) + Math.pow(dy, 2) > 4) {
        this.setState({clickValid: false})
        if (this.state.longPressDetectionTimeout) {
          clearTimeout(this.state.longPressDetectionTimeout)
          this.setState({longPressDetectionTimeout: null})
        }
      }
      let [odocX, odocY] = this.ctAnimationGetFinalState().ctPos
      this.setState({dragOrig: Object.assign({}, dragOrig, {x: ncx, y: ncy, touch: null})})
      this.ctAnimationStopToState({ctPos: [odocX + dx, odocY + dy]})
      return
    }
    if ((evt.touches.length !== 1 && !(evt.changedTouches.length === 1 && evt.touches.length === 0)) || !dragOrig) {
      this.setState({dragOrig: null})
      this.setState({touchClickValidIdentifier: null, pressTime: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
      return
    }
    let touch = evt.changedTouches[0]
    if (touch.identifier !== dragOrig.touch) {
      this.setState({dragOrig: null})
      this.setState({touchClickValidIdentifier: null, pressTime: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
      return
    }
    let [ncx, ncy] = this.client2view([touch.clientX, touch.clientY])
    let [dx, dy] = [ncx - dragOrig.x, ncy - dragOrig.y]
    if (Math.pow(dx, 2) + Math.pow(dy, 2) > 4) {
      this.setState({touchClickValidIdentifier: null, pressTime: null})
      if (this.state.longPressDetectionTimeout) {
        clearTimeout(this.state.longPressDetectionTimeout)
        this.setState({longPressDetectionTimeout: null})
      }
    }
    let [odocX, odocY] = this.ctAnimationGetFinalState().ctPos
    this.setState({dragOrig: Object.assign({}, dragOrig, {x: ncx, y: ncy})})
    this.ctAnimationStopToState({ctPos: [odocX + dx, odocY + dy]})
  }
  handleMove2 (evt, prevent = true) {
    if (this.state.textSelection === null || !this.state.textSelectionPressing) return
    let mergeArea = point => {
      let ts = this.state.textSelection
      this.setState({
        textSelection: [ts[0], ts[1], point[0], point[1]]
      })
    }
    if (!evt.touches) {
      mergeArea(this.view2doc(this.client2view([evt.clientX, evt.clientY])))
    } else {
      if (evt.touches.length !== 1 || evt.touches[0].identifier !== this.state.textSelectionTouchId) {
        this.setState({
          textSelection: null,
          textSelectionTouchId: null
        })
      } else {
        let t = evt.touches[0]
        mergeArea(this.view2doc(this.client2view([t.clientX, t.clientY])))
      }
    }
  }
  handleUp (evt) {
    if (this.state.longPressDetectionTimeout) {
      clearTimeout(this.state.longPressDetectionTimeout)
      this.setState({longPressDetectionTimeout: null})
    }
    if (!this.svgLayer) return
    this.setState({
      textSelectionTouchId: null,
      textSelectionPressing: false
    })
    if (this.isClickOrTap(evt)) {
      this.setState({
        textSelection: null
      })
    }
    if (!evt.touches && !evt.changedTouches) {
      document.removeEventListener('mousemove', this.handleMove)
      document.removeEventListener('mouseup', this.handleUp)
      this.handleMove(evt, false)
      this.finishDrag()
      return
    }
    let doubleTapTime = 300
    let isDoubleTap = Date.now() - this.state.lastTapTime < doubleTapTime
    if (this.state.dragOrig && !this.state.dragOrig.resize) {
      this.handleMove(evt, false)
    }
    let touch = evt.changedTouches[0] || evt.touches[0]
    if (!this.isClickOrTap(evt)) {
      this.setState({lastTapTime: 0})
    } else {
      let notResize = !this.state.dragOrig || !this.state.dragOrig.resize
      if (!notResize || isDoubleTap) {
        this.setState({lastTapTime: 0})
      } else {
        this.setState({lastTapTime: Date.now()})
      }
      if (notResize && isDoubleTap) {
        this.handleDoubleTap(this.client2view([touch.clientX, touch.clientY]))
      }
    }
    if (this.state.dragOrig) {
      this.finishDrag()
    }
  }
  isSingleTouch (evt) {
    if (!evt.touches && !evt.changedTouches) return false
    if ((!evt.touches || evt.touches.length === 0) && evt.changedTouches.length !== 1) return false
    if (evt.touches.length === 1 && evt.changedTouches.length > 1) return false
    if (evt.touches.length > 1) return false
    if ((!evt.touches || evt.touches.length === 0) && evt.changedTouches.length === 1) return this.state.touchClickValidIdentifier === evt.changedTouches[0].identifier
    if (evt.touches && evt.touches.length === 1) return this.state.touchClickValidIdentifier === evt.touches[0].identifier
    return false
  }
  isLongPress (evt) {
    if (this.pressTime === null) return
    if (evt.touches || evt.changedTouches) {
      if (!this.isSingleTouch(evt)) return false
      return Date.now() - this.state.pressTime > 500
    } else {
      return this.state.clickValid && (Date.now() - this.state.pressTime > 500)
    }
  }
  isClickOrTap (evt) {
    if (this.pressTime === null) return
    if (evt.touches || evt.changedTouches) {
      if (!this.isSingleTouch(evt)) return false
      return Date.now() - this.state.pressTime <= 500
    } else {
      return this.state.clickValid && (Date.now() - this.state.pressTime <= 500)
    }
  }
  finishDrag () {
    if (!this.svgLayer) return
    if (!this.state.dragOrig) return

    if (this.props.fixedBoundary) {
      this.ctAnimationStartFromState(this.calcFixedBoundary())
    } else {
      this.ctAnimationStartFromState({ctPos: this.calcBound()})

      // Limit resize (no too big, no too small)
      let nStat = this.ctAnimationGetFinalState()
      let abAverage = null
      if (this.state.dragOrig.resize) {
        abAverage = [0, 1].map(p => (this.state.dragOrig.pointA.point[p] + this.state.dragOrig.pointB.point[p]) / 2)
      }
      let resizeCenter = abAverage ? abAverage : ['x', 'y'].map(p => this.state.dragOrig[p])
      if (nStat.ctSize[0] > this.props.width * 5) {
        nStat = this.calcResizeOnPoint(resizeCenter, this.props.width * 5 / nStat.ctSize[0])
      } else if (nStat.ctSize[0] < this.props.width && nStat.ctSize[1] < this.props.height) {
        nStat = this.calcCenter()
      } else {
        nStat.ctPos = this.calcBound(nStat)
      }
      this.ctAnimationStartFromState(nStat)
    }
    this.setState({dragOrig: null})
    if (this.props.onDragState) this.props.onDragState(false)
  }
  handleDoubleTap (point) {
    if (!this.svgLayer) return
    this.setState({dragOrig: null})
    if (!this.isInitialSize()) {
      this.ctAnimationStartFromState(this.calcCenter())
    } else {
      let rsState = this.calcResizeOnPoint(point, 1.5 / this.calcFactorDoc())
      this.ctAnimationStartFromState({ctPos: this.calcBound(rsState), ctSize: rsState.ctSize})
    }
  }
  handleLongPress () {
    if (!this.rbush) return
    let { x: cx, y: cy } = this.state.dragOrig
    let [docX, docY] = this.view2doc([cx, cy])
    if (this.props.onCropBoundaryChange) {
      this.props.onCropBoundaryChange(null)
    }
    this.setState({
      textSelection: [docX, docY, docX, docY],
      dragOrig: null,
      textSelectionTouchId: this.state.dragOrig.touch,
      textSelectionPressing: true
    })
  }
  getWordOverlay () {
    if (this.state.textSelection === null) return []
    if (!this.props.docJson) return []
    let ts = this.state.textSelection.slice()
    if (ts[0] > ts[2]) {
      let sw = ts[0]
      ts[0] = ts[2]
      ts[2] = sw
    }
    if (ts[1] > ts[3]) {
      let sw = ts[1]
      ts[1] = ts[3]
      ts[3] = sw
    }
    let wordrectsUm = this.rbush.search({
      minX: ts[0],
      minY: ts[1],
      maxX: ts[2],
      maxY: ts[3]
    }).sort(RectSort)
    let wordrects = []
    let minminX = this.props.docJson.width
    let minminY = this.props.docJson.height
    let maxmaxX = 0
    let maxmaxY = 0
    for (let i = 0; i < wordrectsUm.length; i ++) {
      let cRect = wordrectsUm[i]
      minminX = Math.min(minminX, cRect.minX)
      minminY = Math.min(minminY, cRect.minY)
      maxmaxX = Math.max(maxmaxX, cRect.maxX)
      maxmaxY = Math.max(maxmaxY, cRect.maxY)
      if (wordrects.length === 0) {
        wordrects.push(cRect)
      } else {
        let pRect = wordrects[wordrects.length - 1]
        if (Math.abs(pRect.minY - cRect.minY) < 2 && Math.abs(pRect.maxY - cRect.maxY) < 2 &&
          Math.abs(pRect.maxX - cRect.minX) < 2) {
            pRect = Object.assign({}, pRect)
            pRect.word += cRect.word
            pRect.minX = Math.min(pRect.minX, cRect.minX)
            pRect.minY = Math.min(pRect.minY, cRect.minY)
            pRect.maxX = Math.max(pRect.maxX, cRect.maxX)
            pRect.maxY = Math.max(pRect.maxY, cRect.maxY)
            wordrects[wordrects.length - 1] = pRect
          } else {
            wordrects.push(cRect)
          }
      }
    }
    if (minminX > maxmaxX) {
      minminX = ts[0]
      maxmaxX = ts[2]
    }
    if (minminY > maxmaxY) {
      minminY = ts[1]
      maxmaxY = ts[3]
    }
    let olay = wordrects.map(wr => ({
      lt: [wr.minX, wr.minY],
      rb: [wr.maxX, wr.maxY],
      className: 'wordsel',
      stuff: null
    }))
    if (this.state.textSelectionPressing || this.state.textSelectionTouchId) {
      olay = olay.concat([{
        lt: [ts[0], ts[1]],
        rb: [ts[2], ts[3]],
        className: 'wordsel-border',
        stuff: null
      }])
    } else {
      let fulltext = wordrects.map(x => x.word).join('')
      let shortened = fulltext.length > 40 ? fulltext.substr(0, 40) + '\u2026' : fulltext
      shortened = shortened.replace(/\s/g, ' ')
      let handleCopy = evt => {
        if (!this.isClickOrTap(evt)) return
        copyStuff(fulltext)
      }
      let handleSearch = evt => {
        if (!this.isClickOrTap(evt)) return
        window.open('https://www.google.com/search?q=' + encodeURIComponent(fulltext))
      }
      let handleCrop = evt => {
        if (!this.isClickOrTap(evt)) return
        this.startCrop([minminX, minminY, maxmaxX, maxmaxY])
      }
      olay = olay.concat({
        lt: [minminX, minminY],
        rb: [Infinity, Infinity],
        boundX: true,
        boundY: true,
        className: 'textmenu',
        stuff: (
          <div>
            {wordrects.length > 0 ? (<span onMouseUp={handleCopy} onTouchEnd={handleCopy}>Copy</span>) : null}
            {wordrects.length > 0 ? (<span onMouseUp={handleSearch} onTouchEnd={handleSearch}>Google "{shortened}"</span>) : null}
            {this.props.onCropBoundaryChange ? (<span onMouseUp={handleCrop} onTouchEnd={handleCrop}>Crop to collection</span>) : null}
          </div>
        )
      })
      if (wordrects.length === 0) {
        olay = olay.concat({
          lt: [ts[0], ts[1]],
          rb: [ts[2], ts[3]],
          className: 'wordsel-border',
          stuff: null
        })
      }
    }
    return olay
  }

  handleScroll (evt) {
    if (!this.svgLayer) return
    if (evt.ctrlKey) {
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
    if (!Array.isArray(point)) throw new Error('Expected point to be an array.')
    if (typeof point[0] !== 'number' && typeof point[1] !== 'number') throw new Error('Expected number in array.')
    let rect = this.svgLayer.getBoundingClientRect()
    if (rect.left === 0 && rect.top === 0)
      console.warn("client2view won't work if svgLayer isn't affecting layout. (e.g. display: none)")
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
    return viWid - ctWid >= -2 && viHig - ctHig >= -2
  }
  calcResizeOnPoint (point, factor) {
    let finalState = this.ctAnimationGetFinalState()
    let [ctX, ctY] = finalState.ctPos
    let [npX, npY] = [(-ctX + point[0]) * factor + ctX, (-ctY + point[1]) * factor + ctY]
    ctX = ctX - (npX - point[0])
    ctY = ctY - (npY - point[1])
    return {ctPos: [ctX, ctY], ctSize: finalState.ctSize.map(x => x * factor)}
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
    this.mounted = true
    if (this.props.docJson) {
      this.processDoc(this.props.docJson)
    }
    this.componentDidUpdate({}, {})
  }
  componentDidUpdate (prevProps, prevState) {
    if (!this.mounted) return
    if (this.lastViewWidth !== this.props.width || this.lastViewHeight !== this.props.height) {
      this.lastViewWidth = this.props.width
      this.lastViewHeight = this.props.height
      this.reCenter()
    } else if (!!prevProps.cropBoundary !== !!this.props.cropBoundary) {
      this.reCenter()
    } else if (prevProps.fixedBoundary !== this.props.fixedBoundary) {
      this.reCenter()
    }

    // Paint dirtyLayer when user drag/resize.
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
    let et = this.eventTarget
    if (et.getAttribute(etAttr) !== 'true') {
      et.setAttribute(etAttr, 'true')
      let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
      let downHandler = delayEvent(this.handleDown)
      et.addEventListener('mousedown', downHandler, noPassiveEventsArgument)
      et.addEventListener('touchstart', downHandler, noPassiveEventsArgument)
      let moveHandler = delayEvent(this.handleMove)
      // et.addEventListener('mousemove', moveHandler, noPassiveEventsArgument)
      et.addEventListener('touchmove', moveHandler, noPassiveEventsArgument)
      let upHandler = delayEvent(this.handleUp)
      // et.addEventListener('mouseup', uoHandler, noPassiveEventsArgument)
      et.addEventListener('touchend', upHandler, noPassiveEventsArgument)
      et.addEventListener('touchcancel', upHandler, noPassiveEventsArgument)
      let scrollHandler = delayEvent(this.handleScroll, false)
      let scrollHandlerPreventer = evt => {
        if (evt.ctrlKey) {
          evt.preventDefault()
        }
        scrollHandler(evt, false)
      }
      et.addEventListener('wheel', scrollHandlerPreventer, noPassiveEventsArgument)
      et.addEventListener('mousewheel', scrollHandlerPreventer, noPassiveEventsArgument)
      this._removeEtListener = et => {
        if (et.getAttribute(etAttr) !== 'true') return
        et.removeEventListener('mousedown', downHandler)
        et.removeEventListener('touchstart', downHandler)
        et.removeEventListener('touchmove', moveHandler)
        et.removeEventListener('touchend', upHandler)
        et.removeEventListener('touchcancel', upHandler)
        et.removeEventListener('wheel', scrollHandlerPreventer)
        et.removeEventListener('mousewheel', scrollHandlerPreventer)
        this._removeEtListener = null
      }
    }
    let co = this.cropOverlay
    if (co && co.getAttribute(etAttr) !== 'true') {
      co.setAttribute(etAttr, 'true')
      let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
      let _downHandler = delayEvent(this.handleCropDown)
      let downHandler = evt => {
        evt.stopPropagation() // Prevent dragging.
        _downHandler(evt)
      }
      co.addEventListener('mousedown', downHandler, noPassiveEventsArgument)
      co.addEventListener('touchstart', downHandler, noPassiveEventsArgument)
      let moveHandler = delayEvent(this.handleCropMove)
      // co.addEventListener('mousemove', moveHandler, noPassiveEventsArgument)
      co.addEventListener('touchmove', moveHandler, noPassiveEventsArgument)
      let upHandler = delayEvent(this.handleCropUp)
      // co.addEventListener('mouseup', upHandler, noPassiveEventsArgument)
      co.addEventListener('touchend', upHandler, noPassiveEventsArgument)
      co.addEventListener('touchcancel', upHandler, noPassiveEventsArgument)
      this._removeCoListener = co => {
        co.removeEventListener('mousedown', downHandler)
        co.removeEventListener('touchstart', downHandler)
        co.removeEventListener('touchmove', moveHandler)
        co.removeEventListener('touchend', upHandler)
        co.removeEventListener('touchcancel', upHandler)
        this._removeCoListener = null
      }
    }
  }
  componentWillReceiveProps (nextProps) {
    if (!this.mounted) return
    if (nextProps.docJson && (!this.props.docJson || this.props.docJson.svg !== nextProps.docJson.svg)) {
      this.processDoc(nextProps.docJson)
    }
  }
  processDoc ({svg, width, height, rects, text}) {
    this.setState({
      cropDragState: null,
      textSelection: null
    })
    if (this.props.onCropBoundaryChange) this.props.onCropBoundaryChange(null)

    // Create blob url for putting in background-image.
    let oldUrl = this.state.blobUrl
    let blob = new Blob([svg], {type: 'image/svg+xml'})
    let blobUrl = URL.createObjectURL(blob)
    this.setState({blobUrl: blobUrl})
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl)
    }

    // Create cached image ("screenshot") of the document.
    if (this.props.noCacheImage) {
      this.setState({cacheCanvas: null})
      return
    }
    const sf = 3
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

    if (this.props.cropBoundary) this.props.onCropBoundaryChange(null)

    if (this.props.fixedBoundary) this.ctAnimationStartFromState(this.calcFixedBoundary)

    this.rbush.clear()
    let wordRects = []
    for (let i = 0; i < rects.length; i ++) {
      let cChar = text[i]
      let cRect = rects[i]
      let isPartOfWord = /^[a-zA-Z0-9]$/.test(cChar)
      if (!cChar) break
      if ((isPartOfWord && (wordRects.length === 0 || wordRects[wordRects.length - 1] === null)) || (!isPartOfWord)) {
        wordRects.push({
          word: cChar,
          minX: cRect.x1,
          minY: cRect.y1,
          maxX: cRect.x2,
          maxY: cRect.y2
        })
        if (!isPartOfWord) {
          wordRects.push(null)
        }
      } else if (isPartOfWord && wordRects.length > 0) {
        let lastRect = wordRects[wordRects.length - 1]
        lastRect.word += cChar
        lastRect.minX = Math.min(lastRect.minX, cRect.x1)
        lastRect.minY = Math.min(lastRect.minY, cRect.y1)
        lastRect.maxX = Math.max(lastRect.maxX, cRect.x2)
        lastRect.maxY = Math.max(lastRect.maxY, cRect.y2)
      }
    }
    this.rbush.load(wordRects.filter(x => x !== null))
  }
  reCenter (noAnimation) {
    if (!noAnimation) {
      this.ctAnimationStartFromState(this.calcCenter())
    } else {
      this.ctAnimationStopToState(this.calcCenter())
    }
  }
  calcCenter () {
    if (this.props.fixedBoundary) return this.calcFixedBoundary()
    let [docWid, docHig] = ['width', 'height'].map(p => this.props.docJson[p])
    let [viWid, viHig] = [this.props.width, this.props.height]
    let [sfX, sfY] = [viWid / docWid, viHig / docHig]
    let sfM = Math.min(sfX, sfY)
    let ndocSiz = [docWid * sfM, docHig * sfM]
    if (this.props.cropBoundary) {
      ndocSiz = ndocSiz.map(x => x / 1.2)
    }
    let ndocPos = [0, 0]
    ndocPos[1] = viHig - ndocSiz[1]
    ndocPos[0] = viWid - ndocSiz[0]
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
  ctAnimationStopToState (nStat = {}) {
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
  componentWillUnmount () {
    try {
      this.mounted = false
      this.ctAnimationStopToState()
      if (this.state.blobUrl) {
        URL.revokeObjectURL(this.state.blobUrl)
      }
      this.setState({
        dragOrig: null,
        lastTapTime: 0,
        blobUrl: null,
        cacheCanvas: null,
        cropDragState: null,
        touchClickValidIdentifier: null,
        clickValid: false,
        pressTime: null,
        longPressDetectionTimeout: null,
        textSelection: null,
        textSelectionTouchId: null,
        textSelectionPressing: false
      })
      this.rbush.clear()
      this.rbush = null

      let et = this.eventTarget
      if (this._removeEtListener && et) this._removeEtListener(et)
      let co = this.cropOverlay
      if (this._removeCoListener && co) this._removeCoListener(co)

      document.removeEventListener('mousemove', this.handleCropMove)
      document.removeEventListener('mouseup', this.handleCropUp)
      document.removeEventListener('mousemove', this.handleMove)
      document.removeEventListener('mouseup', this.handleUp)
    } catch (e) {
      console.error(e)
    }
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

  startCrop (initBoundary = null) {
    if (!this.props.docJson || this.props.cropBoundary || !this.props.onCropBoundaryChange) return
    let [docWid, docHig] = ['width', 'height'].map(p => this.props.docJson[p])
    this.setState({
      textSelection: null,
      textSelectionPressing: false,
      textSelectionTouchId: null
    })
    if (!initBoundary) {
      this.props.onCropBoundaryChange([0, 0, docWid, docHig])
    } else {
      this.props.onCropBoundaryChange(initBoundary)
    }
  }

  handleCropDown (evt) {
    document.removeEventListener('mousemove', this.handleCropMove)
    document.removeEventListener('mouseup', this.handleCropUp)
    if (!this.props.cropBoundary) return
    if (evt.touches && evt.touches.length !== 1) return
    const shifting = {
      // x1, y1, x2, y2
      lt: [1, 1, 0, 0],
      t: [0, 1, 0, 0],
      rt: [0, 1, 1, 0],
      r: [0, 0, 1, 0],
      rb: [0, 0, 1, 1],
      b: [0, 0, 0, 1],
      lb: [1, 0, 0, 1],
      l: [1, 0, 0, 0]
    }
    let cl = evt.target.classList
    let shiftVector = null
    Object.keys(shifting).forEach(sk => {
      if (cl.contains(sk)) {
        shiftVector = shifting[sk]
      }
    })
    if (!shiftVector) shiftVector = [1, 1, 1, 1]
    let t = evt
    if (evt.touches) t = evt.touches[0]
    let cp = this.client2view([t.clientX, t.clientY])
    this.setState({cropDragState: {
      shiftVector, cp,
      touchIdentifier: Number.isInteger(t.identifier) ? t.identifier : null
    }})
    if (!evt.touches) {
      let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
      document.addEventListener('mousemove', this.handleCropMove, noPassiveEventsArgument)
      document.addEventListener('mouseup', this.handleCropUp, noPassiveEventsArgument)
    }
  }
  handleCropMove (evt, noPrevent) {
    if (!this.state.cropDragState) return
    if (!this.props.cropBoundary) return
    if (evt.touches && evt.touches.length !== 1) {
      this.handleCropUp(evt)
      return
    }
    if (!noPrevent) {
      evt.preventDefault()
    }
    let cp
    if (!evt.touches) {
      if (this.state.cropDragState.touchIdentifier) return
      cp = this.client2view([evt.clientX, evt.clientY])
    } else {
      if (this.state.cropDragState.touchIdentifier !== evt.touches[0].identifier) return
      cp = this.client2view([evt.touches[0].clientX, evt.touches[0].clientY])
    }

    let [cx, cy] = cp
    let [dx, dy] = [0, 1].map(p => cp[p] - this.state.cropDragState.cp[p])
    let ob = this.props.cropBoundary
    let sv = this.state.cropDragState.shiftVector
    let fct = 1 / this.calcFactorDoc()
    this.props.onCropBoundaryChange([Math.min(ob[0] + sv[0] * dx * fct, ob[2]), Math.min(ob[1] + sv[1] * dy * fct, ob[3]), Math.max(ob[2] + sv[2] * dx * fct, ob[0]), Math.max(ob[3] + sv[3] * dy * fct, ob[1])])
    this.setState({
      cropDragState: Object.assign({}, this.state.cropDragState, { cp })
    })
  }
  handleCropUp (evt) {
    if (!this.state.cropDragState || !this.props.cropBoundary) return
    if (!evt.touches) {
      this.handleCropMove(evt, true)
      document.removeEventListener('mousemove', this.handleCropMove)
      document.removeEventListener('mouseup', this.handleCropUp)
    }
    this.setState({cropDragState: null})
    this.normalizeCropBoundary()
  }
  normalizeCropBoundary () {
    let bdy = this.props.cropBoundary
    if (!bdy) return
    if (!this.props.docJson) return
    bdy = bdy.map(x => Math.max(0, x))
    ;[0, 2].forEach(p => bdy[p] = Math.min(bdy[p], this.props.docJson.width))
    ;[1, 3].forEach(p => bdy[p] = Math.min(bdy[p], this.props.docJson.height))
    this.props.onCropBoundaryChange(bdy)
  }
  calcFixedBoundary () {
    let bdy = this.props.fixedBoundary
    if (!bdy) return this.ctAnimationGetFinalState()
    if (!this.props.docJson) return this.ctAnimationGetFinalState()
    let { width: docW, height: docH } = this.props.docJson
    let [bx, by, bw, bh] = [bdy[0], bdy[1], bdy[2] - bdy[0], bdy[3] - bdy[1]]
    if (bw < 1) bw = 1
    if (bh < 1) bh = 1
    let [viWid, viHig] = [this.props.width, this.props.height]
    if (viWid < 1) viWid = 1
    if (viHig < 1) viHig = 1
    let [sX, sY] = [viWid / bw, viHig / bh]
    let s = Math.min(sX, sY)
    let nctSize = [docW * s, docH * s]
    let nctPos = [-bx * s, -by * s]
    if ((bw * s) < this.props.width) {
      nctPos[0] += (this.props.width - (bw * s)) / 2
    }
    if ((bh * s) < this.props.height) {
      nctPos[1] += (this.props.height - (bh * s)) / 2
    }
    return {ctPos: nctPos, ctSize: nctSize}
  }
}

module.exports = SsPdfView
