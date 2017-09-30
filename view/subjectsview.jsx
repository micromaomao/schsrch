const React = require('react')
const AppState = require('./appstate.js')
const SubjectData = require('./CIESubjects.data.js')
const Feedback = require('./feedback.jsx')
const FetchErrorPromise = require('./fetcherrorpromise.js')

class SubjectsView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
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
    let subjFunc = subj => {
      let aggItem = agg ? agg.find(g => g._id === subj.id) : null
      return (
        <li key={subj.id}>
          <a
            href={`/search/?as=page&query=${subj.id}`}
            onClick={this.handleQuery.bind(this, subj.id)}>
              {subj.level} {subj.name} ({subj.id})
          </a>
          {aggItem ? (
            <span className='count'>
              &nbsp;({aggItem.totalPaper})
            </span>
          ) : null}
          {aggItem && aggItem.times && aggItem.times.length > 0 ? (
            <div className='times'>
              {aggItem.times.map(t => {
                return (
                  <a key={t} href={`/search/?as=page&query=${encodeURIComponent(`${subj.id} ${t}`)}`}
                    onClick={this.handleQuery.bind(this, `${subj.id} ${t}`)}>&nbsp;{t}&nbsp;</a>
                )
              })}
            </div>
          ) : null}
        </li>
      )
    }
    return (
      <div className='subjects'>
        <div className='return'>
          <a href='/' onClick={this.handleHome}>Return to search</a>
        </div>
        <p>
          These {SubjectData.length} subjects are supported and continuously updated.
          If you didn't find what you need, you can&nbsp;
          {AppState.getState().serverrender ? (
            'enable JavaScript and request to add it with feedback, or contact the site owner in person if you know them'
          ) : (
            <a onClick={evt => Feedback.show('/subjects/')}>request to add it</a>
          )}.
        </p>
        <h2>IGCSE</h2>
        <ul>
          {SubjectData.filter(x => x.level === 'IGCSE').map(subjFunc)}
        </ul>
        <h2>AS and A level</h2>
        <ul>
          {SubjectData.filter(x => x.level === 'A/s').map(subjFunc)}
        </ul>
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

module.exports = SubjectsView
