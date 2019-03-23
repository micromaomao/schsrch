import * as React from 'react'
import { AppState } from './appstate.js'

class SearchLink extends React.Component {
  constructor (props) {
    super(props)
    this.handleSearch = this.handleSearch.bind(this)
  }

  render () {
    return (
      <span className='searchlink'>
        <a className='q' onClick={this.handleSearch} href={`/search/?as=page&query=${encodeURIComponent(this.props.q)}`}>
          {this.props.q}
        </a>
        {this.props.e ? (
          <span className='e'>{this.props.e}</span>
        ) : null}
      </span>
    )
  }

  handleSearch (evt) {
    evt.preventDefault()
    AppState.dispatch({type: 'query', query: this.props.q})
  }
}

export default class Help extends React.Component {
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
        <h2>Search syntax for text search</h2>
        <h3>Without filter</h3>
        <p>
          Performs a simple text search. Examples:
          <SearchLink q='What was decided at the Yalta Conference of February 1945?' />
          <SearchLink q='Who was more to blame for starting the Cold War, the USA or the USSR?' />
        </p>
        <p>
          It is also useful to search for keywords to quickly review something. Example:
          <SearchLink q='Great Depression' />
        </p>
        <h3>Filters</h3>
        <p>
          Sometimes (especially when searching for keywords) it is useful to limit the result to a single
          subject. This can be done by adding the syllabus number before all search terms. Example:
          <SearchLink q='0470 Great Depression' e='Questions about the Great Depression in IG history' />
        </p>
        <p>
          You can also further limit your search to a specific paper number by adding pX after the syllabus
          code. Example:
          <SearchLink q='0470 p2 Great Depression' e='Questions about the Great Depression in paper 2 of IG history' />
        </p>
      </div>
    )
  }
}
