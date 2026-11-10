import React from 'react'
import { AppState } from './appstate.js'
import { subjectOptions, sessionOptions, yearOptions, typeOptions, paperOptions, variantOptions } from './filterOptions.js'

export default class AdvancedFilters extends React.Component {
  constructor (props) {
    super(props)

    const querying = AppState.getState().querying || {}
    this.state = {
      filters: querying.filters || {},
      sort: querying.sort || 'relevance'
    }

    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleUpdateSort = this.handleUpdateSort.bind(this)
    this.handleResetFilters = this.handleResetFilters.bind(this)
  }

  componentDidMount () {
    this.unsub = AppState.subscribe(this.handleUpdate)
  }

  componentWillUnmount () {
    if (this.unsub) this.unsub()
  }

  handleUpdate () {
    const querying = AppState.getState().querying || {}
    this.setState({
      filters: querying.filters || {},
      sort: querying.sort || 'relevance'
    })
  }

  applyFilters (newFilters, newSort) {
    const querying = AppState.getState().querying || {}
    const query = querying.query || ''

    AppState.dispatch({
      type: 'query',
      query,
      filters: newFilters,
      sort: newSort
    })
  }

  updateFilterArray (key, value, options) {
    const newFilters = Object.assign({}, this.state.filters)
    let currentArr = newFilters[key]

    if (currentArr === undefined) {
      if (key === 'type') currentArr = ['qp', 'ms']
      else currentArr = options.map(o => o.value)
    }

    if (!Array.isArray(currentArr)) currentArr = [currentArr]

    if (currentArr.includes(value)) {
      currentArr = currentArr.filter(v => v !== value)
    } else {
      currentArr = [...currentArr, value]
    }

    if (key !== 'type' && currentArr.length === options.length) {
      delete newFilters[key]
    } else if (key === 'type' && currentArr.length === 2 && currentArr.includes('qp') && currentArr.includes('ms')) {
      delete newFilters[key]
    } else {
      newFilters[key] = currentArr
    }

    this.applyFilters(newFilters, this.state.sort)
  }

  handleUpdateSort (e) {
    const newSort = e.target.value
    this.applyFilters(this.state.filters, newSort)
  }

  handleResetFilters () {
    this.applyFilters({}, 'relevance')
  }

  renderSubjectChips () {
    let currentArr = this.state.filters.subject
    if (currentArr === undefined) currentArr = subjectOptions.map(o => o.value)
    if (!Array.isArray(currentArr)) currentArr = [currentArr]

    return (
      <div className='subject-chip-group'>
        {subjectOptions.map(opt => {
          const active = currentArr.includes(opt.value)
          return (
            <div
              key={opt.value}
              className={`subject-chip ${active ? 'active' : ''}`}
              onClick={() => this.updateFilterArray('subject', opt.value, subjectOptions)}
            >
              <span className='subj-name'>{opt.label}</span>
              <span className='subj-code'>{opt.value}</span>
            </div>
          )
        })}
      </div>
    )
  }

  renderSegmentedControl (key, options) {
    let currentArr = this.state.filters[key]
    if (currentArr === undefined) currentArr = options.map(o => o.value)
    if (!Array.isArray(currentArr)) currentArr = [currentArr]

    return (
      <div className='segmented-control'>
        {options.map(opt => {
          const active = currentArr.includes(opt.value)
          return (
            <div
              key={opt.value}
              className={`segment ${active ? 'active' : ''}`}
              onClick={() => this.updateFilterArray(key, opt.value, options)}
            >
              {opt.label}
            </div>
          )
        })}
      </div>
    )
  }

