/* eslint-disable lines-between-class-members, object-curly-spacing, no-unused-vars, prefer-const, react/jsx-closing-bracket-location, react/jsx-indent, multiline-ternary, react/jsx-first-prop-new-line, react/jsx-closing-tag-location */
import * as React from 'react'
import { AppState } from './appstate.js'
import SubjectData from './CIESubjects.data.js'
import * as FetchErrorPromise from './fetcherrorpromise.jsx'

export default class SubjectsView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      searchQuery: '',
      filterLevel: 'All'
    }
    this.handleHome = this.handleHome.bind(this)
  }
  componentDidMount () {
    if (!this.props.statistics) {
      this.startLoad()
    }
  }
  startLoad () {
    AppState.dispatch({type: 'subjects-stst-perpare'})
    fetch('/subjects/?as=json').then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(agg => {
      AppState.dispatch({type: 'subjects-stst-load', data: agg})
    }, err => {
      AppState.dispatch({type: 'subjects-stst-error', error: err})
    })
  }
  render () {
    let agg = null
    let err = null
    if (this.props.statistics && this.props.statistics.result) {
      agg = this.props.statistics.result
    } else if (this.props.statistics && this.props.statistics.error) {
      err = this.props.statistics.error
    }

    const { searchQuery, filterLevel } = this.state
    const queryLower = searchQuery.toLowerCase().trim()

    let filteredSubjects = SubjectData.filter(subj => {
      if (filterLevel !== 'All') {
        if (filterLevel === 'IGCSE' && subj.level !== 'IGCSE') return false
        if (filterLevel === 'AS & A Level' && subj.level !== 'A/s') return false
        if (filterLevel === 'Misc' && (subj.level === 'IGCSE' || subj.level === 'A/s')) return false
      }
      if (queryLower) {
        if (!subj.name.toLowerCase().includes(queryLower) && !subj.id.toLowerCase().includes(queryLower)) {
          return false
        }
      }
      return true
    })

    const levels = ['All', 'IGCSE', 'AS & A Level', 'Misc']

    const renderSubjectCard = (subj) => {
      let aggItem = agg ? agg.find(g => g._id === subj.id) : null
      const sessionCount = aggItem && aggItem.times ? aggItem.times.length : 0

      return (
        <a
          key={subj.id}
          className='subject-card modern-card'
          href={`/search/?as=page&query=${subj.id}`}
          onClick={this.handleQuery.bind(this, subj.id)}
        >
          <div className='subj-details'>
            <h3 className='subj-name'>{subj.name}</h3>
            <span className='subj-id'>{subj.id}</span>
          </div>
          <div className='subj-meta'>
            <span className='badge'>{sessionCount ? `${sessionCount} sessions` : (aggItem ? `${aggItem.totalPaper} papers` : 'Loading...')}</span>
          </div>
        </a>
      )
    }

    const renderSection = (levelTitle, filterValue) => {
      const sectionSubjects = filteredSubjects.filter(subj => {
        if (filterValue === 'IGCSE') return subj.level === 'IGCSE'
        if (filterValue === 'AS & A Level') return subj.level === 'A/s'
        if (filterValue === 'Misc') return subj.level !== 'IGCSE' && subj.level !== 'A/s'
        return true
      })

      if (sectionSubjects.length === 0) return null

      return (
        <div className='subject-section' key={levelTitle}>
          <h2>{levelTitle}</h2>
          <div className='subject-grid'>
            {sectionSubjects.map(renderSubjectCard)}
          </div>
        </div>
      )
    }

    return (
      <div className='subjects-page modern-page-container'>
        <button className='escape-home-btn' onClick={this.handleHome} title='Return Home'>
          <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' /></svg>
        </button>

        <div className='modern-hero'>
          <div className='breadcrumb'>
            <span onClick={this.handleHome}>Home</span>
            <span className='separator'>/</span>
            <span className='current'>Browse Subjects</span>
          </div>
          <h1>Browse Subjects</h1>
          <p className='hero-description'>Explore all supported Cambridge subjects.</p>
          <div className='hero-badges'>
            <span className='badge'>{SubjectData.length} subjects</span>
            <span className='badge'>Updated regularly</span>
          </div>
        </div>

        <div className='subject-browser-controls'>
          <div className='search-bar-wrapper'>
            <svg className='search-icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='11' cy='11' r='8' /><line x1='21' y1='21' x2='16.65' y2='16.65' /></svg>
            <input
              type='text'
              placeholder='Search subjects by name or code...'
              value={this.state.searchQuery}
              onChange={e => this.setState({ searchQuery: e.target.value })}
              className='subject-search-input'
            />
          </div>
          <div className='level-filters'>
            {levels.map(lvl => (
              <button
                key={lvl}
                className={`filter-btn ${this.state.filterLevel === lvl ? 'active' : ''}`}
                onClick={() => this.setState({ filterLevel: lvl })}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className='subjects-content'>
          {(filterLevel === 'All' || filterLevel === 'IGCSE') && renderSection('IGCSE', 'IGCSE')}
          {(filterLevel === 'All' || filterLevel === 'AS & A Level') && renderSection('AS & A Level', 'AS & A Level')}
          {(filterLevel === 'All' || filterLevel === 'Misc') && renderSection('Misc', 'Misc')}

          {filteredSubjects.length === 0 && (
            <div className='no-results'>
              <p>No subjects found matching your search.</p>
            </div>
          )}
        </div>

        <div className='modern-card request-callout'>
          <h3>Can't find your subject?</h3>
          <p>
            If you didn't find what you need, you can&nbsp;
            {AppState.getState().serverrender ? (
              'request to add it via GitHub.'
            ) : (
              <a onClick={evt => AppState.dispatch({type: 'showFeedback', search: '/subjects/'})}>request support on GitHub →</a>
            )}
          </p>
        </div>
      </div>
    )
  }

  handleQuery (query, evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'query', query})
    AppState.dispatch({type: 'home'})
  }
  handleHome (evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'home'})
  }
}
