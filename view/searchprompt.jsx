const React = require('react')
const CIESubjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')
const Feedback = require('./feedback.jsx')

class SearchPrompt extends React.Component {
  constructor () {
    super()
    this.state = {}
  }
  render () {
    let query = this.props.query.toLowerCase().trim()
    let prompt = null
    if (query === '') {
      prompt = ('A syllabus, number or name, or any text to search...')
    } else if (query.match(/^\d{4}(\s|$)/)) {
      let querySubj = query.match(/^\d{4}/)[0]
      let subj = CIESubjects.findExactById(querySubj)
      let tiMatch = null
      if (!subj) {
        prompt = (<div className='error'>Syllabus {querySubj} isn't supported. <a onClick={evt => Feedback.show(querySubj + ' << unsupported syllabus')}>Request to add</a></div>)
      } else if (query.match(/^\d{4}$/)) {
        prompt = (`${subj.level} ${subj.name}: When? (s16, w15, etc.)`)
      } else if (tiMatch = query.match(/^\d{4}\s([a-z]\d\d)$/)) {
        prompt = (`${PaperUtils.myTimeToHumanTime(tiMatch[1])} (${tiMatch[1]}): Refine your search by adding paper number...`)
      }
    }
    return (
      prompt ? <div className='searchprompt'>{prompt}</div> : null
    )
  }
}

module.exports = SearchPrompt
