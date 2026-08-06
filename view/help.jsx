import * as React from 'react'
import { AppState } from './appstate.js'

class SearchLink extends React.Component {
  render () {
    return (
      <a
        className='example-chip'
        onClick={(e) => {
          e.preventDefault()
          AppState.dispatch({ type: 'query', query: this.props.q })
        }}
        href={`/search/?as=page&query=${encodeURIComponent(this.props.q)}`}
      >
        {this.props.q}
      </a>
    )
  }
}

class CopyBlock extends React.Component {
  constructor (props) {
    super(props)
    this.state = { copied: false }
  }

  handleCopy = () => {
    navigator.clipboard.writeText(this.props.code).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  render () {
    return (
      <div className='syntax-block'>
        <code className='code'>{this.props.code}</code>
        <p className='desc'>{this.props.desc}</p>
        <button className='copy-btn' onClick={this.handleCopy} title='Copy to clipboard'>
          {this.state.copied
            ? (
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><polyline points='20 6 9 17 4 12' /></svg>
              )
            : (
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='9' y='9' width='13' height='13' rx='2' ry='2' /><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' /></svg>
              )}
        </button>
      </div>
    )
  }
}

export default class Help extends React.Component {
  render () {
    return (
      <div className='help-page-container schsrch-help'>
        <button className='escape-home-btn' onClick={() => AppState.dispatch({ type: 'hide-help' })} title='Close Help'>
          <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' /></svg>
        </button>

        <h1>Search Guide</h1>
        <p className='subtitle'>Find Cambridge papers instantly using keywords, paper codes, or advanced syntax.</p>

        <div className='quick-examples'>
          <SearchLink q='9700 s22 qp 42' />
          <SearchLink q='concentration' />
          <SearchLink q='9700' />
          <SearchLink q='0470 s17 13' />
        </div>

        <h2 id='quick-start'>Quick Start</h2>
        <div className='grid-2'>
          <div className='card'>
            <div className='card-title'>🔍 Search by keyword</div>
            <div className='card-desc'>Search for any phrase that appears inside papers.</div>
            <SearchLink q='photosynthesis' />
          </div>
          <div className='card'>
            <div className='card-title'>📄 Search a paper</div>
            <div className='card-desc'>Open a paper directly.</div>
            <SearchLink q='9700 s22 qp 42' />
          </div>
          <div className='card'>
            <div className='card-title'>📚 Search a subject</div>
            <div className='card-desc'>View every paper for a syllabus.</div>
            <SearchLink q='9700' />
          </div>
          <div className='card'>
            <div className='card-title'>⚙️ Advanced Search</div>
            <div className='card-desc'>Combine filters and paper codes.</div>
            <SearchLink q='9700 s22 ms' />
          </div>
        </div>

        <h2 id='syntax'>Search by Subject</h2>
        <p>Entering just the syllabus code will display the subject page, showing a list of test seasons available for viewing.</p>
        <CopyBlock code='0470' desc='Opens the IG history subject page.' />

        <h2 id='paper-search'>Search by Paper</h2>
        <p>Combine syllabus, session, and paper codes to jump straight to a specific exam.</p>
        <table className='example-table'>
          <thead>
            <tr>
              <th>Search</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className='code-col'>9700</td>
              <td>Biology subject page</td>
            </tr>
            <tr>
              <td className='code-col'>9700 s22</td>
              <td>Biology May/June 2022</td>
            </tr>
            <tr>
              <td className='code-col'>9700 s22 qp</td>
              <td>Biology May/June 2022 Question Papers</td>
            </tr>
            <tr>
              <td className='code-col'>9700 s22 qp 42</td>
              <td>Biology May/June 2022 Paper 4 Variant 2</td>
            </tr>
          </tbody>
        </table>

        <h2 id='document-code'>Search by Document Code</h2>
        <p>You may simply enter the code found in the footer of a paper.</p>
        <CopyBlock code='0470/13/M/J/17' desc='History May/June 2017 paper 13' />

        <h2 id='keyword-search'>Search by Keywords</h2>
        <p>Perform text searches to quickly locate questions across all documents.</p>
        <CopyBlock code='Great Depression' desc="Finds occurrences of 'Great Depression'." />

        <details className='advanced-search'>
          <summary>Advanced Keyword Filtering</summary>
          <div style={{ marginTop: '1rem' }}>
            <p>Limit your keyword search to a specific subject or paper by prepending the syllabus and paper code.</p>
            <CopyBlock code='0470 Great Depression' desc='Questions about the Great Depression in IG history.' />
            <CopyBlock code='0470 p2 Great Depression' desc='Questions about the Great Depression in Paper 2 of IG history.' />
          </div>
        </details>

        <h2 id='tips'>Search Tips</h2>
        <div className='tips-section'>
          <div className='card'>
            <div className='icon'>💡</div>
            <p className='content'>Use keywords if you remember a specific question but forgot the year.</p>
          </div>
          <div className='card'>
            <div className='icon'>💡</div>
            <p className='content'>Use syllabus numbers (e.g. 9700) for faster searches instead of subject names.</p>
          </div>
          <div className='card'>
            <div className='icon'>💡</div>
            <p className='content'>Use the visual Filters Panel instead of typing complex syntax to narrow down results.</p>
          </div>
          <div className='card'>
            <div className='icon'>💡</div>
            <p className='content'>Examiner Reports and Grade Thresholds are disabled by default. Enable them in the filters to see them.</p>
          </div>
        </div>

      </div>
    )
  }
}
