import * as React from 'react'
import CIESubjects from './CIESubjects.js'
import PaperUtils from './paperutils.js'
import { AppState } from './appstate.js'

export default class SearchPrompt extends React.Component {
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
        let requestFeedback = null
        if (!AppState.getState().serverrender) {
          requestFeedback = (<a onClick={evt => AppState.dispatch({type: 'showFeedback', search: querySubj + ' << unsupported syllabus'})}>Request to add</a>)
        }
        prompt = (<div className='error'>Syllabus {querySubj} isn't supported. {requestFeedback}</div>)
      } else if (query.match(/^\d{4}$/)) {
        prompt = (`${subj.level} ${subj.name}: When? (s16, w15, etc.)`)
      } else if (tiMatch = query.match(/^\d{4}\s([a-z]\d\d)$/)) {
        prompt = (`${PaperUtils.myTimeToHumanTime(tiMatch[1])} (${tiMatch[1]}): Refine your search by adding paper number...`)
      }
    }
    return (
      prompt ? <div className={'searchprompt' + (this.props.center ? ' center' : '')}>{prompt}</div> : null
    )
  }
}
