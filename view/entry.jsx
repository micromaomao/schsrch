'use strict'

require('offline-plugin/runtime').install()

const React = require('react')
const ReactDOM = require('react-dom')

require('./layout.sass')

const SearchBar = require('./searchbar.jsx')
const Description = require('./description.jsx')

class SchSrch extends React.Component {
  constructor () {
    super()
    this.state = {
      query: ''
    }
  }
  render () {
    let noSearch = this.state.query === ''
    return (
      <div className="schsrch">
        <SearchBar ref={f => this.searchbar = f} big={noSearch} onQuery={query => this.setState({query})} />
        {noSearch
          ? <Description />
          : null}
      </div>
    )
  }
  componentDidMount () {
    this.searchbar.input.focus()
  }
}

let ui = ReactDOM.render(
  <SchSrch />,
  document.getElementsByClassName('react-root')[0]
)

window.addEventListener('resize', evt => {
  ui.forceUpdate()
})
