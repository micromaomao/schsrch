'use strict'
const React = require('react')
const ReactDOM = require('react-dom')

require('./layout.sass')

const SearchBar = require('./searchbar.jsx')

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

require('offline-plugin/runtime').install()
