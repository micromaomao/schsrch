const React = require('react')
const PaperUtils = require('./paperutils.js')
const PaperSet = require('./paperset.jsx')
const Feedback = require('./feedback.jsx')
const AppState = require('./appstate.js')
const OverflowView = require('./overflowview.jsx')
const CIESubjects = require('./CIESubjects.js')
const SearchPrompt = require('./searchprompt.jsx')
const V1FilePreview = require('./v1filepreview.jsx')
const FetchErrorPromise = require('./fetcherrorpromise.jsx')
const PaperViewer = require('./paperviewer.jsx')
const memoizeOne = require('./memoize-one.js')

class SearchResult extends React.Component {
  constructor (props) {
    super(props)
    this.handleOverflowChangeQuery = this.handleOverflowChangeQuery.bind(this)
    this.organizeResult = memoizeOne(this.organizeResult)
  }
  organizeResult (result) {
    if (!result || !result.list || result.list.length === 0) {
      return null
    } else if (result.response === 'overflow' || result.response === 'empty') {
      return null
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
      if (!AppState.getState().serverrender) {
        let timesets = []
        for (let p of bucket) {
          let lastTimeset = timesets[timesets.length - 1]
          if (!lastTimeset || lastTimeset.subject !== p.subject || lastTimeset.time !== p.time) {
            timesets.push({
              subject: p.subject,
              time: p.time,
              papers: [p]
            })
          } else {
            lastTimeset.papers.push(p)
          }
        }
        return {v: 2, timesets}
      } else {
        return bucket
      }
    } else if (result.response === 'text') {
      let items = result.list.map(set => {
        let metas = {subject: set.doc.subject, time: set.doc.time, paper: set.doc.paper, variant: set.doc.variant}
        // paperSet should looks like: { subject: ..., paper: ..., ..., types: [ {_id: <docId>, type: ..., index: { ... }}, {_id: <docId>, type: ...}... ] }
        // query: the words user searched. Used for highlighting content.
        return Object.assign({}, metas, {types: [Object.assign({}, set.doc, {index: set.index}), ...set.related.map(x => Object.assign({}, metas, x))]})
      })
      return items
    } else {
      return null
    }
  }
  render () {
    let querying = this.props.querying || {query: ''}
    let relatedSubject = querying.query.match(/^(\d{4})(\s|$)/)
    if (relatedSubject) relatedSubject = relatedSubject[1]
    let deprecationStates = relatedSubject ? CIESubjects.deprecationStates(relatedSubject) : []
    let resultOrganized = this.organizeResult(querying.result)
    let v2 = resultOrganized && resultOrganized.v === 2
    if (querying.result && querying.result.response === 'text' && !AppState.getState().serverrender && false) v2 = true
    return (
      <div className={'searchresult' + (querying.loading ? ' loading' : '') + (this.props.smallerSetName ? ' smallsetname' : '') + (v2 ? ' v2' : '')}>
        {!v2 ? <SearchPrompt query={querying.query} /> : null}
        {querying.error
          ? <FetchErrorPromise.ErrorDisplay error={querying.error} serverErrorActionText={'handle your query'} onRetry={this.props.onRetry} />
          : null}
        {!resultOrganized ? deprecationStates.map((dst, i) => (
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
        )) : null}
        {querying.result && querying.result.typeFilter
          ? (
            v2 ? (
              <div className='warning'>Type filters like {querying.result.typeFilter} now has no visible effect in the application UI because of the way results are displayed.</div>
            ) : (
              <div className='warning'>Only showing {PaperUtils.getTypeString(querying.result.typeFilter)} because it is provided as part of the search filter.</div>
            )
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
    let resultOrganized = this.organizeResult(result)
    if (resultOrganized === null) {
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
    let v2viewing = AppState.getState().v2viewing
    if (result.response === 'pp' && (Array.isArray(resultOrganized) || resultOrganized.v === 2)) {
      let bucket = resultOrganized
      if (bucket.v === 2) {
        return (
          <div className='v2container'>
            <div className='v2paperlist'>
              <div className='tsscontainer'>
                {bucket.timesets ? bucket.timesets.map(ts => {
                  return (
                    <div className='ts' key={ts.subject + ' ' + ts.time}>
                      <div className='tit'>{ts.subject}<br />{ts.time}</div>
                      {ts.papers.map(paper => {
                        let viewingThis = v2viewing && paper.types.find(ent => ent._id === v2viewing.fileId)
                        return (
                          <div className={'paper' + (viewingThis ? ' current' : '')} key={`${paper.paper}${paper.variant}`}
                              onClick={evt => AppState.dispatch({type: 'v2view', fileId: (paper.types.find(x => x.type === 'qp') || paper.types[0])._id, atPage: 0})}>
                            {paper.paper}{paper.variant}
                          </div>
                        )
                      })}
                    </div>
                  )
                }) : null}
              </div>
            </div>
            <div className='viewercontain'>
              {!v2viewing ? <div className='null'>Choose a paper to open&hellip;</div> : null}
              {v2viewing ? <PaperViewer key='paperviewer' /> : null}
            </div>
          </div>
        )
      } else {
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
                    <V1FilePreview key={psKey + '_preview'} doc={previewing.id} page={previewing.page} highlightingDirIndex={previewing.highlightingDirIndex} shouldUseFixedTop={true} />
                  )
                }
              }
              return elements
            })()}
          </div>
        )
      }
    }
    if (result.response === 'text' && Array.isArray(resultOrganized)) {
        let items = resultOrganized
        if (AppState.getState().serverrender || true) {
          return (
            <div className='fulltextlist'>
              {(() => {
                  let elements = []
                  for (let item of items) {
                    let searchIndex = item.types[0].index._id
                    let psKey = '!!index!' + searchIndex
                    let previewing = this.props.previewing
                    let v1current = previewing !== null && previewing.psKey === psKey
                    let v2viewing = AppState.getState().v2viewing
                    let v2current = false
                    if (v2viewing && v2viewing.searchIndex === searchIndex) {
                      v2current = true
                    }
                    elements.push(<PaperSet
                      paperSet={item}
                      showRelated={!v2current}
                      key={psKey}
                      query={query}
                      current={v1current}
                      onOpenFile={(id, page, type) => {
                          let viewDir = null
                          if (type === item.types[0].type) {
                            viewDir = { page }
                          }
                          if (v2current && !viewDir) {
                            // perserve user moving of pages
                            AppState.dispatch({type: 'v2view-set-tCurrentType', tCurrentType: type, viewDir})
                            return
                          }
                          if (v2current && viewDir) {
                            AppState.dispatch({type: 'v2view-set-tCurrentType', tCurrentType: type, viewDir, stageTransform: null})
                            return
                          }
                          AppState.dispatch({
                            type: 'v2view',
                            searchIndex: searchIndex,
                            fileId: id,
                            tCurrentType: type,
                            viewDir
                          })
                        }}
                      />)
                    if (v1current && this.props.showSmallPreview) {
                      elements.push(
                        <V1FilePreview key={psKey + '_preview'} doc={previewing.id} page={previewing.page} highlightingDirIndex={previewing.highlightingDirIndex} shouldUseFixedTop={true} />
                      )
                    }
                    if (v2current) {
                      elements.push(
                        <div className='paperviewercontain'>
                          <PaperViewer key={psKey + '_v2paperviewer'} />
                        </div>
                      )
                    }
                  }
                  return elements
              })()}
            </div>
          )
        } else {
          return (
            <div className='v2container'>
              <div className='v2paperlist'>
                <div className='tsscontainer'>
                  {result.list.map(it => {
                    let itid = it.index._id
                    return (
                      <div className={'paper fulltext' + (v2viewing && v2viewing.searchIndex === itid ? ' current' : '')} key={itid}
                          onClick={evt => AppState.dispatch({
                                                              type: 'v2view',
                                                              searchIndex: itid,
                                                              fileId: it.doc._id,
                                                              tCurrentType: it.doc.type,
                                                              showPaperSetTitle: `${it.doc.subject} ${it.doc.time} ${it.doc.paper}${it.doc.variant}`,
                                                              viewDir: { page: it.index.page  /*, qNRect: null*/}
                                                            })}>
                        {it.doc.type}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className='viewercontain'>
                {!v2viewing ? <div className='null'>Choose a paper to open&hellip;</div> : null}
                {v2viewing ? <PaperViewer key='paperviewer' /> : null}
              </div>
            </div>
          )
        }
    }
    return null
  }

  handleOverflowChangeQuery (nQuery) {
    AppState.dispatch({type: 'query', query: nQuery})
  }
}

module.exports = SearchResult
