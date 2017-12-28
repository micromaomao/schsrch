const React = require('react')
const CIESubjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')
const AppState = require('./appstate.js')
const PaperSet = require('./paperset.jsx')
const FilePreview = require('./filepreview.jsx')

class OverflowView extends React.Component {
  constructor (props) {
    super(props)
    this.handleSyClick = this.handleSyClick.bind(this)
  }
  render () {
    let query = this.props.query.trim()
    let res = this.props.response || {}
    let times = res.times || []
    let metaDocs = res.metaDocs || []
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
      if (times.length > 0) {
        demoTime = times[times.length - 1].time
        sYear = parseInt(demoTime.substr(1))
        year = '20' + sYear
      }
      let hasMonth = mstr => {
        if (times.length === 0) return true
        return times.filter(tm => tm.time[0] === mstr).length > 0
      }
      let thisSubject = subj ? `${subj.level} ${subj.name}` : 'this subject'
      let previewing = this.props.previewing
      return (
        <div className='overflow'>
          {subject}
          {subj ? (
            <p className='sy'>
              <a href={'https://cie.org.uk/' + subj.id} onClick={this.handleSyClick}>Syllabus &amp; CIE Page for {thisSubject}</a>
            </p>
          ) : null}
          <p>If you know the time (season and year) of the paper you want, add it to your search like this:</p>
          <pre>{`${query} ${demoTime}`}</pre>
          <p>In this case, <span className='time'>{demoTime}</span> means the May - June exam in {year}. Other exam seasons can be expressed as:</p>
          <ul>
            {PaperUtils.shortMonths.map((sm, idx) => {
              let hasThis = hasMonth(sm)
              if (sm === 'y') {
                if (hasThis) {
                  return (
                    <li key={idx}>Specimen paper of {year}: <span className='time'>y{sYear}</span></li>
                  )
                } else {
                  return (
                    <li key={idx} className='noinstance'><span className='time'>y{sYear}</span> means the specimen paper released in {year}, but this subject dosen't have any specimen paper.</li>
                  )
                }
              }
              let lm = PaperUtils.longMonths[idx]
              if (hasThis) {
                return (
                  <li key={idx}>{lm} exam in {year}: <span className='time'>{sm}{sYear}</span></li>
                )
              } else {
                return (
                  <li key={idx} className='noinstance'><span className='time'>{sm}{sYear}</span> means the {lm} exam in {year}, but this subject dosen't have any.</li>
                )
              }
            })}
          </ul>
          {metaDocs.length > 0 ? (
            <div>
              <p>Additional resources for {thisSubject}:</p>
              <div>
                {metaDocs.map(doc => {
                  return [
                    <PaperSet
                      key={doc._id}
                      paperSet={Object.assign({}, doc, {
                        types: [doc]
                      })}
                      current={false}
                      onOpenFile={(id, page) => {
                        AppState.dispatch({type: 'previewFile', fileId: id, page, psKey: doc._id})
                      }}
                      mini={true} />,
                      (
                        (previewing !== null && previewing.psKey === doc._id && this.props.showSmallPreview) ? (
                          <FilePreview
                            key={doc._id + '_preview'}
                            doc={previewing.id}
                            page={previewing.page}
                            highlightingDirIndex={previewing.highlightingDirIndex}
                            shouldUseFixedTop={true} />
                        ) : null
                      )
                  ]
                })}
              </div>
            </div>
          ) : null}
          {times.length > 0 ? (
            <div>
              <p>List of available exam season for {thisSubject}:</p>
              <ul className='timeslist'>
                {times.map(ss => {
                  if (AppState.getState().serverrender) {
                    return (
                      <li key={ss.time}>
                        <a href={`/search/?as=page&query=${encodeURIComponent(this.props.query + ' ' + ss.time)}`}>
                          {ss.time} <span className='count'>({ss.count})</span>
                        </a>
                      </li>
                    )
                  }
                  return (
                    <li key={ss.time} onClick={this.handleTimeClick.bind(this, ss.time)}>
                      {ss.time} <span className='count'>({ss.count})</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )
    } else {
      return (
        <div className='overflow'>
          Your search returned too many results. Try to be more specific by adding the paper number you want, for example.
        </div>
      )
    }
  }
  handleSyClick (evt) {
    evt.preventDefault()
    window.open(evt.target.href)
  }
  handleTimeClick (time, evt) {
    this.props.onChangeQuery && this.props.onChangeQuery(this.props.query + ' ' + time)
  }
}

module.exports = OverflowView
