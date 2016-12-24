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

const AppState = require('./appstate.js')

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      query: '',
      coverHideAnimation: 0
    }
    this.handleQuery = this.handleQuery.bind(this)
    this.handleUpdate = this.handleUpdate.bind(this)
  }
  handleUpdate () {
    let state = AppState.getState()
    this.setState({feedbackShowed: state.feedback.show, coverHideAnimation: Date.now()})
    this.handleQuery(state.query)
  }
  handleQuery (query) {
    this.setState({query})
    if (query === '') {
      this.setState({searching: false})
    }
  }
  render () {
    let noSearch = this.state.query === ''
    let blackCoverStyle = {}
    let coverAnimationTime = Math.max(0, Date.now() - this.state.coverHideAnimation)
    let showCover = this.state.feedbackShowed
    if (showCover) {
      blackCoverStyle = {opacity: 1, zIndex: ''}
    } else if (!showCover && coverAnimationTime < 600) {
      blackCoverStyle = {opacity: 0, zIndex: ''}
      setTimeout(() => this.forceUpdate(), 600 - coverAnimationTime)
    } else {
      blackCoverStyle = {opacity: 0, zIndex: '0'}
    }
    return (
      <div className='schsrch'>
        <div className='contentblackcover' style={blackCoverStyle} />
        <div className='content'>
          <SearchBar ref={f => this.searchbar = f} big={noSearch} onQuery={query => AppState.dispatch({type: 'query', query})} setQuery={this.state.query} loading={this.state.searching} />
          {noSearch
            ? <Description />
            : <SearchResult query={this.state.query} onStateChange={loading => this.setState({searching: loading})} smallerSetName={window.innerWidth <= 500} />}
        </div>
        <Feedback.Frame />
      </div>
    )
  }
  componentDidMount () {
    this.handleUpdate()
    this.unsub = AppState.subscribe(this.handleUpdate)
    this.searchbar.input.focus()
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
  }
}

let ui = ReactDOM.render(
  <SchSrch />,
  document.getElementsByClassName('react-root')[0]
)

window.addEventListener('resize', evt => {
  setTimeout(() => ui.forceUpdate(), 1)
})
