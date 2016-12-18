const React = require('react')
const URL_LOGO = require('./logo.png')

class SearchBar extends React.Component {
  constructor () {
    super()
    this.state = {
      query: '',
      lastQueryChange: 0,
      loadingStart: null,
      lastTimeout: null,
      lastQuerySubmited: ''
    }
    this.inputDelay = 1000
    this.handlePlaceholderClick = this.handlePlaceholderClick.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
  }
  handlePlaceholderClick (evt) {
    evt.preventDefault()
    this.input.focus()
  }
  handleQueryChange (evt) {
    let val = evt.target.value
    if (this.state.lastTimeout) {
      clearTimeout(this.state.lastTimeout)
    }
    this.setState({query: val, lastQueryChange: Date.now(), lastTimeout: setTimeout(() => {
      if (val !== this.state.lastQuerySubmited)
        this.props.onQuery && this.props.onQuery(val.trim())
      this.setState({lastTimeout: null, lastQuerySubmited: val})
    }, this.inputDelay)})
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.loading !== this.props.loading) {
      this.setState({loadingStart: nextProps.loading ? Date.now() : null})
    }
  }
  render () {
    let hideLogo = !this.props.big && window.innerWidth <= 800
    let strokeFillStyle = {}
    let lastChangedDur = Date.now() - this.state.lastQueryChange
    let loadingDur = Date.now() - this.state.loadingStart
    let loadAnimationCycle = 1000
    if (this.state.loadingStart !== null) {
      let ani = (loadingDur % loadAnimationCycle) / loadAnimationCycle
      if (ani <= 0.5) {
        strokeFillStyle.width = (Math.round((ani / 0.5) * 100 * 10) / 10) + '%'
        strokeFillStyle.marginLeft = null
      } else {
        strokeFillStyle.width = (Math.round((1 - (ani - 0.5) / 0.5) * 100 * 10) / 10) + '%'
        strokeFillStyle.marginLeft = (Math.round(((ani - 0.5) / 0.5) * 100 * 10) / 10) + '%'
      }
      requestAnimationFrame(() => {this.forceUpdate()})
    } else if (this.state.lastTimeout !== null && lastChangedDur <= this.inputDelay) {
      let prog = Math.pow(lastChangedDur / this.inputDelay, 5)
      strokeFillStyle.width = (Math.round(prog * 100 * 10) / 10) + '%'
      if (this.props.big)
        strokeFillStyle.marginLeft = (Math.round((1 - prog) / 2 * 100 * 10) / 10) + '%'
      else
        strokeFillStyle.marginLeft = null
      requestAnimationFrame(() => {this.forceUpdate()})
    } else {
      strokeFillStyle.width = null
      strokeFillStyle.marginLeft = null
    }
    return (
      <div className={this.props.big ? 'searchbar big' : 'searchbar small'}>
        <div className={'logoContain' + (hideLogo ? ' hide' : '')}>
          <img className='logo' src={URL_LOGO} />
        </div>
        <div className={'inputContain' + (hideLogo ? ' hw' : '')}>
          <input type='text' ref={f => this.input = f} value={this.state.query} onChange={this.handleQueryChange} />
          {this.props.big
            ? <div className={'placeholder' + (this.state.query !== '' ? ' hide' : '')} onMouseDown={this.handlePlaceholderClick} onTouchStart={this.handlePlaceholderClick}>... Type here ...</div>
            : null}
          <div className='stroke'>
            <div className='fill' style={strokeFillStyle} />
          </div>
        </div>
      </div>
    )
  }
}

module.exports = SearchBar