  renderTimeFilter () {
    let currentArr = this.state.filters.time || ['s22', 'w22', 'm22', 's21', 'w21', 'm21', 's20', 'w20', 'm20', 's19', 'w19', 'm19', 's18', 'w18', 'm18']
    if (!Array.isArray(currentArr)) currentArr = [currentArr]

    const selectedSessions = new Set()
    const selectedYears = new Set()
    currentArr.forEach(t => {
      if (t && t.length >= 3) {
        selectedSessions.add(t.charAt(0))
        selectedYears.add(t.substring(1))
      }
    })

    const toggleTime = (type, val) => {
      const newSessions = new Set(selectedSessions)
      const newYears = new Set(selectedYears)

      if (type === 'session') {
        if (newSessions.has(val)) newSessions.delete(val)
        else newSessions.add(val)
      } else {
        if (newYears.has(val)) newYears.delete(val)
        else newYears.add(val)
      }

      const newArr = []
      newSessions.forEach(s => {
        newYears.forEach(y => {
          newArr.push(s + y)
        })
      })

      const newFilters = Object.assign({}, this.state.filters)
      if (newArr.length === 0 || newArr.length >= (sessionOptions.length * yearOptions.length)) {
        delete newFilters.time
      } else {
        newFilters.time = newArr
      }
      this.applyFilters(newFilters, this.state.sort)
    }

    return (
      <>
        <div className='filter-group'>
          <div className='filter-group-title'>Session</div>
          <div className='minimal-toggle-group'>
            {sessionOptions.map(opt => {
              const active = selectedSessions.has(opt.value)
              return (
                <div key={opt.value} className={`minimal-toggle ${active ? 'active' : ''}`} onClick={() => toggleTime('session', opt.value)}>
                  {opt.label}
                </div>
              )
            })}
          </div>
        </div>
        <div className='filter-group'>
          <div className='filter-group-title'>Year</div>
          <div className='minimal-toggle-group'>
            {yearOptions.map(opt => {
              const active = selectedYears.has(opt.value)
              return (
                <div key={opt.value} className={`minimal-toggle ${active ? 'active' : ''}`} onClick={() => toggleTime('year', opt.value)}>
                  {opt.label}
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  renderDocumentTypes () {
    let currentArr = this.state.filters.type || ['qp', 'ms']
    if (!Array.isArray(currentArr)) currentArr = [currentArr]

    return (
      <div className='filter-group'>
        <div className='filter-group-title'>Document type</div>
        <div className='minimal-toggle-group'>
          {typeOptions.map(opt => {
            const active = currentArr.includes(opt.value)
            return (
              <div
                key={opt.value}
                className={`minimal-toggle ${active ? 'active' : ''}`}
                onClick={() => this.updateFilterArray('type', opt.value, typeOptions)}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  render () {
    return (
      <div className='advanced-filters-container'>

        {/* ROW 1: Subjects */}
        <div className='filter-row'>
          <div className='filter-group' style={{ width: '100%' }}>
            <div className='filter-group-title'>Subjects</div>
            {this.renderSubjectChips()}
          </div>
        </div>

        {/* ROW 2: Sessions & Years */}
        <div className='filter-row'>
          {this.renderTimeFilter()}
        </div>

        {/* ROW 3: Document Types */}
        <div className='filter-row'>
          {this.renderDocumentTypes()}
        </div>

        {/* ROW 4: Paper & Variant */}
        <div className='filter-row'>
          <div className='filter-group'>
            <div className='filter-group-title'>Paper</div>
            {this.renderSegmentedControl('paper', paperOptions)}
          </div>
          <div className='filter-group'>
            <div className='filter-group-title'>Variant</div>
            {this.renderSegmentedControl('variant', variantOptions)}
          </div>
        </div>

        {/* ROW 5: Sort and Reset */}
        <div className='filter-footer'>
          <div className='footer-controls'>
            <div className='sort-container-inline'>
              <span className='filter-group-title' style={{ margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>Sort by</span>
              <select className='sort-select' value={this.state.sort} onChange={this.handleUpdateSort}>
                <option value='relevance'>Relevance</option>
                <option value='newest'>Newest</option>
                <option value='oldest'>Oldest</option>
                <option value='subject'>Subject</option>
              </select>
            </div>
            <button className='filter-btn-reset' onClick={this.handleResetFilters}>Reset filters</button>
          </div>
        </div>

      </div>
    )
  }
}
