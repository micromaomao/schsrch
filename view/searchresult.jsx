const React = require('react')
const PaperUtils = require('./paperutils.js')
const PaperSet = require('./paperset.jsx')
const Feedback = require('./feedback.jsx')
const AppState = require('./appstate.js')
const OverflowView = require('./overflowview.jsx')

class SearchResult extends React.Component {
  constructor () {
    super()
    this.state = {
      err: null,
      result: null,
      loading: false,
      query: '',
      renderListAnimation: 0
    }
    if (AppState.getState().serverrender) {
      this.state.server = true
      let query = AppState.getState().serverrender.query
      if (query) {
        this.state.result = query.result
        this.state.query = query.query
      }
    }
    this.mapResultListAnimation = this.mapResultListAnimation.bind(this)
    this.nextFrameUpdate = null
  }
  componentDidMount () {
    if (AppState.getState().serverrender) return
    if (typeof this.props.query === 'string') {
      this.query(this.props.query)
    }
  }
  componentWillReceiveProps (nextProps) {
    if (this.props.query !== nextProps.query) {
      this.query(nextProps.query)
    }
  }
  shouldComponentUpdate (nextProps, nextState) {
    return nextState.err !== this.state.err
      || nextState.result !== this.state.result
      || nextState.loading !== this.state.loading
      || nextState.query !== this.state.query
      || nextState.renderListAnimation !== this.state.renderListAnimation
      || nextProps.smallerSetName !== this.props.smallerSetName
      || nextProps.query !== this.props.query
  }
  query (query) {
    this.setState({query: query})
    this.props.onStateChange && this.props.onStateChange(true)
    this.setState({err: null, loading: true})
    fetch('/search/' + encodeURIComponent(query) + '/').then(res => res.json()).then(result => {
      if (result.response === 'error') {
        this.error(query, result.err)
        return
      }
      this.result(query, result)
    }, err => {
      this.error(query, new Error('Unstable network connection or SchSrch has crashed.'))
    })
  }
  result (query, result) {
    this.setState({renderListAnimation: Date.now()})
    if (this.state.query !== query) {
      return
    }
    this.setState({result: result, err: null, loading: false})
    this.props.onStateChange && this.props.onStateChange(false)
  }
  error (query, err) {
    if (this.state.query !== query) {
      return
    }
    this.setState({result: null, err: err, loading: false})
    this.props.onStateChange && this.props.onStateChange(false)
  }
  render () {
    return (
      <div className={'searchresult' + (this.state.loading ? ' loading' : '') + (this.props.smallerSetName ? ' smallsetname' : '')}>
        {this.state.err
          ? <div className='error'>
              <div>
                Unable to search:&nbsp;
                <span className='msg'>{this.state.err.message}</span>
              </div>
              <div className='retry' onClick={evt => this.query(this.state.query)}>Retry search</div>
            </div>
          : null}
        {this.state.result
          ? this.renderResult(this.state.result, this.state.query)
          : null}
        {this.state.server ? null : (
          <a className='fbBtn' onClick={evt => Feedback.show(this.state.query)}>Report issues/missing/errors with this search...</a>
        )}
      </div>
    )
  }
  mapResultListAnimation (paperset, index) {
    if (this.state.server) {
      return paperset
    }
    let ani = Date.now() - this.state.renderListAnimation
    let stTime = index * 100
    if (ani >= stTime) {
      let opacity = Math.min((ani - stTime) / 200, 1)
      if (opacity < 1) {
        this.ensureNextFrameUpdate()
      }
      return (
        <div style={{opacity}} key={paperset.key}>
          {paperset}
        </div>
      )
    } else {
      this.ensureNextFrameUpdate()
      return (
        <div style={{height: '500px'}} key={paperset.key}>
        </div>
      )
    }
  }
  ensureNextFrameUpdate () {
    if (!this.nextFrameUpdate) {
      this.nextFrameUpdate = requestAnimationFrame(() => {
        this.nextFrameUpdate = null
        this.forceUpdate()
      })
    }
  }
  renderResult (result, query) {
    if ((!result.list || result.list.length === 0) && result.response.match(/^(pp|text)$/)) {
      result.response = 'empty'
    }
    switch (result.response) {
      case 'overflow':
        return (
          <OverflowView query={query} />
        )
      case 'empty':
        return (
          <div className='empty'>Your search returned no results.</div>
        )
      case 'pp':
        let bucket = []
        result.list.forEach(entity => {
          let existing = bucket.find(x => PaperUtils.setEqual(x, entity))
          if (existing) {
            existing.types.push(entity)
          } else {
            bucket.push({
              subject: entity.subject,
              time: entity.time,
              paper: entity.paper,
              variant: entity.variant,
              types: [
                entity
              ]
            })
          }
        })
        return (
          <div className='pplist'>
            {bucket.sort(PaperUtils.funcSortBucket).map(set => (
              <PaperSet paperSet={set} key={PaperUtils.setToString(set)} psKey={PaperUtils.setToString(set)} />
            )).map(this.mapResultListAnimation)}
          </div>
        )
      case 'text':
        return (
          <div className='fulltextlist'>
            {result.list.map(set => {
              let metas = {subject: set.doc.subject, time: set.doc.time, paper: set.doc.paper, variant: set.doc.variant}
              return (<PaperSet
                paperSet={Object.assign({}, metas, {types: [Object.assign({}, set.doc, {ftIndex: set.index}), ...set.related.map(x => Object.assign({}, metas, x))]})}
                key={'!!index!' + set.index._id}
                psKey={'!!index!' + set.index._id}
                indexQuery={query}
                />)
            }).map(this.mapResultListAnimation)}
          </div>
        )
      default:
        return null
    }
  }
}

module.exports = SearchResult
