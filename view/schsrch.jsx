const React = require('react')
const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')
const SearchResult = require('./searchresult.jsx')
const Feedback = require('./feedback.jsx')
const Disclaimer = require('./disclaimer.jsx')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const FilePreview = require('./filepreview.jsx')
const { CollectionsView } = require('./collections.jsx')
const { LoginView } = require('./auth.jsx')
const PaperUtils = require('./paperutils.js')

class SchSrch extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      coverHideAnimation: 0,
      view: 'home',
      viewScrollAtTop: true,
      showFeedback: false,
      showSidebar: false
    }
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleQuery = this.handleQuery.bind(this)
    this.handleSearchContainScroll = this.handleSearchContainScroll.bind(this)
    this.handleBlackCoverDown = this.handleBlackCoverDown.bind(this)
    this.handleSidebarTopClick = this.handleSidebarTopClick.bind(this)
    // UI Components should support server rendering to allow javascript-disabled users to use this App.
    // The DOM produced by server and client javascript could (and should) differ.
    if (AppState.getState().serverrender) {
      this.state.server = true
      this.state.view = AppState.getState().view
    }
  }
  handleUpdate () {
    let state = AppState.getState()
    if (state.feedback.show !== this.state.showFeedback) {
      this.setState({showFeedback: state.feedback.show, coverHideAnimation: Date.now()})
    }
    if (state.showSidebar !== this.state.showSidebar) {
      this.setState({showSidebar: state.showSidebar, coverHideAnimation: Date.now()})
    }
    this.setState({view: AppState.getState().view})

    if (state.querying && !state.querying.loading && !state.querying.error && !state.querying.result) {
      this.handleQuery(state.querying.query)
    }
  }
  render () {
    let blackCoverStyle = {}
    let coverAnimationTime = Math.max(0, Date.now() - this.state.coverHideAnimation)
    let showCover = this.state.showFeedback || this.state.showSidebar
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
        case 'collections':
          return this.renderViewCollections()
        case 'login':
          return this.renderViewLogin()
      }
    })()
    let aState = AppState.getState()
    let previewing = aState.previewing
    let collection = aState.collection
    let paperCropClipboard = aState.paperCropClipboard
    let displayingBigPreview = this.shouldShowBigPreview() && previewing !== null
    return (
      <div className='schsrch'>
        {this.state.server ? null : (
          <div className='contentblackcover' style={blackCoverStyle} onTouchStart={this.handleBlackCoverDown} onMouseDown={this.handleBlackCoverDown} />
        )}
        <div className='content'>
          {
            this.state.server
            ? (
                aState.serverrender.query
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
          {!aState.paperCropClipboard && collection && collection.homeFromCollection
            ? (
                <div className='bottom'>
                  No paper crop selected. <a
                    onClick={evt => AppState.dispatch({type: 'view-collections', collectionId: collection.id})}>
                    return to collection</a>
                  &nbsp;
                  <a onClick={evt => AppState.dispatch({type: 'clear-home-from-collection'})}>close</a>
                </div>
              )
            : null}
          {paperCropClipboard
            ? (
                <div className='bottom'>
                  Paper&nbsp;
                  <span className='paperName'>
                    {paperCropClipboard.docMeta
                      ? (
                          <a onClick={evt => {
                              this.handleQuery(PaperUtils.setToString(paperCropClipboard.docMeta))
                              AppState.dispatch({type: 'home'})
                            }}>
                            {PaperUtils.setToString(paperCropClipboard.docMeta)}_{paperCropClipboard.docMeta.type}
                          </a>
                        )
                      : (
                          <a>{paperCropClipboard.doc}</a>
                        )}
                  </span>
                  &nbsp;selected.&nbsp;
                  <a onClick={evt => AppState.dispatch({type: 'set-paper-crop-clipboard', doc: null})}>clear</a>
                  &nbsp;
                  {collection && collection.homeFromCollection
                    ? (
                        <a onClick={evt => AppState.dispatch({type: 'view-collections', collectionId: collection.id})}>
                          return to collection
                        </a>
                      )
                    : null}
                </div>
              )
            : null}
        </div>
        {this.state.server ? null : <Feedback.Frame />}
        {this.renderSidebar()}
      </div>
    )
  }
  shouldShowBigPreview () {
    return this.state.server ? false : window.innerWidth >= 1100
  }
  handleBlackCoverDown (evt) {
    if (this.state.showSidebar) {
      AppState.dispatch({type: 'hide-sidebar'})
    }
  }
  renderHome () {
    return (
      <div className='view view-home'>
        {!this.state.showSidebar && !this.state.server
          ? (
              <div className='sidebarbtn' onClick={evt => AppState.dispatch({type: 'show-sidebar'})}>
                <svg className="icon ii-bars"><use href="#ii-bars" xlinkHref="#ii-bars"></use></svg>
              </div>
            ) : null}
        <div className={'searchbarcontain'}>
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={true} onQuery={this.handleQuery} loading={false} />
        </div>
        <Description />
      </div>
    )
  }
  renderSidebar () {
    if (this.state.server) return null
    let loginInfo = AppState.getState().loginInfo
    let authTokenHave = !!AppState.getState().authToken
    return (
      <div className={'sidebar ' + (this.state.showSidebar ? 'show' : 'hide')}>
        <div className='top' onClick={this.handleSidebarTopClick}>
          <div className='username'>
            {!authTokenHave && !loginInfo ? 'Login or register\u2026' : null}
            {authTokenHave && !loginInfo ? 'Getting your info\u2026' : null}
            {loginInfo ? loginInfo.username : null}
          </div>
        </div>
        <div className='bottom'>
          <a onClick={evt => Feedback.show()}>Feedback</a>
          <a onClick={evt => AppState.dispatch({type: 'disclaim'})}>Disclaimer</a>
          <a href='https://github.com/micromaomao/schsrch/blob/master/index.js' target='_blank'>API</a>
        </div>
      </div>
    )
  }

  handleSidebarTopClick (evt) {
    let authTokenHave = !!AppState.getState().authToken
    if (!authTokenHave) {
      AppState.dispatch({type: 'login-view'})
    }
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
            previewing={previewing}
            showSmallPreview={!this.shouldShowBigPreview()}
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
    let viewScrollAtTop = evt.target.scrollTop < 5
    // if (this.state.viewScrollAtTop === viewScrollAtTop) return
    this.setState({viewScrollAtTop})
  }

  handleQuery (query) {
    this.searchbar && this.searchbar.setQuery(query)
    if (query.trim().length === 0) {
      AppState.dispatch({type: 'query', query: ''})
      return
    }
    let oldQuery = AppState.getState().querying ? AppState.getState().querying.query : ''
    AppState.dispatch({type: 'query-perpare', query})
    if (AppState.getState().querying && (AppState.getState().querying.query.trim() !== oldQuery.trim() || !AppState.getState().querying.result)) {
      AppState.dispatch({type: 'queryStartRequest'})
      fetch('/search/?query=' + encodeURIComponent(query.trim()) + '&as=json').then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
        if (result.response === 'error') {
          AppState.dispatch({type: 'queryError', query, error: result.err})
          return
        }
        AppState.dispatch({type: 'queryResult', query, result})
      }, err => {
        AppState.dispatch({type: 'queryError', query, error: err})
      })
    } else {
      AppState.dispatch({type: 'queryResult', query, result: AppState.getState().querying.result})
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
  renderViewCollections () {
    return (
      <div className='view view-collections'>
        <CollectionsView collection={AppState.getState().collection} />
      </div>
    )
  }
  renderViewLogin () {
    return (
      <div className='view view-login'>
        <LoginView loginState={AppState.getState().loginView} currentAuthToken={AppState.getState().authToken} />
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
