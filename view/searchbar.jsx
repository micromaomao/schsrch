const React = require('react')
const URL_LOGO = require('file!./logo.png')

class SearchBar extends React.Component {
  constructor () {
    super()
    this.state = {
      query: ''
    }
    this.handlePlaceholderClick = this.handlePlaceholderClick.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
  }
  handlePlaceholderClick (evt) {
    evt.preventDefault()
    this.input.focus()
  }
  handleQueryChange (evt) {
    let val = evt.target.value
    this.setState({query: val})
    this.props.onQuery && this.props.onQuery(val.trim())
  }
  render () {
    let hideLogo = !this.props.big && window.innerWidth <= 800
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
        </div>
      </div>
    )
  }
}

module.exports = SearchBar
