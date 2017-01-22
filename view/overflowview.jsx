const React = require('react')
const CIESubjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')

class OverflowView extends React.Component {
  render () {
    let query = this.props.query.trim()
    if (query.match(/^\d{4}$/)) {
      let subj = CIESubjects.findExactById(query)
      let subject
      if (subj) {
        subject = (
          <div className='subject'>
            ( {subj.id} = {subj.name} )
          </div>
        )
      } else {
        subject = null
      }
      let year = new Date().getFullYear()
      let sYear = year % 100
      let demoTime = 's' + sYear
      return (
        <div className='overflow'>
          {subject}
          <p>If you know the time (season and year) of the paper you want, add it to your search like this:</p>
          <pre>{`${query} ${demoTime}`}</pre>
          <p>In this case, <span className='time'>{demoTime}</span> means the May - June exam in {year}. Other exam seasons can be expressed as:</p>
          <ul>
            {PaperUtils.shortMonths.map((sm, idx) => {
              if (sm === 'y') {
                return (
                  <li key={idx}>Specimen paper of {year}: <span className='time'>y{sYear}</span></li>
                )
              }
              let lm = PaperUtils.longMonths[idx]
              return (
                <li key={idx}>{lm} exam in {year}: <span className='time'>{sm}{sYear}</span></li>
              )
            })}
          </ul>
        </div>
      )
    } else {
      return (
        <div className='overflow'>
          Your search returned too many results. Try to be more specific…
        </div>
      )
    }
  }
}

module.exports = OverflowView
