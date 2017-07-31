const React = require('react')
const AppState = require('./appstate.js')
const { assertValidPoint, client2view, pointDistance } = require('./pointutils.js')

const etAttr = 'data-event-bind'

class AnnotationLayer extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      downEventTimestamp: null,
      downEventPos: null,
      tapValid: false,
      tapIdentifier: null,
      creating: null,
      modifying: null,
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
    let scale = this.props.viewScale
    return (
      <div className='annotations' ref={f => this.eventTarget = f} onMouseMove={this.handleMouseMove}
        style={{
          width: this.props.width + 'px',
          height: this.props.height + 'px',
          pointerEvents: (this.props.disabled ? 'none' : 'auto')}} >
        {this.emptyAnnotations() && !this.props.disabled && !this.state.creating && !this.state.modifying
          ? (
              <div className='placeholder'>
                <div className='pen'>
                  <svg className="icon ii-pen"><use href="#ii-pen" xlinkHref="#ii-pen" /></svg>
                </div>
                No annotations yet. Tap anywhere to create one.<br />
              </div>
            ) : null}
        {this.state.creating && !this.state.modifying && !this.props.disabled
          ? (() => {
              let creating = this.state.creating
              if (creating.type === 'prompt') {
                const promptWidth = 40 + 2*2
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
            })() : null}
        {this.state.modifying && !this.state.creating && !this.props.disabled
          ? (() => {
              let modifying = this.state.modifying
              let target = modifying.target
              if (modifying.state === 'selected') {
                let bBox = this.annotationBoundingBox(target)
                if (bBox === null) bBox = [-Infinity, -Infinity, Infinity, Infinity]
                const menuWidth = 40 * 2
                const menuHeight = 40 + 2
                let point = this.doc2view([(bBox[0] + bBox[2]) / 2, bBox[3]])
                point[0] = Math.max(0, Math.min(point[0] - menuWidth / 2, this.props.width - menuWidth))
                point[1] = Math.max(0, Math.min(point[1], this.props.height - menuHeight))
                return (
                  <div className='selectionMenu' ref={f => this.modifyingSelectedMenu = f}
                    style={{
                      left: point[0] + 'px',
                      top: point[1] + 'px',
                      width: menuWidth + 'px',
                      height: menuHeight + 'px'
                    }}>
                    <span ref={f => this.modifyingSelectedMove = f} className='move'>
                      <svg className="icon ii-move"><use href="#ii-move" xlinkHref="#ii-move" /></svg>
                    </span>
                    <span ref={f => this.modifyingSelectedDel = f}>
                      <svg className="icon ii-del"><use href="#ii-del" xlinkHref="#ii-del" /></svg>
                    </span>
                  </div>
                )
              }
              return null
            })() : null}
        {!this.emptyAnnotations()
          ? (
              this.props.annotations.map((ano, i) => {
                let highlight = (this.state.highlightAno === ano && !this.state.creating && !this.state.modifying) || (this.state.modifying && this.state.modifying.target === ano)
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
                        <path d={svgPath} stroke='#FF5722' fill='none' strokeWidth={(highlight ? 2 : 1) * scale / 1.3} />
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
  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.creating || this.state.modifying || nextState.creating || nextState.modifying ||
        this.state.downEventTimestamp !== null || nextState.downEventTimestamp !== null ||
        this.state.highlightAno !== nextState.highlightAno) return true
    for (let key in nextProps) {
      if (!nextProps.hasOwnProperty(key)) continue
      if (nextProps[key] !== this.props[key]) return true
    }
    for (let key in this.props) {
      if (!this.props.hasOwnProperty(key)) continue
      if (this.props[key] !== nextProps[key]) return true
    }
    return false
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
        creating: null,
        modifying: null,
        highlightAno: null
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
    if (!this.state.creating && !this.state.modifying) {
      let point = this.client2view([evt.clientX, evt.clientY])
      requestAnimationFrame(() => {
        if (this.state.creating || this.state.modifying) return
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
    let point = this.view2doc(this.state.downEventPos)
    let anoHovered = this.rayAnnotations(point)
    if (!this.props.disabled && !this.state.creating && !this.state.modifying) {
      if (!anoHovered) {
        this.setState({creating: {
          type: 'prompt',
          point,
          modifying: null
        }})
      } else {
        this.setState({modifying: {
          target: anoHovered,
          state: 'selected'
        }})
      }
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
    } else if (this.state.modifying && this.state.modifying.state === 'selected') {
      if (anoHovered !== this.state.modifying.target &&
        (!this.modifyingSelectedMenu ||
          (this.modifyingSelectedMenu && evt.target !== this.modifyingSelectedMenu && !this.modifyingSelectedMenu.contains(evt.target)))) {
        this.setState({
          modifying: null
        })
      } else if (this.modifyingSelectedMenu && (evt.target === this.modifyingSelectedMenu || this.modifyingSelectedMenu.contains(evt.target))) {
        if (this.modifyingSelectedDel === evt.target || this.modifyingSelectedDel.contains(evt.target)) {
          let ano = this.state.modifying.target
          this.commitAnnotationObjectModification(null, ano)
          this.setState({
            modifying: null
          })
        }
      }
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
    } else if (this.state.modifying && this.state.modifying.state === 'selected') {
      if (this.modifyingSelectedMove && (this.modifyingSelectedMove === target || this.modifyingSelectedMove.contains(target))) {
        this.setState({
          modifying: {
            target: this.state.modifying.target,
            state: 'moving',
            lastPoint: point
          }
        })
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
    } else if (this.state.modifying && this.state.modifying.state === 'moving') {
      let {target: ano, lastPoint} = this.state.modifying
      let scale = this.props.viewScale || 1
      let shift = [0, 1].map(p => point[p] - lastPoint[p]).map(x => x / scale)
      let nAno = this.annotationShift(ano, shift)
      this.commitAnnotationObjectModification(nAno, ano)
      this.setState({
        modifying: {
          target: nAno,
          state: 'moving',
          lastPoint: point
        }
      })
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
    } else if (this.state.modifying && this.state.modifying.state === 'moving') {
      this.setState({
        modifying: {
          target: this.state.modifying.target,
          state: 'selected'
        }
      })
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
    if (newObj !== null) {
      modAnnotations[index] = newObj
    } else {
      modAnnotations.splice(index, 1)
    }
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
      },
      modifying: null
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

  annotationBoundingBox (ano) {
    if (ano.type === 'sketch') {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (let path of ano.paths) {
        for (let point of path) {
          minX = Math.min(minX, point[0])
          minY = Math.min(minY, point[1])
          maxX = Math.max(maxX, point[0])
          maxY = Math.max(maxY, point[1])
        }
      }
      if (minX > maxX || minY > maxY) return null
      return [minX, minY, maxX, maxY]
    }
    return null
  }

  annotationShift (ano, shift) {
    if (ano.type === 'sketch') {
      let nAno = Object.assign({}, ano)
      nAno.paths = nAno.paths.map(path => path.map(point => point.map((x, i) => x + shift[i])))
      return nAno
    }
    return Object.assign({}, ano)
  }
}

module.exports = AnnotationLayer
