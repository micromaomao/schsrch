/* eslint-disable no-useless-constructor, prefer-const, object-curly-spacing, multiline-ternary, react/jsx-first-prop-new-line, react/jsx-indent-props, react/jsx-closing-bracket-location, lines-between-class-members, no-constant-condition, react/jsx-curly-brace-presence, react/jsx-indent, indent, object-shorthand */
import * as React from 'react'
import PaperUtils from './paperutils.js'
import PaperSet from './paperset.jsx'
import { AppState } from './appstate.js'
import OverflowView from './overflowview.jsx'
import CIESubjects from './CIESubjects.js'
import SearchPrompt from './searchprompt.jsx'
import * as FetchErrorPromise from './fetcherrorpromise.jsx'
import PaperViewer from './paperviewer.jsx'
import memoizeOne from './memoize-one.js'
import { subjectOptions, sessionOptions, yearOptions, typeOptions, paperOptions, variantOptions } from './filterOptions.js'

function renderActiveFilters (querying) {
  if (!querying || !querying.filters) return null
  let filters = querying.filters
  let activeChips = []

  if (filters.time && filters.time.length > 0 && filters.time.length < 15) {
    let sessions = new Set()
    let years = new Set()
    filters.time.forEach(t => {
      if (t && t.length >= 3) {
        sessions.add(t.charAt(0))
        years.add(t.substring(1))
      }
    })
    let sessionNames = Array.from(sessions).map(s => {
      let opt = sessionOptions.find(o => o.value === s)
      return opt ? opt.label : s
    }).join('/')
    let yearNames = Array.from(years).map(y => {
      let opt = yearOptions.find(o => o.value === y)
      return opt ? opt.label : y
    }).join('/')

    let timeLabel = ''
    if (sessions.size > 0 && years.size > 0) timeLabel = `${sessionNames} ${yearNames}`
    else if (sessions.size > 0) timeLabel = sessionNames
    else if (years.size > 0) timeLabel = yearNames

    if (timeLabel) {
      activeChips.push({ key: 'time', label: timeLabel })
    }
  }

  const processArrayFilter = (key, options, defaultLength) => {
    if (filters[key]) {
      let arr = Array.isArray(filters[key]) ? filters[key] : [filters[key]]
      if (arr.length > 0 && arr.length < defaultLength) {
        if (arr.length === defaultLength - 1) {
          let excluded = options.find(o => !arr.includes(o.value))
          if (excluded) {
            activeChips.push({ key, label: `Not ${excluded.label}`, valueToRemove: arr })
          }
        } else {
          arr.forEach(val => {
            let opt = options.find(o => o.value === val)
            activeChips.push({ key, val, label: opt ? opt.label : val })
          })
        }
      }
    }
  }

  processArrayFilter('subject', subjectOptions, subjectOptions.length)
  processArrayFilter('paper', paperOptions, paperOptions.length)
  processArrayFilter('variant', variantOptions, variantOptions.length)

  if (filters.type) {
    let arr = Array.isArray(filters.type) ? filters.type : [filters.type]
    if (arr.length !== 2 || !arr.includes('qp') || !arr.includes('ms')) {
      arr.forEach(val => {
        let opt = typeOptions.find(o => o.value === val)
        activeChips.push({ key: 'type', val, label: opt ? opt.label : val })
      })
    }
  }

  if (activeChips.length === 0) return null

  let removeFilter = (chip) => {
    let newFilters = Object.assign({}, filters)
    if (chip.key === 'time') {
      delete newFilters.time
    } else if (chip.key === 'subject' || chip.key === 'paper' || chip.key === 'variant' || chip.key === 'type') {
      if (chip.valueToRemove) {
        delete newFilters[chip.key]
      } else {
        let arr = Array.isArray(newFilters[chip.key]) ? newFilters[chip.key] : [newFilters[chip.key]]
        arr = arr.filter(v => v !== chip.val)
        if (arr.length === 0) delete newFilters[chip.key]
        else newFilters[chip.key] = arr
      }
    }
    AppState.dispatch({ type: 'query', query: querying.query, filters: newFilters, sort: querying.sort })
  }

  return (
    <div className='active-filters-bar' style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
      {activeChips.map((chip, i) => (
        <div key={i} className='active-filter-chip' style={{ display: 'flex', alignItems: 'center', background: 'var(--border-color)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.8rem', color: 'var(--text-color)' }}>
          {chip.label}
          <span style={{ marginLeft: '6px', cursor: 'pointer', opacity: 0.6 }} onClick={() => removeFilter(chip)}>✕</span>
        </div>
      ))}
      <div style={{ fontSize: '0.8rem', color: 'var(--color-link)', cursor: 'pointer', marginLeft: '4px' }} onClick={() => AppState.dispatch({ type: 'query', query: querying.query, filters: {}, sort: querying.sort })}>Clear all</div>
    </div>
  )
}

