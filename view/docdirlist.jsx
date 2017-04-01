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
                {this.props.dirJson.map(question =>
                  <li key={question._id} onClick={evt => this.props.onSelect && this.props.onSelect(question)}>
                    <span className='qn'><span>#</span>{question.qN}</span>
                    <span className='qt'>{question.qT}</span>
                    &nbsp;
                    <span className='page'>( p{question.page + 1} )</span>
                  </li>
                )}
              </ul>
              {this.props.dirJson.length === 0
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
