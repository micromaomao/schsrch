const React = require('react')
const AppState = require('./appstate.js')
const SubjectData = require('./CIESubjects.data.js')
const Feedback = require('./feedback.jsx')

class SubjectsView extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
    this.handleHome = this.handleHome.bind(this)
  }
  render () {
    let subjFunc = subj => {
      return (
        <li key={subj.id}>
          <a
            href={`https://schsrch.xyz/search/?as=page&query=${subj.id}`}
            onClick={this.handleSubjectSelect.bind(this, subj.id)}>
              {subj.level} {subj.name} ({subj.id})
          </a>
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

  handleSubjectSelect (sid, evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'query', query: sid})
    AppState.dispatch({type: 'home'})
  }
  handleHome (evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'home'})
  }
}

module.exports = SubjectsView
