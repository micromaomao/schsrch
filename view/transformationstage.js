const { client2view, pointDistance } = require('./pointutils.js')

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
    this.handleGestureStart = this.handleGestureStart.bind(this)
    this.handleGestureChange = this.handleGestureChange.bind(this)
    this.handleGestureEnd = this.handleGestureEnd.bind(this)

    this.eventTarget = null

    this.onUpdate = null
    this.onAfterUserInteration = null
    this.onDownEvent = null

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
  view2stage (point) {
    return [0,1].map(p => (point[p] - this.translate[p])/this.scale)
  }

  /**
   * Map a coordinate out of stage into the canvas space
   * @param {Array<number>} point
   * @return {Array<number>}
   */
  stage2view (point) {
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
    element.addEventListener('gesturestart', this.handleGestureStart, noPassiveEventsArgument)
    element.addEventListener('gesturechange', this.handleGestureChange, noPassiveEventsArgument)
    element.addEventListener('gestureend', this.handleGestureEnd, noPassiveEventsArgument)
  }

  removeTouchEvents (element) {
    document.removeEventListener('mousemove', this.handleMove)
    document.removeEventListener('mouseup', this.handleUp)
    element.removeEventListener('mousedown', this.handleDown)
    element.removeEventListener('touchstart', this.handleDown)
    element.removeEventListener('touchmove', this.handleMove)
    element.removeEventListener('touchend', this.handleUp)
    element.removeEventListener('touchcancel', this.handleUp)
    element.removeEventListener('wheel', this.handleWheel)
    element.removeEventListener('mousewheel', this.handleMouseWheel)
    element.removeEventListener('gesturestart', this.handleGestureStart)
    element.removeEventListener('gesturechange', this.handleGestureChange)
    element.removeEventListener('gestureend', this.handleGestureEnd)
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

    if (this.onDownEvent) {
      let ret = this.onDownEvent(evt)
      if (ret === false) {
        this.pressState = null
        return
      }
    }

    if (this.currentAnimation) this.currentAnimation.stop()

    if (evt.touches) {
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
    } else {
      evt.preventDefault()
      this.initMoveMouse([evt.clientX, evt.clientY])
      this.lastTapTime = null
      document.addEventListener('mousemove', this.handleMove)
      document.addEventListener('mouseup', this.handleUp)
    }
  }

  initMove (t) {
    this.pressState = {
      mode: 'single-touch',
      touchId: t.identifier,
      stagePoint: this.view2stage(client2view([t.clientX, t.clientY], this.eventTarget)),
      startingClientPoint: [t.clientX, t.clientY],
      timestamp: Date.now(),
      lastTransforms: null
    }
  }
  initMoveMouse (clientPoint) {
    this.pressState = {
      mode: 'mouse-press',
      stagePoint: this.view2stage(client2view(clientPoint, this.eventTarget)),
      lastTransforms: null
    }
  }
  initPinch (tA, tB) {
    let stagePoint = this.view2stage(client2view([tA.clientX + tB.clientX, tA.clientY + tB.clientY].map(x => x / 2), this.eventTarget))
    this.pressState = {
      mode: 'double-touch',
      A: tA.identifier,
      B: tB.identifier,
      initialDistance: pointDistance([tA.clientX, tA.clientY], [tB.clientX, tB.clientY]),
      initialScale: this.scale,
      stagePoint,
      lastTransforms: null
    }
  }

  handleMove (evt) {
    if (!this.pressState) return
    if (this.currentAnimation) this.currentAnimation.stop()
    if (this.onMoveEvent) {
      if (this.onMoveEvent(evt) === false) {
        document.removeEventListener('mousemove', this.handleMove)
        document.removeEventListener('mouseup', this.handleUp)
        if (this.moveEventFrame) {
          cancelAnimationFrame(this.moveEventFrame)
          this.moveEventFrame = null
        }
        this.pressState = null
        return
      }
    }
    evt.preventDefault()
    this.lastTapTime = null
    if (!this.moveEventFrame) {
      this.moveEventFrame = requestAnimationFrame(() => {
        this.moveEventFrame = null
        if (evt.touches) {
          if (evt.touches.length === 1) {
            let t = evt.touches[0]
            if (this.pressState.mode === 'single-touch' && t.identifier === this.pressState.touchId) {
              let transform = new PendingTransform([0, 0], this.scale, this)
                .mapPointToPoint(this.pressState.stagePoint, client2view([t.clientX, t.clientY], this.eventTarget))
              if (this.pressState.lastTransforms) {
                let lastTransforms = this.pressState.lastTransforms
                let now = Date.now()
                for (var i = 0; i < lastTransforms.length; i ++) {
                  if (now - lastTransforms[i].time < TransformVelocity.timeBackward) {
                    break
                  }
                }
                if (i === lastTransforms.length) {
                  lastTransforms = this.pressState.lastTransforms = [transform]
                } else if (i === 0) {
                  lastTransforms.push(transform)
                } else {
                  lastTransforms.push(transform)
                  lastTransforms.splice(0, i)
                }
              } else {
                this.pressState.lastTransforms = [transform]
              }
              transform.applyImmediate()
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
        } else if (this.pressState.mode === 'mouse-press') {
          new PendingTransform([0, 0], this.scale, this)
            .mapPointToPoint(this.pressState.stagePoint, client2view([evt.clientX, evt.clientY], this.eventTarget))
            .applyImmediate()
        }
      })
    }
  }

  handleUp (evt) {
    evt.preventDefault()
    document.removeEventListener('mousemove', this.handleMove)
    document.removeEventListener('mouseup', this.handleUp)
    if (this.moveEventFrame) {
      cancelAnimationFrame(this.moveEventFrame)
      this.moveEventFrame = null
    }
    let finish = () => {
      if (this.pressState.lastTransforms && this.pressState.lastTransforms.length > 1) {
        let velocity = new TransformVelocity(this.pressState.lastTransforms)
        velocity.applyInertia(this).then(() => {
          if (this.onAfterUserInteration) {
            this.onAfterUserInteration()
          }
        })
      } else {
        new PendingTransform(this.translate, this.scale, this).boundInContentBox().startAnimation()
        if (this.onAfterUserInteration) {
          this.onAfterUserInteration()
        }
      }
      this.pressState = null
    }
    if (!this.pressState) return
    if (this.currentAnimation) this.currentAnimation.stop()
    if (evt.touches) {
      if (evt.touches.length === 0) {
        return finish()
      } else if (evt.touches.length === 1) {
        this.initMove(evt.touches[0])
      } else {
        return finish()
      }
    } else {
      return finish()
    }
  }

  handleDoubleTap (point) {
    let cPoint = client2view(point, this.eventTarget)
    let sPoint = this.view2stage(cPoint)
    let nScale = this.scale > 1 ? 0.9 : 2
    new PendingTransform([0, 0], nScale, this).mapPointToPoint(sPoint, cPoint).boundInContentBox().startAnimation(200)
    if (this.onAfterUserInteration) {
      this.onAfterUserInteration()
    }
  }

  handleWheel (evt) {
    evt.preventDefault()
    let [evDx, evDy] = [evt.deltaX, evt.deltaY]
    if (evt.deltaMode === 0x01) {
      // Lines
      evDx *= 53/3
      evDy *= 53/3
    } else if (evt.deltaMode === 0x02) {
      // Pages
      evDx *= 53/3 * 20
      evDy *= 53/3 * 20
    }
    if (!evt.ctrlKey) {
      let dx = -evDx * 1.5
      let dy = -evDy * 1.5
      if (evt.shiftKey) {
        [dy, dx] = [dx, dy]
      }
      this.animationGetFinalState().shift([dx, dy]).boundInContentBox().applyImmediate()
    } else {
      let nScale = this.animationGetFinalState().nScale * Math.pow(1.1, -evDy * 0.05)
      if (this.minScale) {
        nScale = Math.max(this.minScale, nScale)
      }
      if (this.maxScale) {
        nScale = Math.min(this.maxScale, nScale)
      }
      let cPoint = client2view([evt.clientX, evt.clientY], this.eventTarget)
      let sPoint = this.view2stage(cPoint)
      new PendingTransform([0, 0], nScale, this).mapPointToPoint(sPoint, cPoint).boundInContentBox().applyImmediate()
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

  handleGestureStart (evt) {
    // https://developer.apple.com/documentation/webkitjs/gestureevent
    // I don't have a Mac to test this.

    // On iOS devices, touchstart is triggered when pinching, but this event is also triggered.
    if (this.pressState) return

    document.removeEventListener('mousemove', this.handleMove)
    document.removeEventListener('mouseup', this.handleUp)
    evt.preventDefault()

    this.pressState = {
      mode: 'gesture',
      initialScale: this.animationGetFinalState().nScale
    }
  }

  handleGestureChange (evt) {
    if (!this.pressState || this.pressState.mode !== 'gesture') return
    evt.preventDefault()

    let nScale = this.pressState.initialScale * evt.scale
    if (this.minScale) {
      nScale = Math.max(this.minScale, nScale)
    }
    if (this.maxScale) {
      nScale = Math.min(this.maxScale, nScale)
    }
    let cPoint = client2view([evt.clientX, evt.clientY], this.eventTarget)
    let sPoint = this.view2stage(cPoint)
    new PendingTransform([0, 0], nScale, this).mapPointToPoint(sPoint, cPoint).applyImmediate()
  }

  handleGestureEnd (evt) {
    if (!this.pressState || this.pressState.mode !== 'gesture') return
    evt.preventDefault()
    this.pressState = null
    this.animationGetFinalState().boundInContentBox().startAnimation(200)
    if (this.onAfterUserInteration) {
      this.onAfterUserInteration()
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
    Object.defineProperty(this, 'time', {value: Date.now(), writable: false})
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

  simillarTo (obj) {
    let nT = obj.nTranslate
    if (Math.abs(nT[0] - this.nTranslate[0]) >= 1) return false
    if (Math.abs(nT[1] - this.nTranslate[1]) >= 1) return false
    if (Math.abs(obj.nScale - this.nScale) >= 0.0001) return false
    return true
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
   * @see TransformationStage.view2stage
   */
  view2stage (point) {
    return [0,1].map(p => (point[p] - this.nTranslate[p])/this.nScale)
  }

  /**
   * @see TransformationStage.stage2view
   */
  stage2view (point) {
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
    let canvasNow = this.stage2view(pStage)
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

  setTranslate (point) {
    return new PendingTransform([0,1].map(p => point[p] !== null ? point[p] : this.nTranslate[p]), this.nScale, this.stage)
  }
}

class TransformVelocity {
  static get timeBackward () {return 100}
  constructor (transformList) {
    if (transformList.length < 2) throw new Error(`transformList need to have length of at least 2, ${transformList.length} passed.`)
    let from = transformList[0]
    let to = transformList[transformList.length - 1]
    let dt = to.time - from.time
    let [dx, dy] = [0, 1].map(p => to.nTranslate[p] - from.nTranslate[p])
    this.vX = dx / dt
    this.vY = dy / dt
    this.uX = this.vX
    this.uY = this.vY
    this.nextFrame = this.nextFrame.bind(this)
    this.animationFrameId = null
    this.stage = null
    this.lastFrameTime = null
    let [cX, cY] = to.nTranslate
    this.currentX = cX
    this.currentY = cY
  }

  toString () {
    return `[TransformVelocity] vX = ${this.vX} px/ms, vY = ${this.vY} px/ms`
  }

  applyInertia (stage) {
    return new Promise((resolve, reject) => {
      if (Math.abs(this.vX - 0) < 0.01 && Math.abs(this.vY - 0) < 0.01) return void resolve()
      if (stage.currentAnimation) {
        stage.currentAnimation.stop()
      }
      this.stage = stage
      stage.currentAnimation = this
      this.onDone = resolve
      this.lastFrameTime = Date.now()
      this.nextFrame()
    })
  }

  get nTranslate () {
    return [this.currentX, this.currentY]
  }
  get nScale () {
    return this.stage.scale
  }

  nextFrame () {
    this.animationFrameId = null
    if (this.lastFrameTime === null) throw new Error('this.lastFrameTime === null')
    let dt = Date.now() - this.lastFrameTime
    let nX = this.currentX + dt * this.vX
    let nY = this.currentY + dt * this.vY
    this.stage.translate = [nX, nY]
    this.currentX = nX
    this.currentY = nY
    if (this.stage.onUpdate) this.stage.onUpdate()
    const aFriction = 0.005 // px/ms^2
    let nvX = this.vX - Math.sign(this.vX) * aFriction * dt
    let nvY = this.vY - Math.sign(this.vY) * aFriction * dt
    if (Math.sign(nvX) !== Math.sign(this.vX)) {
      this.vX = 0
    } else {
      this.vX = nvX
    }
    if (Math.sign(nvY) !== Math.sign(this.vY)) {
      this.vY = 0
    } else {
      this.vY = nvY
    }
    if (this.vX !== 0 || this.vY !== 0) {
      this.lastFrameTime = Date.now()
      this.animationFrameId = requestAnimationFrame(this.nextFrame)
    } else {
      this.stop()
    }
  }

  stop () {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId)
    this.animationFrameId = null
    if (this.stage.currentAnimation === this) this.stage.currentAnimation = null
    if (this.onDone) {
      this.onDone()
      this.onDone = null
    }
  }
}

module.exports = {TransformationStage, PendingTransform, TransformVelocity}