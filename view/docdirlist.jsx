const React = require('react')

class DocDirList extends React.Component {
  render () {
    let dir = this.props.dirJson
    return (
      <div className='docdirlist'>
        {!dir && !this.props.dirError
          ? (
            <div className='msg'>Loading</div>
          )
          : null}
        {this.props.dirError
          ? (
            <div className='msg'>Error: {this.props.dirError.toString()}, reloading&hellip;</div>
          )
          : null}
        {dir
          ? (
            <div>
              <ul>
                {dir.type === 'questions' || dir.type === 'mcqMs' ? dir.dirs.map((question, ii) =>
                  <li key={ii} onClick={evt => this.props.onSelect && this.props.onSelect(question, ii)}>
                    <span className='qn'><span>#</span>{question.qN}</span>
                    <span className='qt'>{question.qT}</span>
                    &nbsp;
                    <span className='page'>( p{question.page + 1} )</span>
                  </li>
                ) : null}
                {dir.type === 'er' ? dir.papers.map((paperDir, ii) => (
                  <li key={ii} className='erdir-paper'>
                    <a className='paper'>Paper {paperDir.pv}</a>
                    <ul>
                      {paperDir.dirs.map(d => (
                        <li>{d.qN}</li>
                      ))}
                    </ul>
                  </li>
                )) : null}
              </ul>
              {!dir.type || (dir.type === 'questions' && dir.dirs.length === 0)
                ? (
                  <div className='msg'>No question directory available.</div>
                ) : null}
            </div>
          )
          : null}
      </div>
    )
  }
}

module.exports = DocDirList
