const React = require('react')

class PaperSet extends React.Component {
  constructor () {
    super()
    this.state = {}
  }
  render () {
    let set = this.props.paperSet
    return (
      <div className='set'>
        <div className='setname'>
          <span className='subject'>{set.subject}</span>
          &nbsp;
          <span className='time'>{set.time}</span>
          &nbsp;paper&nbsp;
          <span className='paper'>{set.paper}</span>
          &nbsp;variant&nbsp;
          <span className='variant'>{set.variant}</span>
        </div>
      </div>
    )
  }
}

module.exports = PaperSet
