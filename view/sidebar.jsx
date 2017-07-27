const React = require('react')
const FetchErrorPromise = require('./fetcherrorpromise.js')
const AppState = require('./appstate.js')
const Feedback = require('./feedback.jsx')

class Sidebar extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      myCollectionsExpanded: false,
      myCollectionsResult: null,
      myCollectionsError: null,
      addingCollection: null,
      newlyAddedCollection: null,
      collectionCreationError: null
    }
    this.handleTopClick = this.handleTopClick.bind(this)
    this.handleMyCollectionsClick = this.handleMyCollectionsClick.bind(this)
    this.handleAddCollection = this.handleAddCollection.bind(this)
  }

  render () {
    let { loginInfo, authToken, currentView: view, currentCollection } = this.props
    return (
      <div className={'sidebar ' + (this.props.show ? 'show' : 'hide')}>
        <div className='top' onClick={this.handleTopClick}>
          <div className='username'>
            {!authToken && !loginInfo ? 'Login or register\u2026' : null}
            {authToken && !loginInfo ? 'Getting your info\u2026' : null}
            {loginInfo ? loginInfo.username : null}
          </div>
          {authToken
            ? (
                <div className='logout' ref={f => this.sidebarLogoutBtn = f}>
                  <svg className="icon ii-logout"><use href="#ii-logout" xlinkHref="#ii-logout"></use></svg>
                </div>
              ) : null}
        </div>
        <div className='menu'>
          <div className={'menuitem' + (view === 'home' ? ' current' : '')} onClick={evt => AppState.dispatch({type: 'home'})}>Home</div>
          {loginInfo ?
            (
              <div className='menuitem mycollections' onClick={this.handleMyCollectionsClick}>
                <span>
                  My collections
                </span>
                <span className={'iconcontain' + (this.state.myCollectionsExpanded ? ' expanded' : '')}>
                  <svg className="icon ii-dropdown"><use href="#ii-dropdown" xlinkHref="#ii-dropdown"></use></svg>
                </span>
              </div>
            ) : null}
          {this.state.myCollectionsExpanded ?
            (
              <div className='collectionlist'>
                {this.state.myCollectionsResult === null ?
                  (
                    <div className='loading'>Loading&hellip;</div>
                  ) : null}
                {this.state.myCollectionsError !== null ?
                  (
                    <div className='error'>{this.state.myCollectionsError}</div>
                  ) : null}
                {this.state.myCollectionsResult && this.state.myCollectionsResult.count === 0 ?
                  (
                    <div className='empty'>You have not created any collections yet.</div>
                  ) : null}
                {this.state.myCollectionsResult !== null ?
                  (
                    <div
                      className={'menuitem add-collection'}
                      onClick={this.handleAddCollection} >
                      <span className='iconcontain'>
                        <svg className="icon ii-plus"><use href="#ii-plus" xlinkHref="#ii-plus"></use></svg>
                      </span>
                      <span className={!this.state.addingCollection && this.state.collectionCreationError ? 'error' : ''}>
                        {this.state.addingCollection ? 'Creating\u2026' : null}
                        {!this.state.addingCollection && !this.state.collectionCreationError ? 'Create collection' : null}
                        {!this.state.addingCollection && this.state.collectionCreationError ? this.state.collectionCreationError : null}
                      </span>
                    </div>
                  ) : null}
                {this.state.myCollectionsResult && this.state.myCollectionsResult.count > 0 ?
                  this.state.myCollectionsResult.list.map(col => {
                    let highlight = this.state.newlyAddedCollection === col._id
                    return (
                      <div
                        key={col._id}
                        className={'menuitem' + (view === 'collection' && currentCollection === col._id ? ' current' : '') + (highlight ? ' highlight' : '')}
                        onClick={evt => AppState.dispatch({type: 'view-collection', collectionId: col._id})} >
                        <div className={'name' + (!col.content.name ? ' unnamed' : '')}>{col.content.name || '(Unnamed)'}</div>
                      </div>
                    )
                  }) : null}
              </div>
            ) : null}
        </div>
        <div className='bottom'>
          <a onClick={evt => Feedback.show()}>Feedback</a>
          <a onClick={evt => AppState.dispatch({type: 'disclaim'})}>Disclaimer</a>
          <a href='https://github.com/micromaomao/schsrch/blob/master/index.js' target='_blank'>API</a>
        </div>
      </div>
    )
  }

  componentWillReceiveProps (nextProps) {
    if (!this.props || !this.props.loginInfo || !nextProps.loginInfo || nextProps.loginInfo._id !== this.props.loginInfo._id ||
        nextProps.authToken !== this.props.authToken || nextProps.show !== this.props.show) {
      this.setState({
        myCollectionsError: null,
        newlyAddedCollection: null
      })
    }
  }

  componentDidMount () {
    this.fetchMyCollections()
  }

  componentDidUpdate (prevProps, prevState) {
    if ((this.state.myCollectionsExpanded && (!prevState.myCollectionsExpanded || !this.state.myCollectionsResult)) ||
        prevProps.authToken !== this.props.authToken || prevProps.loginInfo !== this.props.loginInfo || this.props.show !== prevProps.show) {
      if (!this.props.loginInfo) {
        this.setState({
          myCollectionsError: null,
          myCollectionsResult: null,
          myCollectionsExpanded: false,
          newlyAddedCollection: null
        })
      } else {
        if (!prevState.myCollectionsExpanded) {
          this.setState({
            myCollectionsError: null,
            newlyAddedCollection: null
          })
        }
        if (!prevState.myCollectionsExpanded || this.state.myCollectionsError === null) {
          this.fetchMyCollections()
        }
      }
    }
  }

  fetchMyCollections () {
    if (!this.props.loginInfo || !this.props.authToken) {
      this.setState({
        myCollectionsError: null,
        myCollectionsResult: null
      })
      return
    }
    let authToken = this.props.authToken
    let loginInfo = this.props.loginInfo
    let authHeaders = new Headers()
    authHeaders.append('Authorization', 'Bearer ' + authToken)
    fetch(`/collections/by/${loginInfo._id}/?limit=10`, {headers: authHeaders}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      if (loginInfo !== this.props.loginInfo) return
      this.setState({
        myCollectionsResult: json,
        myCollectionsError: null
      })
    }, err => {
      if (loginInfo !== this.props.loginInfo) return
      this.setState({
        myCollectionsError: err.message
      })
    })
  }

  handleTopClick (evt) {
    let authTokenHave = !!AppState.getState().authToken
    if (!authTokenHave) {
      AppState.dispatch({type: 'login-view'})
    } else if (this.sidebarLogoutBtn && (evt.target === this.sidebarLogoutBtn || this.sidebarLogoutBtn.contains(evt.target))) {
      AppState.dispatch({type: 'clear-token'})
      // FIXME: Not secure. User expect token to be invalidated.
    }
  }

  handleMyCollectionsClick (evt) {
    this.setState({
      myCollectionsExpanded: !this.state.myCollectionsExpanded
    })
  }

  handleAddCollection (evt) {
    if (!this.props.authToken || this.state.addingCollection) return
    this.setState({
      addingCollection: true,
      collectionCreationError: null,
      newlyAddedCollection: null
    })
    let authHeaders = new Headers()
    authHeaders.append('Authorization', 'Bearer ' + this.props.authToken)
    fetch('/collections/new/', {method: 'POST', headers: authHeaders}).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
      this.setState({
        addingCollection: false,
        newlyAddedCollection: json.id,
        myCollectionsResult: null
      })
      this.fetchMyCollections()
    }, err => {
      this.setState({
        addingCollection: false,
        collectionCreationError: err.message,
        newlyAddedCollection: null
      })
    })
  }
}

module.exports = Sidebar
