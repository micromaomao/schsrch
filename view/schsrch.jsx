const React = require('react')
const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')
const SearchResult = require('./searchresult.jsx')
const Feedback = require('./feedback.jsx')
const Disclaimer = require('./disclaimer.jsx')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.jsx')
const FilePreview = require('./filepreview.jsx')
const Collection = require('./collection.jsx')
const { LoginView } = require('./auth.jsx')
const ChallengeReplaceView = require('./challengereplace.jsx')
const PaperUtils = require('./paperutils.js')
const Sidebar = require('./sidebar.jsx')
const bowser = require('bowser')
const SubjectsView = require('./subjectsview.jsx')
const Help = require('./help.jsx')

class SchSrch extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      coverHideAnimation: 0,
      viewScrollAtTop: true,
      showFeedback: false,
      showSidebar: false,
      lastQueryLoad: null,
      lastView: null
    }
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleSearchBarQuery = this.handleSearchBarQuery.bind(this)
    this.handleSearchContainScroll = this.handleSearchContainScroll.bind(this)
    this.handleBlackCoverDown = this.handleBlackCoverDown.bind(this)
    this.retryQuery = this.retryQuery.bind(this)
    // UI Components should support server rendering to allow javascript-disabled users to use this App.
    // The DOM produced by server and client javascript could (and should) differ.
    if (AppState.getState().serverrender) {
      this.state.server = true
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

    if (state.view !== this.state.lastView) {
      let lastView = this.state.lastView
      this.setState({lastView: state.view, viewScrollAtTop: true})

      if (this.searchbar) {
        this.searchbar.focus()
      }
    }

    if (state.querying) {
      if (state.querying.loading && (state.querying.query !== this.state.lastQueryLoad || !state.querying.result)) {
        this.loadQuery()
      }
    } else {
      this.setState({lastQueryLoad: null})
    }

    this.forceUpdate()
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
        <a href='http://www.enable-javascript.com/'>Enable javascript</a> to enjoy a better and faster experience, and to use features like jumping from question paper
        to mark scheme or editing collections. Javascript is required also to submit feedback.
      </p>
    )
    let aState = AppState.getState()
    let view = (() => {
      switch (aState.view) {
        case 'home':
        default:
          return aState.querying ? this.renderSearch() : this.renderHome()
        case 'disclaim':
          return this.renderDisclaim()
        case 'collection':
          return this.renderViewCollection()
        case 'login':
          return this.renderViewLogin()
        case 'challenge-replace':
          return this.renderViewChallengeReplace()
        case 'subjects':
          return this.renderViewSubjects()
      }
    })()
    let { previewing, collection, paperCropClipboard } = aState
    let displayingBigPreview = this.shouldShowBigPreview() && previewing !== null
    return (
      <div className='schsrch'>
        {this.state.server ? null : (
          <div className='contentblackcover' style={blackCoverStyle} onTouchStart={this.handleBlackCoverDown} onMouseDown={this.handleBlackCoverDown} />
        )}
        <div className='content'>
          {this.state.server ? (
            aState.view !==  'home' || aState.querying || aState.showHelp ? (
              <noscript className='small'>
                {noScriptFirstP}
              </noscript>
            ) : (
              <noscript className='big'>
                {noScriptFirstP}
                <p>
                  Here is a very simple version of SchSrch, made by using only HTML and CSS.
                </p>
              </noscript>
            )
          ) : null}
          {!this.state.server && !AppState.supportSspdfView && AppState.supportOverall ? (
            <div className='unsupported'>
              Sorry, but your browser - {bowser.name} {bowser.version} is too old and paper preview won't work. You will get a PDF once you click on a paper.
              <div className='considerupgrade'>
                You should really consider upgrading your browser.
              </div>
            </div>
          ) : null}
          <div className={'viewcontain' + (displayingBigPreview ? ' sidepane' : '')}>
            {view}
            {displayingBigPreview ? (
              <FilePreview doc={previewing.id} page={previewing.page} highlightingDirIndex={previewing.highlightingDirIndex} />
            ) : null }
          </div>
          {!paperCropClipboard && collection && collection.homeFromCollection
            ? (
                <div className='bottom'>
                  No paper crop selected. <a
                    onClick={evt => AppState.dispatch({type: 'view-collection', collectionId: collection.id})}>
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
                              AppState.dispatch({type: 'query', query: PaperUtils.setToString(paperCropClipboard.docMeta)})
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
                        <a onClick={evt => AppState.dispatch({type: 'view-collection', collectionId: collection.id})}>
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
    let showHelp = AppState.getState().showHelp
    return (
      <div className='view view-home'>
        {!this.state.showSidebar && !this.state.server
          ? (
              <div className='sidebarbtn' onClick={evt => AppState.dispatch({type: 'show-sidebar'})}>
                <svg className="icon ii-bars"><use href="#ii-bars" xlinkHref="#ii-bars"></use></svg>
              </div>
            ) : null}
        {showHelp ? (
          <h1 className='helph1'>SchSrch help manual</h1>
        ) : null}
        <div className={'searchbarcontain' + (showHelp ? ' helping' : '')} key='searchbarcontain'>
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={!showHelp} onQuery={this.handleSearchBarQuery} alwaysShowIcon={showHelp}/>
        </div>
        <Description showHelp={showHelp} />
        {showHelp ? <Help /> : null}
      </div>
    )
  }
  renderSidebar () {
    if (this.state.server) return null
    let aState = AppState.getState()
    return (
      <Sidebar
        loginInfo={aState.loginInfo}
        authToken={aState.authToken}
        currentView={aState.view}
        show={this.state.showSidebar}
        currentCollection={aState.collection ? aState.collection.id : null} />
    )
  }

  renderSearch () {
    let query = AppState.getState().querying || {}
    query = query.query
    let previewing = AppState.getState().previewing
    let displayingBigPreview = this.shouldShowBigPreview() && previewing !== null
    return (
      <div className='view view-search'>
        <div key='searchbarcontain' className={'searchbarcontain prepare-shadow' + (this.state.viewScrollAtTop ? ' noshadow' : ' shadow')}>
          {!this.state.server ? (
            <div className='sidebarbtn' onClick={evt => AppState.dispatch({type: 'show-sidebar'})}>
              <svg className="icon ii-bars"><use href="#ii-bars" xlinkHref="#ii-bars"></use></svg>
            </div>
          ) : null}
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={false} onQuery={this.handleSearchBarQuery} />
        </div>
        <div className='searchcontain' onScroll={this.handleSearchContainScroll}>
          <SearchResult
            querying={AppState.getState().querying}
            previewing={previewing}
            showSmallPreview={!this.shouldShowBigPreview()}
            onRetry={this.retryQuery}
            smallerSetName={this.state.server ? false : window.innerWidth <= 500 || displayingBigPreview} />
        </div>
        {AppState.getState().serverrender ? null : (
          <a className='fbBtn' onClick={evt => Feedback.show(query)}>Report issues/missing/errors with this search...</a>
        )}
      </div>
    )
  }
  handleSearchContainScroll (evt) {
    let viewScrollAtTop = evt.target.scrollTop < 5
    // if (this.state.viewScrollAtTop === viewScrollAtTop) return
    this.setState({viewScrollAtTop})
  }

  loadQuery () {
    let querying = AppState.getState().querying
    if (!querying) return
    let query = querying.query.trim()
    this.setState({lastQueryLoad: query, viewScrollAtTop: true})
    fetch('/search/?query=' + encodeURIComponent(query.trim()) + '&as=json').then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
      // AppState will check if the query has changed since the request started.
      if (result.response === 'error') {
        AppState.dispatch({type: 'query-error', query, error: result.err})
        return
      }
      AppState.dispatch({type: 'query-load', query, result})
    }, err => {
      AppState.dispatch({type: 'query-error', query, error: err})
    })
  }

  retryQuery () {
    this.setState({lastQueryLoad: null}, () => {
      AppState.dispatch({type: 'retry-query'})
    })
  }

  handleSearchBarQuery (query) {
    AppState.dispatch({type: 'query', query})
  }

  renderDisclaim () {
    return (
        <div className='view'>
          <Disclaimer />
        </div>
      )
  }
  renderViewCollection () {
    return (
      <div className='view view-collection'>
        <Collection collection={AppState.getState().collection} />
      </div>
    )
  }
  renderViewLogin () {
    return (
      <div className='view view-login'>
        <LoginView />
      </div>
    )
  }
  renderViewChallengeReplace () {
    return (
      <div className='view view-challenge-replace'>
        <ChallengeReplaceView authToken={AppState.getState().authToken} />
      </div>
    )
  }
  renderViewSubjects () {
    return (
      <div className='view view-subjects'>
        <SubjectsView statistics={AppState.getState().subjectStatistics} />
      </div>
    )
  }

  componentDidMount () {
    this.handleUpdate()
    this.unsub = AppState.subscribe(this.handleUpdate)
    let aState = AppState.getState()
    if (aState.view === 'home' && aState.previewing === null && this.searchbar) this.searchbar.focus()
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
  }
}

module.exports = SchSrch
