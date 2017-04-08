const React = require('react')
const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')
const SearchResult = require('./searchresult.jsx')
const Feedback = require('./feedback.jsx')
const Disclaimer = require('./disclaimer.jsx')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      coverHideAnimation: 0,
      view: 'home'
    }
    this.handleUpdate = this.handleUpdate.bind(this)
    // UI Components should support server rendering to allow javascript-disabled users to use this App.
    // The DOM produced by server and client javascript could (and should) differ.
    if (AppState.getState().serverrender) {
      this.state.server = true
      this.state.view = AppState.getState().view
    }
  }
  handleUpdate () {
    let state = AppState.getState()
    this.setState({feedbackShowed: state.feedback.show, coverHideAnimation: Date.now()})
    this.setState({view: AppState.getState().view})
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
    let noSearch = AppState.getState().querying ? false : true
    return (
      <div>
        <SearchBar ref={f => this.searchbar = f} big={noSearch} onQuery={this.handleQuery}
          loading={noSearch ? false : (AppState.getState().querying.loading || false)} />
        {noSearch
          ? <Description />
          : <SearchResult querying={AppState.getState().querying} onRetry={() => this.handleQuery(AppState.getState().querying.query)} smallerSetName={this.state.server ? false : window.innerWidth <= 500} />}
      </div>
    )
  }
  handleQuery (query) {
    let oldQuery = AppState.getState().querying ? AppState.getState().querying.query : ''
    AppState.dispatch({type: 'query', query})
    if (AppState.getState().querying && (AppState.getState().querying.query !== oldQuery || !AppState.getState().querying.result)) {
      AppState.dispatch({type: 'queryStartRequest'})
      fetch('/search/?query=' + encodeURIComponent(query) + '&as=json').then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
        if (result.response === 'error') {
          AppState.dispatch({type: 'queryError', query, error: result.err})
          return
        }
        AppState.dispatch({type: 'queryResult', query, result})
      }, err => {
        AppState.dispatch({type: 'queryError', query, error: err})
      })
    }
  }
  renderDisclaim () {
    return (<Disclaimer />)
  }
  componentDidMount () {
    this.handleUpdate()
    this.unsub = AppState.subscribe(this.handleUpdate)
    if (AppState.getState().previewing === null) this.searchbar.input.focus()
    this.searchbar.setQuery(AppState.getState().querying ? AppState.getState().querying.query : '')
    AppState.getState().querying && this.handleQuery(AppState.getState().querying.query)
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
  }
}

module.exports = SchSrch
