const React = require('react')
const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')
const SearchResult = require('./searchresult.jsx')
const Feedback = require('./feedback.jsx')
const Disclaimer = require('./disclaimer.jsx')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const FilePreview = require('./filepreview.jsx')

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      coverHideAnimation: 0,
      view: 'home',
      viewScrollAtTop: true
    }
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleQuery = this.handleQuery.bind(this)
    this.handleSearchContainScroll = this.handleSearchContainScroll.bind(this)
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
          return AppState.getState().querying ? this.renderSearch() : this.renderHome()
        case 'disclaim':
          return this.renderDisclaim()
      }
    })()
    let previewing = AppState.getState().previewing
    let displayingBigPreview = this.shouldShowBigPreview() && previewing !== null
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
          <div className={'viewcontain' + (displayingBigPreview ? ' sidepane' : '')}>
            {view}
            {this.shouldShowBigPreview() && previewing
              ? (
                  <FilePreview doc={previewing.id} page={previewing.page} highlightingQ={previewing.highlightingQ} />
                )
              : null
            }
          </div>
        </div>
        {this.state.server ? null : <Feedback.Frame />}
      </div>
    )
  }
  shouldShowBigPreview () {
    return this.state.server ? false : window.innerWidth >= 1100
  }
  renderHome () {
    return (
      <div className='view view-home'>
        <div className={'searchbarcontain'}>
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={true} onQuery={this.handleQuery} loading={false} />
        </div>
        <Description />
      </div>
    )
  }
  renderSearch () {
    let query = AppState.getState().querying || {}
    query = query.query
    let previewing = AppState.getState().previewing
    let displayingBigPreview = this.shouldShowBigPreview() && previewing !== null
    return (
      <div className='view view-search'>
        <div className={'searchbarcontain prepare-shadow' + (this.state.viewScrollAtTop ? '' : ' shadow')}>
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={false} onQuery={this.handleQuery}
            loading={AppState.getState().querying.loading || false} />
        </div>
        <div className='searchcontain' onScroll={this.handleSearchContainScroll}>
          <SearchResult
            querying={AppState.getState().querying}
            previewing={this.shouldShowBigPreview() ? null : previewing}
            onRetry={() => this.handleQuery(AppState.getState().querying.query)}
            onChangeQuery={nQuery => this.handleQuery(nQuery)}
            smallerSetName={this.state.server ? false : window.innerWidth <= 500 || displayingBigPreview} />
        </div>
        {AppState.getState().serverrender ? null : (
            <a className='fbBtn' onClick={evt => Feedback.show((AppState.getState().querying || {}).query)}>Report issues/missing/errors with this search...</a>
          )}
      </div>
    )
  }
  handleSearchContainScroll (evt) {
    this.setState({viewScrollAtTop: evt.target.scrollTop < 5})
  }

  handleQuery (query) {
    this.searchbar && this.searchbar.setQuery(query)
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
    this.setState({viewScrollAtTop: true})
  }
  renderDisclaim () {
    return (
        <div className='view'>
          <Disclaimer />
        </div>
      )
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
