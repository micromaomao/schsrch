const React = require('react')
const paperUtils = require('./paperutils.js')
const PaperSet = require('./paperset.jsx')

class SearchResult extends React.Component {
  constructor () {
    super()
    this.state = {
      err: null,
      result: null,
      loading: false,
      query: ''
    }
  }
  componentDidMount () {
    if (typeof this.props.query === 'string') {
      this.query(this.props.query)
    }
  }
  componentWillReceiveProps (nextProps) {
    if (this.props.query !== nextProps.query) {
      this.query(nextProps.query)
    }
  }
  query (query) {
    this.setState({query: query})
    this.props.onStateChange && this.props.onStateChange(true)
    this.setState({err: null, loading: true})
    fetch('/search/' + encodeURIComponent(query)).then(res => res.json()).then(result => {
      if (result.response === 'error') {
        this.error(query, result.err)
        return
      }
      this.result(query, result)
    }, err => {
      this.error(query, err)
    })
  }
  result (query, result) {
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
      <div className={'searchresult' + (this.state.loading ? ' loading' : '')}>
        {this.state.err
          ? <div className='error'>{this.state.err.message}</div>
          : null}
        {this.state.result
          ? this.renderResult(this.state.result)
          : null}
      </div>
    )
  }
  renderResult (result) {
    switch (result.response) {
      case 'overflow':
        return (
          <div className='overflow'>Too much entities found. Try search something more specific...</div>
        )
      case 'pp':
        let bucket = []
        result.list.forEach(entity => {
          let existing = bucket.find(x => paperUtils.setEqual(x, entity))
          if (existing) {
            existing.types.push({type: entity.type, id: entity._id})
          } else {
            bucket.push({
              subject: entity.subject,
              time: entity.time,
              paper: entity.paper,
              variant: entity.variant,
              types: [
                {
                  type: entity.type,
                  id: entity._id
                }
              ]
            })
          }
        })
        return (
          <div className='pplist'>
            {bucket.map(set => (
              <PaperSet paperSet={set} key={paperUtils.setToString(set)} />
            ))}
          </div>
        )
      default:
        return null
    }
  }
}

module.exports = SearchResult
