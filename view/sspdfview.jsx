const React = require('react')

class SsPdfView extends React.Component {
  constructor () {
    super()
    this.state = {
      viewPos: [0, 0],
      viewSize: [0, 0]
    }
    this.lastViewWidth = this.lastViewHeight = this.viewWidth = this.viewHeight = 0
  }
  render () {
    let docJson = this.props.docJson
    if (!docJson) {
      return null
    }
    this.viewWidth = window.innerWidth
    // this.viewHeight = Math.min(this.viewWidth * (docJson.height / docJson.width), window.innerHeight)
    this.viewHeight = window.innerHeight
    let svgData = 'data:image/svg+xml,' + encodeURIComponent(docJson.svg)
    svgData = svgData.replace(/\(/g, '%28').replace(/\)/g, '%29')
    let svgStyle = {
      backgroundImage: `url(${svgData})`,
      backgroundPosition: `${this.state.viewPos[0]}px ${this.state.viewPos[1]}px`,
      backgroundSize: `${this.state.viewSize[0]}px ${this.state.viewSize[1]}px`
    }
    // TODO: Resize by wheel and touch, drag to move
    return (
      <div className='sspdfview' style={{height: this.viewHeight + 'px'}}>
        <div className='svglayer' ref={f => this.svgLayer = f} style={svgStyle} />
      </div>
    )
  }
  componentDidMount () {
    this.componentDidUpdate({}, {})
  }
  componentDidUpdate (prevProps, prevState) {
    if (this.lastViewWidth !== this.viewWidth || this.lastViewHeight !== this.viewHeight) {
      this.lastViewWidth = this.viewWidth
      this.lastViewHeight = this.viewHeight
      this.center()
    }
  }
  center () {
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
    this.setState({viewPos: ndocPos, viewSize: ndocSiz})
  }
}

module.exports = SsPdfView
