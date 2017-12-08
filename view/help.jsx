const React = require('react')
const AppState = require('./appstate.js')

class SearchLink extends React.Component {
  constructor (props) {
    super(props)
    this.handleSearch = this.handleSearch.bind(this)
  }

  render () {
    return (
      <span className='searchlink'>
        <span className='q' onClick={this.handleSearch}>
          {this.props.q}
        </span>
        {this.props.e ? (
          <span className='e'>{this.props.e}</span>
        ) : null}
      </span>
    )
  }

  handleSearch () {
    AppState.dispatch({type: 'query', query: this.props.q})
  }
}

class Help extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <div className='schsrch-help'>
        <p>
          This should be very simple. tl;dr: type anything you want&mdash;keywords, question,
          subject, etc. Just try it out in the box above. Continue reading if you want to know
          more detail.
        </p>
        <h2>Search syntax for specific paper</h2>
        <p>
          For a more technical overview, refer to source code <a href='https://github.com/micromaomao/schsrch/blob/master/lib/doSearch.js'><code>lib/doSearch.js</code></a> or
          test file <a href='https://github.com/micromaomao/schsrch/blob/master/test/direct-search.js'><code>test/direct-search.js</code></a>.
        </p>
        <h3>Case 0: <code>&lt;subject name&gt;</code></h3>
        <p>
          This will do a text search, but will also give you hints for syllabus number when your cursor is on the search box.
        </p>
        <h3>Case 1: <code>&lt;syllabus number&gt;</code></h3>
        <p>
          This shows a subject page, which contains a list of test seasons available for viewing, and some instructions.
        </p>
        <p>
          Example:
          <SearchLink q='0470' e='IG history subject page'/>
        </p>
        <h3>Case 2: <code>&lt;syllabus number&gt; [time indicator] [paper][variant] [type]</code></h3>
        <p>
          Search for papers for the subject you want, limiting your search to a season (if given), and/or limiting your
          search to a paper or paper-variant (if given), and/or limiting your search to a specific type of stuff (if given, such
          as qp or ms).
        </p>
        <p>
          Examples:
          <SearchLink q='0470 s17' e='Search for all IG history papers for May/June 2017' />
          <SearchLink q='0470 s17 1' e='Search for all paper 1 in IG history for May/June 2017' />
          <SearchLink q='0470 s17 qp' e='Search for all question papers in IG history for May/June 2017' />
          <SearchLink q='0470 s17 1 qp' e='Search for all question papers for paper 1 in IG history for May/June 2017' />
          <SearchLink q='0470 s17 13' e='Search for paper 13 in IG history for May/June 2017' />
          <SearchLink q='0470 1' e='Search for all paper 1 in IG history for all time (unlikely to success, just for demo)' />
        </p>
        <h3>Case 3: <code>oooo/00/o/o/00</code></h3>
        <p>
          You may simply enter the code in the footer of a paper to search for that paper. Example:
          <SearchLink q='0470/13/M/J/17' e='History May/June 2017 paper 13' />
        </p>
      </div>
    )
  }
}

module.exports = Help
