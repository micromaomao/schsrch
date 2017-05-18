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
              let handleClick = evt => this.props.onChangeQuery && this.props.onChangeQuery(newQuery)
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
        {querying.result
          ? this.renderResult(querying.result, querying.query)
          : null}
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
            {(() => {
              let elements = []
              bucket.sort(PaperUtils.funcSortSet).forEach(set => {
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
                    <FilePreview key={psKey + '_preview'} doc={previewing.id} page={previewing.page} highlightingQ={previewing.highlightingQ} />
                  )
                }
              })
              return elements
            })()}
          </div>
        )
      case 'text':
        return (
          <div className='fulltextlist'>
            {(() => {
                let elements = []
                result.list.forEach(set => {
                  let metas = {subject: set.doc.subject, time: set.doc.time, paper: set.doc.paper, variant: set.doc.variant}
                  // paperSet: { subject: ..., paper: ..., ..., types: [ {_id: <docId>, type: ..., index: { ... }}, {_id: <docId>, type: ...}... ] }
                  // query: the words user searched. Used for highlighting content.
                  let psKey = '!!index!' + set.index._id
                  let previewing = this.props.previewing
                  let current = previewing !== null && previewing.psKey === psKey
                  elements.push(<PaperSet
                    paperSet={Object.assign({}, metas, {types: [Object.assign({}, set.doc, {index: set.index}), ...set.related.map(x => Object.assign({}, metas, x))]})}
                    key={psKey}
                    query={query}
                    current={current}
                    onOpenFile={(id, page) => {
                        AppState.dispatch({type: 'previewFile', fileId: id, page, psKey})
                      }}
                    />)
                  if (current && this.props.showSmallPreview) {
                    elements.push(
                      <FilePreview key={psKey + '_preview'} doc={previewing.id} page={previewing.page} highlightingQ={previewing.highlightingQ} />
                    )
                  }
                })
                return elements
            })()}
          </div>
        )
      default:
        return null
    }
  }
}

module.exports = SearchResult
