const React = require('react')
const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')
const SearchResult = require('./searchresult.jsx')
const Feedback = require('./feedback.jsx')
const Disclaimer = require('./disclaimer.jsx')
const AppState = require('./appstate.js')

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      query: '',
      coverHideAnimation: 0,
      view: 'home'
    }
    this.handleQuery = this.handleQuery.bind(this)
    this.handleUpdate = this.handleUpdate.bind(this)
    if (AppState.getState().serverrender) {
      this.state.server = true
      let query = AppState.getState().serverrender.query
      if (query) {
        this.state.query = query.query
      }
      this.state.view = AppState.getState().view
    }
  }
  handleUpdate () {
    let state = AppState.getState()
    this.setState({feedbackShowed: state.feedback.show, coverHideAnimation: Date.now()})
    this.handleQuery(state.query)
    this.setState({view: AppState.getState().view})
  }
  handleQuery (query) {
    this.setState({query})
    if (query === '') {
      this.setState({searching: false})
    }
  }
  render () {
    let blackCoverStyle = {}
    let coverAnimationTime = Math.max(0, Date.now() - this.state.coverHideAnimation)
    let showCover = this.state.feedbackShowed
    if (this.state.server) {
      blackCoverStyle = {opacity: 0, zIndex: 0}
    } else if (showCover) {
      blackCoverStyle = {opacity: 1, zIndex: ''}
    } else if (!showCover && coverAnimationTime < 600) {
      blackCoverStyle = {opacity: 0, zIndex: ''}
      setTimeout(() => this.forceUpdate(), 600 - coverAnimationTime)
    } else {
      blackCoverStyle = {opacity: 0, zIndex: '0'}
    }
    let noScriptFirstP = (
      <p>
        <a href='http://www.enable-javascript.com/'>Enabling javascript</a>
        &nbsp;is required to use SchSrch to it's greatest potential, otherwise there is no point in not using other
        past paper websites but SchSrch.
      </p>
    )
    let view = (() => {
      switch (this.state.view) {
        case 'home':
        default:
          return this.renderHome()
        case 'disclaim':
          return this.renderDisclaim()
      }
    })()
    return (
      <div className='schsrch'>
        {this.state.server ? null : (
          <div className='contentblackcover' style={blackCoverStyle} />
        )}
        <div className='content'>
          {
            this.state.server
            ? (
                AppState.getState().serverrender.query
                ? (
                    <noscript className='small'>
                      {noScriptFirstP}
                    </noscript>
                )
                : (
                    <noscript className='big'>
                      {noScriptFirstP}
                      <p>
                        We won't use javascript to collect any user information or harm your computer. Please add SchSrch to NoScript whitelist.
                      </p>
                      <p>
                        Here is a very simple version of SchSrch, made by using only HTML and CSS. Feedbacks are not dealt for this version of SchSrch.
                      </p>
                    </noscript>
                )
              )
            : null
          }
          {view}
        </div>
        {this.state.server ? null : <Feedback.Frame />}
      </div>
    )
  }
  renderHome () {
    let noSearch = this.state.query === ''
    return (
      <div>
        <SearchBar ref={f => this.searchbar = f} big={noSearch} onQuery={query => AppState.dispatch({type: 'query', query})} loading={this.state.searching} />
        {noSearch
          ? <Description />
          : <SearchResult query={this.state.query} onStateChange={loading => this.setState({searching: loading})} smallerSetName={this.state.server ? false : window.innerWidth <= 500} />}
      </div>
    )
  }
  renderDisclaim () {
    return (<Disclaimer />)
  }
  componentDidMount () {
    this.handleUpdate()
    this.unsub = AppState.subscribe(this.handleUpdate)
    if (AppState.getState().previewing === null) this.searchbar.input.focus()
    this.searchbar.setQuery(AppState.getState().query)
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
  }
}

module.exports = SchSrch
