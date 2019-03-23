import { AppState } from './appstate.js'
import * as React from 'react'
const wordSpliter = /[^a-zA-Z]/

export default class IndexContent extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      tokens: []
    }
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  componentDidMount () {
    this.updateToken()
  }
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.content !== this.props.content || nextProps.search !== this.props.search || nextState.tokens !== this.state.tokens
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.content !== this.props.content || nextProps.search !== this.props.search) {
      this.updateToken(nextProps)
    }
  }
  updateToken (prop = this.props) {
    if (!prop.content) {
      this.setState({tokens: []})
    }
    this.setState({tokens: this.computeTokens(prop)})
  }
  computeTokens (prop = this.props) {
    return this.mergeAlikeTokens(this.cutUseful(this.tokenize(this.props.content.trim().replace(/[\s\u0001-\u0020]+/g, ' '), (this.props.search || '').split(wordSpliter)), 150))
  }
  render () {
    let tokens = this.state.tokens
    if (this.state.server)
      tokens = this.computeTokens()
    return (
      <div className='indexcontent'>
        {tokens.map((token, index) => (
          <span className={token.highlight ? 'highlight' : ''} key={index}>{token.str}</span>
        ))}
      </div>
    )
  }
  tokenize (str, highlights) {
    highlights = highlights.map(x => x.toLowerCase())
    let results = []
    function last () {
      return results[results.length - 1]
    }
    for (let i = 0; i < str.length; i ++) {
      let currentChar = str.charAt(i)
      let doSplit = wordSpliter.test(currentChar)
      if (doSplit) {
        if (results.length > 0) {
          let lastPart = last()
          if (lastPart.str === '') {
            results.pop()
          } else if (lastPart.str.length > 0) {
            lastPart.highlight = (highlights.indexOf(lastPart.str.toLowerCase()) >= 0)
          }
        }
        results.push({
          str: currentChar
        }, {
          str: ''
        })
      } else {
        if (results.length === 0) {
          results.push({
            str: currentChar
          })
        } else {
          last().str += currentChar
        }
      }
    }
    return results
  }
  cutUseful (tokens, maxLength) {
    let highlightDistances = []
    let lastDistance = 0
    for (let i = 0; i < tokens.length; i ++) {
      let current = tokens[i]
      if (current.highlight) {
        highlightDistances.push({
          dist: lastDistance,
          till: i
        })
        lastDistance = 0
      } else {
        lastDistance ++
      }
    }
    let beginChoose = highlightDistances.map(hld => {
      return {
        begin: hld.till,
        highligtCount: tokens.slice(hld.till, hld.till + maxLength).filter(tk => tk.highlight).length
      }
    }).sort((a, b) => Math.sign(b.highligtCount - a.highligtCount))[0]
    if (!beginChoose) {
      return tokens.slice(0, maxLength)
    } else {
      return tokens.slice(Math.min(beginChoose.begin, Math.max(0, tokens.length - maxLength)), beginChoose.begin + maxLength)
    }
  }
  mergeAlikeTokens (tokens) {
    let results = []
    for (let i = 0; i < tokens.length; i ++) {
      let current = tokens[i]
      if (results.length === 0) {
        results.push(current)
      } else {
        let last = results[results.length - 1]
        if (!last.highlight === !current.highlight || /^\s+$/.test(current.str)) {
          last.str += current.str
        } else {
          results.push(current)
        }
      }
    }
    return results
  }
}
