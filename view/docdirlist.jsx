const React = require('react')

class DocDirList extends React.Component {
  render () {
    return (
      <div className='docdirlist'>
        {!this.props.dirJson && !this.props.dirError
          ? (
            <div className='msg'>Loading</div>
          )
          : null}
        {this.props.dirError
          ? (
            <div className='msg'>Error: {this.props.dirError.toString()}, reloading&hellip;</div>
          )
          : null}
        {this.props.dirJson
          ? (
            <div>
              <ul>
                {Array.isArray(this.props.dirJson.dirs) && !this.props.dirJson.er ? this.props.dirJson.dirs.map((question, ii) =>
                  <li key={ii} onClick={evt => this.props.onSelect && this.props.onSelect(question, ii)}>
                    <span className='qn'><span>#</span>{question.qN}</span>
                    <span className='qt'>{question.qT}</span>
                    &nbsp;
                    <span className='page'>( p{question.page + 1} )</span>
                  </li>
                ) : null}
                {this.props.dirJson.er ? this.props.dirJson.papers.map((paperDir, ii) => (
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
              {Array.isArray(this.props.dirJson.dirs) && this.props.dirJson.dirs.length === 0
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
