const React = require('react')
const Subjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')

class PaperSet extends React.Component {
  constructor () {
    super()
    this.state = {}
  }
  render () {
    let set = this.props.paperSet
    let subject = Subjects.findExactById(set.subject)
    set.types = set.types.sort((a, b) => PaperUtils.funcSortType(a.type, b.type))
    return (
      <div className='set'>
        <div className='setname'>
          {subject
            ? <span className='subject'>
                <span className='level'>({subject.level})</span>
                &nbsp;
                {subject.name}
              </span>
            : <span className='subject'>{set.subject}???</span>}
          &nbsp;
          <span className='time'>{PaperUtils.myTimeToHumanTime(set.time)}</span>
          {set.paper !== 0 || set.variant !== 0
            ? (<span>
                &nbsp;paper&nbsp;
                <span className={'paper' + (set.paper === 0 ? ' meta' : '')}>{set.paper || '(meta)'}</span>
              </span>)
            : null}
          {set.variant !== 0
            ? (<span>
                &nbsp;variant&nbsp;
                <span className='variant'>{set.variant}</span>
              </span>)
            : null}
        </div>
        <div className='files'>
          {set.types.map(file => (
            <div className='file' key={file._id} onClick={evt => this.openFile(file._id)}>
              <span className='typename'>{PaperUtils.capitalizeFirst(PaperUtils.getTypeString(file.type))}</span>
              &nbsp;
              <span className='desc'>
                <span className='pagenum'>{file.numPages} pages</span>
                ,&nbsp;
                <span className='filetype'>{file.fileType}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  openFile (_id) {
    window.open('/fetchDoc/' + encodeURIComponent(_id) + '/')
  }
}

module.exports = PaperSet
