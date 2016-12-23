'use strict'

require('babel-polyfill')
require('fetch-polyfill')

require('offline-plugin/runtime').install()

const React = require('react')
const ReactDOM = require('react-dom')

require('./layout.sass')

const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')
const SearchResult = require('./searchresult.jsx')
const Feedback = require('./feedback.jsx')

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      query: ''
    }
    this.handleQuery = this.handleQuery.bind(this)
  }
  handleQuery (query) {
    this.setState({query})
    if (query === '') {
      this.setState({searching: false})
    }
    console.log('Query: ' + query)
  }
  render () {
    let noSearch = this.state.query === ''
    return (
      <div className="schsrch">
        <SearchBar ref={f => this.searchbar = f} big={noSearch} onQuery={this.handleQuery} loading={this.state.searching} />
        {noSearch
          ? <Description />
          : <SearchResult query={this.state.query} onStateChange={loading => this.setState({searching: loading})} smallerSetName={window.innerWidth <= 500} />}
        {Feedback.reactInstance}
      </div>
    )
  }
  componentDidMount () {
    this.searchbar.input.focus()
  }
}

let ui = ReactDOM.render(
  <SchSrch />,
  document.getElementsByClassName('react-root')[0]
)

window.addEventListener('resize', evt => {
  setTimeout(() => ui.forceUpdate(), 1)
})
