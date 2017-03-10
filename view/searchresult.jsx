const React = require('react')
const PaperUtils = require('./paperutils.js')
const PaperSet = require('./paperset.jsx')
const Feedback = require('./feedback.jsx')
const AppState = require('./appstate.js')
const OverflowView = require('./overflowview.jsx')

class SearchResult extends React.Component {
  shouldComponentUpdate (nextProps, nextState) {
    let nQ = nextProps.querying
    let tQ = this.props.querying || {}
    return nQ.error !== tQ.error
      || nQ.result !== tQ.result
      || nQ.loading !== tQ.loading
      || nQ.query !== tQ.query
      || nextProps.smallerSetName !== this.props.smallerSetName
  }
  render () {
    let querying = this.props.querying || {query: ''}
    return (
      <div className={'searchresult' + (querying.loading ? ' loading' : '') + (this.props.smallerSetName ? ' smallsetname' : '')}>
        {querying.error
          ? <div className='error'>
              <div>
                Unable to search:&nbsp;
                <span className='msg'>{querying.error.message}</span>
              </div>
              <div className='retry' onClick={evt => this.props.onRetry && this.props.onRetry()}>Retry search</div>
            </div>
          : null}
        {querying.result
          ? this.renderResult(querying.result, querying.query)
          : null}
        {AppState.getState().serverrender ? null : (
          <a className='fbBtn' onClick={evt => Feedback.show(querying.query)}>Report issues/missing/errors with this search...</a>
        )}
      </div>
    )
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
            {bucket.sort(PaperUtils.funcSortSet).map(set => (
              <PaperSet paperSet={set} key={PaperUtils.setToString(set)} psKey={PaperUtils.setToString(set)} />
            ))}
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
            })}
          </div>
        )
      default:
        return null
    }
  }
}

module.exports = SearchResult