class InitResultList extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    let { timesets } = this.props.results
    return (
      <div className='initresultlist'>
        {timesets.map(timeset => {
          let subject = CIESubjects.findExactById(timeset.subject)
          if (!subject) {
            subject = { level: '??', name: timeset.subject, id: timeset.subject }
          }
          return (
            <div className='timeset' key={`${timeset.subject} ${timeset.time}`}>
              <div className='time'>
                <span className='subjid'>{timeset.subject}</span> <span className='subjname'>({subject.level} {subject.name})</span> {timeset.time}
              </div>
              {timeset.papers.map(paper => {
                return (
                  <div className='paper' key={paper.paper + ' ' + paper.variant}>
                    <span className='pv'>
                      {paper.paper === 0 ? null : (
                        paper.variant === 0 ? (
                          <span>
                            Paper {paper.paper}
                          </span>
                        ) : (
                          <span>
                            {paper.paper}{paper.variant}
                          </span>
                        )
                      )}
                    </span>
                    <span className='typelist'>
                      {paper.types.map(entity => {
                        return (
                          <a className='type' key={entity.type}
                            onClick={evt => AppState.dispatch({ type: 'v2view', fileId: (paper.types.find(x => x.type === entity.type) || paper.types[0])._id, tCurrentType: entity.type })}>
                            {PaperUtils.capitalizeFirst(PaperUtils.getTypeString(entity.type))}
                          </a>
                        )
                      })}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }
}

export default class SearchResult extends React.Component {
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
      for (let p of bucket) {
        p.types.sort((a, b) => PaperUtils.funcSortType(a.type, b.type))
      }

      // At this point, bucket is an Array of paper sets.
      // The following code group them by exam seasons for the new UI.

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
        return { v: 2, timesets }
      } else {
        return bucket
      }
    } else if (result.response === 'text') {
      let items = result.list.map(set => {
        let metas = { subject: set.doc.subject, time: set.doc.time, paper: set.doc.paper, variant: set.doc.variant }
        // paperSet should looks like: { subject: ..., paper: ..., ..., types: [ {_id: <docId>, type: ..., index: { ... }}, {_id: <docId>, type: ...}... ] }
        // query: the words user searched. Used for highlighting content.
        return Object.assign({}, metas, { types: [Object.assign({}, set.doc, { index: set.index }), ...set.related.map(x => Object.assign({}, metas, x))] })
      })
      return items
    } else {
      return null
    }
  }
  render () {
    let querying = this.props.querying || { query: '' }
    let relatedSubject = querying.query.match(/^(\d{4})(\s|$)/)
    if (relatedSubject) relatedSubject = relatedSubject[1]
    let deprecationStates = relatedSubject ? CIESubjects.deprecationStates(relatedSubject) : []
    let resultOrganized = this.organizeResult(querying.result)
    let v2 = resultOrganized && resultOrganized.v === 2
    if (querying.result && querying.result.response === 'text' && !AppState.getState().serverrender && false) v2 = true
    return (
      <div className={'searchresult' + (querying.loading ? ' loading' : '') + (v2 ? ' v2' : '')}>
        {!v2 ? <SearchPrompt query={querying.query} /> : null}
        {querying.error
          ? <FetchErrorPromise.ErrorDisplay error={querying.error} serverErrorActionText={'handle your query'} onRetry={this.props.onRetry} />
          : null}
        {!resultOrganized ? deprecationStates.map((dst, i) => (
          <div className='object-shorthand' key={i}>
            {(() => {
              let newQuery = `${dst.of}${querying.query.substr(4)}`
              let href = AppState.getState().serverrender ? `/search/?as=page&query=${encodeURIComponent(newQuery)}` : null
              let handleClick = evt => AppState.dispatch({ type: 'query', query: newQuery })
              if (dst.type === 'former') {
                if (dst.of) {
                  return (
                    <div className='msg'>
                      Syllabus {relatedSubject} had been replaced by syllabus <a href={href} onClick={handleClick}>{dst.of} ({CIESubjects.findExactById(dst.of).name})</a>.
                      Its final examination series was {PaperUtils.myTimeToHumanTime(dst.final)}. For newer past papers, you should
                      specify the new syllabus code {dst.of}.
                    </div>
                  )
                } else {
                  return (
                    <div className='msg'>
                      Syllabus {relatedSubject} ({CIESubjects.findExactById(relatedSubject).name}) has been withdrawn by Cambridge, its final examination series will be {PaperUtils.myTimeToHumanTime(dst.final)}.
                    </div>
                  )
                }
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
              <div className='object-shorthand'>Type filters like {querying.result.typeFilter} now has no visible effect in the application UI because of the way results are displayed.</div>
            ) : (
              <div className='object-shorthand'>Only showing {PaperUtils.getTypeString(querying.result.typeFilter)} because it is provided as part of the search filter.</div>
            )
          ) : null}
        {querying.result && querying.result.typeFilter && PaperUtils.getTypeString(querying.result.typeFilter) === querying.result.typeFilter
          ? (
            <div className='object-shorthand'>There is no such thing called {querying.result.typeFilter}.</div>
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
            <OverflowView query={query} response={result} onChangeQuery={this.handleOverflowChangeQuery} />
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
                {bucket.timesets && v2viewing ? bucket.timesets.map(ts => {
                  return (
                    <div className='ts' key={ts.subject + ' ' + ts.time}>
                      <div className='tit'>{ts.subject}<br />{ts.time}</div>
                      {ts.papers.map(paper => {
                        let viewingThis = v2viewing && paper.types.find(ent => ent._id === v2viewing.fileId)
                        return (
                          <div className={'paper' + (viewingThis ? ' current' : '')} key={`${paper.paper}${paper.variant}`}
                            onClick={evt => AppState.dispatch({ type: 'v2view', fileId: (paper.types.find(x => x.type === 'qp') || paper.types[0])._id })}>
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
              {!v2viewing ? (
                <InitResultList results={bucket} />
              ) : null}
              {v2viewing ? <PaperViewer key='paperviewer' /> : null}
            </div>
          </div>
        )
      } else {
        return (
          <div className='pplist'>
            <div className='search-summary' style={{padding: '1rem 0.5rem 1rem', color: 'var(--color-secondary-text)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column'}}>
              <div>
                {result.list.length} result{result.list.length !== 1 ? 's' : ''} {query ? `for "${query}"` : ''} • Sorted by {this.props.querying && this.props.querying.sort === 'time' ? 'Recent' : 'Relevance'}
              </div>
              {renderActiveFilters(this.props.querying)}
            </div>
            {(() => {
              let elements = []
              for (let set of bucket) {
                let psKey = PaperUtils.setToString(set)
                elements.push(<PaperSet
                  paperSet={set}
                  key={psKey}
                />)
              }
              return elements
            })()}
          </div>
        )
      }
    }
    if (result.response === 'text' && Array.isArray(resultOrganized)) {
      let items = resultOrganized
      return (
        <div className='fulltextlist'>
          <div className='search-summary' style={{ padding: '1rem 0.5rem 1rem', color: 'var(--color-secondary-text)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column' }}>
            <div>
              {result.list.length} result{result.list.length !== 1 ? 's' : ''} {query ? `for "${query}"` : ''} • Sorted by {this.props.querying && this.props.querying.sort === 'time' ? 'Recent' : 'Relevance'}
            </div>
            {renderActiveFilters(this.props.querying)}
          </div>
          {(() => {
            let elements = []
            for (let item of items) {
              let searchIndex = item.types[0].index._id
              let v2viewing = AppState.getState().v2viewing
              let v2current = false
              if (v2viewing && v2viewing.searchIndex === searchIndex && !v2viewing.popupClosing) {
                v2current = true
              }
              elements.push(<PaperSet
                paperSet={item}
                key={searchIndex}
                query={query}
                current={v2current && v2viewing.asPopup}
                onOpenFile={(id, page, type) => {
                  let viewDir = null
                  if (type === item.types[0].type) {
                    viewDir = { page }
                  }
                  if (v2current && !viewDir) {
                    // perserve user moving of pages
                    AppState.dispatch({ type: 'v2view-set-tCurrentType', tCurrentType: type, viewDir })
                    return
                  }
                  if (v2current && viewDir) {
                    AppState.dispatch({ type: 'v2view-set-tCurrentType', tCurrentType: type, viewDir, stageTransform: null })
                    return
                  }
                  AppState.dispatch({
                    type: 'v2view',
                    searchIndex: searchIndex,
                    fileId: id,
                    tCurrentType: type,
                    viewDir,
                    asPopup: true
                  })
                }}
              />)
              if (v2current && !v2viewing.asPopup) {
                elements.push(
                  <div className='paperviewercontain'>
                    <PaperViewer key={searchIndex + '_v2paperviewer'} />
                  </div>
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
    AppState.dispatch({ type: 'query', query: nQuery })
  }
}
