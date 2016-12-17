'use strict'
const React = require('react')
const ReactDOM = require('react-dom')

require('./layout.sass')

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

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      query: ''
    }
  }
  render () {
    let noSearch = this.state.query === ''
    return (
      <div className="schsrch">
        <SearchBar ref={f => this.searchbar = f} big={noSearch} onQuery={query => this.setState({query})} />
        {noSearch
          ? <Description />
          : null}
      </div>
    )
  }
  componentDidMount () {
    this.searchbar.input.focus()
  }
}

class Description extends React.Component {
  constructor () {
    super()
    this.state = {}
  }
  render () {
    return (
      <div className='desc'>
        <div className='links'>
          <a>Usage</a>
          &nbsp;
          <a>Feedback</a>
          &nbsp;
          <a>Disclaimer</a>
          &nbsp;
          <a>API</a>
        </div>
        <div className='status'>
          <div>
            Currently holding ### paper (#### pages)
          </div>
          <div>
            Load average: ##/##/##
          </div>
        </div>
      </div>
    )
  }
}

let ui = ReactDOM.render(
  <SchSrch />,
  document.getElementsByClassName('react-root')[0]
)

window.addEventListener('resize', evt => {
  ui.forceUpdate()
})
