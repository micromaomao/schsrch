/* eslint-disable lines-between-class-members, prefer-const, object-curly-spacing, no-unused-vars, default-case-last, multiline-ternary, no-multi-spaces, react/jsx-curly-brace-presence, react/jsx-indent, jsx-quotes, react/self-closing-comp, no-return-assign, react/jsx-tag-spacing, react/jsx-boolean-value, react/jsx-closing-bracket-location, react/jsx-handler-names, indent, react/jsx-no-undef */
import * as React from 'react'
import SearchBar from './searchbar.jsx'
import Description from './description.jsx'
import SearchResult from './searchresult.jsx'
import Disclaimer from './disclaimer.jsx'
import { AppState } from './appstate.js'
import * as FetchErrorPromise from './fetcherrorpromise.jsx'
import Header from './header.jsx'
import AdvancedFilters from './advancedfilters.jsx'
import { subjectOptions, sessionOptions, yearOptions, typeOptions, paperOptions, variantOptions } from './filterOptions.js'
import * as bowser from 'bowser'
import SubjectsView from './subjectsview.jsx'
import Help from './help.jsx'
import SearchPrompt from './searchprompt.jsx'
import PaperViewer from './paperviewer.jsx'

export default class SchSrch extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      coverHideAnimation: 0,
      viewScrollAtTop: true,
      showFeedback: false,
      lastQueryLoad: null,
      lastView: null
    }
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleSearchBarQuery = this.handleSearchBarQuery.bind(this)
    this.handleSearchContainScroll = this.handleSearchContainScroll.bind(this)
    this.handleBlackCoverDown = this.handleBlackCoverDown.bind(this)
    this.handleV2viewerPopupClose = this.handleV2viewerPopupClose.bind(this)
    this.handleV2viewerPopupToInline = this.handleV2viewerPopupToInline.bind(this)
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
    let aState = AppState.getState()
    let showCover = this.state.showFeedback || this.state.showSidebar || (aState.v2viewing && aState.v2viewing.asPopup && !aState.v2viewing.popupClosing)
    if (this.state.server) {
      blackCoverStyle = {opacity: 0, zIndex: '0', pointerEvents: 'none'}
    } else if (showCover) {
      blackCoverStyle = {opacity: 1, pointerEvents: 'auto'}
    } else if (!showCover && coverAnimationTime < 600) {
      blackCoverStyle = {opacity: 0, pointerEvents: 'none'}
      setTimeout(() => this.forceUpdate(), 600 - coverAnimationTime)
    } else {
      blackCoverStyle = {opacity: 0, pointerEvents: 'none'}
    }
    let noScriptFirstP = (
      <p>
        <a href='http://www.enable-javascript.com/'>Enable javascript</a> to enjoy a better and faster experience, and to use features like jumping from question paper
        to mark scheme or editing collections.
      </p>
    )
    let view = (() => {
      switch (aState.view) {
        case 'home':
        default:
          return (aState.querying && aState.querying.query.trim().length > 0) ? this.renderSearch() : this.renderHome()
        case 'disclaim':
          return this.renderDisclaim()
        case 'collection':
          return this.renderViewCollection()
        case 'subjects':
          return this.renderViewSubjects()
      }
    })()
    return (
      <div className='schsrch'>
        {this.state.server ? null : (
          <div className='contentblackcover' style={blackCoverStyle} onTouchStart={this.handleBlackCoverDown} onMouseDown={this.handleBlackCoverDown} />
        )}
        <div className={'content' + (aState.v2viewing && aState.v2viewing.asPopup && !aState.v2viewing.popupClosing ? ' leftshift' : '')}>
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
          <div className={'viewcontain'}>
            {view}
          </div>
          <button
            className="theme-toggle-btn"
            onClick={() => AppState.dispatch({ type: 'toggle-theme' })}
            title="Toggle Dark Mode"
          >
            <span key={AppState.getState().theme} className="theme-icon">
              {AppState.getState().theme === 'dark' ? '☀️' : '🌙'}
            </span>
          </button>
        </div>
        {this.renderV2ViewingPopup()}
      </div>
    )
  }
  handleBlackCoverDown (evt) {
    if (AppState.getState().showSidebar) {
      AppState.dispatch({type: 'hide-sidebar'})
    }
  }
  renderHome () {
    let showHelp = AppState.getState().showHelp
    return (
      <div className='view view-home'>
        {showHelp ? (
          <h1 className='helph1'>SchSrch help manual</h1>
        ) : null}
        <div className={'searchbarcontain' + (showHelp ? ' helping' : '')} key='searchbarcontain'>
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={!showHelp} onQuery={this.handleSearchBarQuery} alwaysShowIcon={showHelp}/>
        </div>
        <SearchPrompt center={true} query={(AppState.getState().querying || {query: ''}).query} />
        <Description showHelp={showHelp} />
        {showHelp ? <Help /> : null}
      </div>
    )
  }

  renderV2ViewingPopup () {
    if (this.state.server) return null
    let v2viewing = AppState.getState().v2viewing
    if (!v2viewing || !v2viewing.asPopup) {
      return (
        <div className='v2viewingPopup hide'></div>
      )
    }
    return (
      <div className={'v2viewingPopup ' + (v2viewing.popupClosing ? 'hide' : 'show')}>
        <div className='topbar'>
          <a onClick={this.handleV2viewerPopupClose}>&lt; Return to search</a>&nbsp;
          {v2viewing.searchIndex ? (<a onClick={this.handleV2viewerPopupToInline}>Change to inline viewer</a>) : null}
        </div>
        <PaperViewer key={'popup_v2paperviewer'} />
      </div>
    )
  }

  handleV2viewerPopupClose (evt) {
    AppState.dispatch({type: 'v2view-popup-close'})
  }

  handleV2viewerPopupToInline (evt) {
    AppState.dispatch({type: 'v2view-to-inline'})
  }

  renderSearch () {
    let query = AppState.getState().querying || {}
    query = query.query
    let previewing = AppState.getState().previewing
    return (
      <div className='view view-search'>
        <div key='searchbarcontain' className='searchbarcontain'>
          <SearchBar key='searchbar' ref={f => this.searchbar = f} big={false} onQuery={this.handleSearchBarQuery} />
          {this.renderActiveFilters()}
        </div>

        <div className='searchcontain' onScroll={this.handleSearchContainScroll}>
          <SearchResult
            querying={AppState.getState().querying}
            onRetry={this.retryQuery} />
        </div>
      </div>
    )
  }

  renderActiveFilters () {
    return null
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
    let filters = querying.filters || {}
    let sort = querying.sort || 'relevance'
    this.setState({lastQueryLoad: query, viewScrollAtTop: true})

    let url = '/search/?query=' + encodeURIComponent(query.trim()) + '&as=json'
    if (Object.keys(filters).length > 0) {
      url += '&filters=' + encodeURIComponent(JSON.stringify(filters))
    }
    if (sort !== 'relevance') {
      url += '&sort=' + encodeURIComponent(sort)
    }

    if (typeof window !== 'undefined' && typeof window.history !== 'undefined') {
      let queryStr = '/?query=' + encodeURIComponent(query.trim())
      if (Object.keys(filters).length > 0) queryStr += '&filters=' + encodeURIComponent(JSON.stringify(filters))
      if (sort !== 'relevance') queryStr += '&sort=' + encodeURIComponent(sort)
      window.history.pushState(null, '', queryStr)
    }

    fetch(url).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(result => {
      // AppState will check if the query has changed since the request started.
      if (result.response === 'error') {
        AppState.dispatch({type: 'query-error', query, filters, sort, error: result.err})
        return
      }
      AppState.dispatch({type: 'query-load', query, filters, sort, result})
    }, err => {
      AppState.dispatch({type: 'query-error', query, filters, sort, error: err})
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
