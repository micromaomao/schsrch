const React = require('react')
const PaperUtils = require('./paperutils.js')
const PaperSet = require('./paperset.jsx')
const Feedback = require('./feedback.jsx')
const AppState = require('./appstate.js')
const OverflowView = require('./overflowview.jsx')
const CIESubjects = require('./CIESubjects.js')
const SearchPrompt = require('./searchprompt.jsx')
const FilePreview = require('./filepreview.jsx')

class SearchResult extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      resultCache: null
    }
    if (props) {
      if (AppState.getState().serverrender) {
        this.setState = nState => Object.assign(this.state, nState)
      }
      this.componentWillReceiveProps(props)
    }
    this.handleOverflowChangeQuery = this.handleOverflowChangeQuery.bind(this)
  }
  componentDidMount () {
    if (this.props) {
      this.componentWillReceiveProps(this.props)
    }
  }
  componentWillReceiveProps (nextProps) {
    if (!this.state.resultCache || !this.props.querying || !this.props.querying.result || !nextProps.querying ||
        !nextProps.querying.result || nextProps.querying.result !== this.props.querying.result) {
      let result = nextProps.querying ? nextProps.querying.result : null
      if (!result || !result.list || result.list.length === 0) {
        this.setState({resultCache: null})
      } else if (result.response === 'overflow' || result.response === 'empty') {
        this.setState({resultCache: null})
      } else if (result.response === 'pp') {
        let bucket = []
        for (let entity of result.list) {
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
        }
        bucket.sort(PaperUtils.funcSortSet)
        this.setState({
          resultCache: bucket
        })
      } else if (result.response === 'text') {
        let items = result.list.map(set => {
          let metas = {subject: set.doc.subject, time: set.doc.time, paper: set.doc.paper, variant: set.doc.variant}
          // paperSet should looks like: { subject: ..., paper: ..., ..., types: [ {_id: <docId>, type: ..., index: { ... }}, {_id: <docId>, type: ...}... ] }
          // query: the words user searched. Used for highlighting content.
          return Object.assign({}, metas, {types: [Object.assign({}, set.doc, {index: set.index}), ...set.related.map(x => Object.assign({}, metas, x))]})
        })
        this.setState({
          resultCache: items
        })
      } else {
        this.setState({
          resultCache: null
        })
      }
    }
  }
  render () {
    let querying = this.props.querying || {query: ''}
    let relatedSubject = querying.query.match(/^(\d{4})(\s|$)/)
    if (relatedSubject) relatedSubject = relatedSubject[1]
    let deprecationStates = relatedSubject ? CIESubjects.deprecationStates(relatedSubject) : []
    return (
      <div className={'searchresult' + (querying.loading ? ' loading' : '') + (this.props.smallerSetName ? ' smallsetname' : '')}>
        <SearchPrompt query={querying.query} />
        {querying.error
          ? <div className='error'>
              <div>
                Unable to search:&nbsp;
                <span className='msg'>{querying.error.message}</span>
              </div>
              <div className='retry' onClick={evt => this.props.onRetry && this.props.onRetry()}>Retry search</div>
            </div>
          : null}
        {deprecationStates.map((dst, i) => (
          <div className='warning' key={i}>
            {(() => {
              let newQuery = `${dst.of}${querying.query.substr(4)}`
              let href = AppState.getState().serverrender ? `/search/?as=page&query=${encodeURIComponent(newQuery)}` : null
              let handleClick = evt => AppState.dispatch({type: 'query', query: newQuery})
              if (dst.type === 'former') {
                return (
                    <div className='msg'>
                      Syllabus {relatedSubject} had been replaced by syllabus <a href={href} onClick={handleClick}>{dst.of} ({CIESubjects.findExactById(dst.of).name})</a>.
                      Its final examination series was {PaperUtils.myTimeToHumanTime(dst.final)}. For newer past papers, you should
                      specify the new syllabus code {dst.of}.
                    </div>
                  )
              }
              if (dst.type === 'successor') {
                return (
                    <div className='msg'>
                      Syllabus {relatedSubject} is a replacement of syllabus <a href={href} onClick={handleClick}>{dst.of} ({CIESubjects.findExactById(dst.of).name})</a>,
                      which was no longer used after its final examination series {PaperUtils.myTimeToHumanTime(dst.formerFinal)}.
                      For older past papers, you should specify the old syllabus {dst.of} to avoid confusion.
                    </div>
                  )
              }
              return null
            })()}
          </div>
        ))}
        {querying.result && querying.result.typeFilter
          ? (
            <div className='warning'>Only showing {PaperUtils.getTypeString(querying.result.typeFilter)} because it is provided as part of the search filter.</div>
          ) : null}
        {querying.result && querying.result.typeFilter && PaperUtils.getTypeString(querying.result.typeFilter) === querying.result.typeFilter
          ? (
            <div className='warning'>There is no such thing called {querying.result.typeFilter}.</div>
          ) : null}
        {querying.result
          ? this.renderResult(querying.result)
          : null}
      </div>
    )
  }
  renderResult (result) {
    let query = this.props.querying && this.props.querying.query ? this.props.querying.query : ''
    let resultCache = this.state.resultCache
    if (resultCache === null) {
      switch (result.response) {
        case 'overflow':
          return (
            <OverflowView query={query} response={result} onChangeQuery={this.handleOverflowChangeQuery} showSmallPreview={this.props.showSmallPreview} previewing={this.props.previewing} />
          )
        case 'empty':
        default:
          return (
            <div className='empty'>Your search returned no results.</div>
          )
      }
    }
    if (result.response === 'pp' && Array.isArray(this.state.resultCache)) {
      let bucket = this.state.resultCache
      return (
        <div className='pplist'>
          {(() => {
            let elements = []
            for (let set of bucket) {
              let psKey = PaperUtils.setToString(set)
              let previewing = this.props.previewing
              let current = previewing !== null && previewing.psKey === psKey
              elements.push(<PaperSet
                  paperSet={set}
                  key={psKey}
                  current={current}
                  onOpenFile={(id, page) => {
                      AppState.dispatch({type: 'previewFile', fileId: id, page, psKey})
                    }}
                  />)
              if (current && this.props.showSmallPreview) {
                elements.push(
                  <FilePreview key={psKey + '_preview'} doc={previewing.id} page={previewing.page} highlightingQ={previewing.highlightingQ} shouldUseFixedTop={true} />
                )
              }
            }
            return elements
          })()}
        </div>
      )
    }
    if (result.response === 'text' && Array.isArray(this.state.resultCache)) {
        let items = this.state.resultCache
        return (
          <div className='fulltextlist'>
            {(() => {
                let elements = []
                for (let item of items) {
                  let psKey = '!!index!' + item.types[0].index._id
                  let previewing = this.props.previewing
                  let current = previewing !== null && previewing.psKey === psKey
                  elements.push(<PaperSet
                    paperSet={item}
                    key={psKey}
                    query={query}
                    current={current}
                    onOpenFile={(id, page) => {
                        AppState.dispatch({type: 'previewFile', fileId: id, page, psKey})
                      }}
                    />)
                  if (current && this.props.showSmallPreview) {
                    elements.push(
                      <FilePreview key={psKey + '_preview'} doc={previewing.id} page={previewing.page} highlightingQ={previewing.highlightingQ} shouldUseFixedTop={true} />
                    )
                  }
                }
                return elements
            })()}
          </div>
        )
    }
    return null
  }

  handleOverflowChangeQuery (nQuery) {
    AppState.dispatch({type: 'query', query: nQuery})
  }
}

module.exports = SearchResult
