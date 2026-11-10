/* eslint-disable lines-between-class-members, react/no-deprecated, object-curly-spacing, no-control-regex, curly, prefer-const, space-unary-ops */
import { AppState } from './appstate.js'
import * as React from 'react'
const wordSpliter = /[^a-zA-Z]/

export default class IndexContent extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      tokens: []
    }
    if (AppState.getState().serverrender) {
      this.state.server = true
    }
  }
  componentDidMount() {
    if (this.props.content && !this.props.highlights) this.updateToken()
  }
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.content !== this.props.content || nextProps.search !== this.props.search || nextState.tokens !== this.state.tokens || nextProps.highlights !== this.props.highlights
  }
  componentWillReceiveProps(nextProps) {
    if ((nextProps.content !== this.props.content || nextProps.search !== this.props.search) && !nextProps.highlights) {
      this.updateToken(nextProps)
    }
  }
  updateToken(prop = this.props) {
    if (!prop.content) {
      this.setState({ tokens: [] })
    }
    this.setState({ tokens: this.computeTokens(prop) })
  }
  computeTokens(prop = this.props) {
    if (!prop.content) return []
    return this.mergeAlikeTokens(this.cutUseful(this.tokenize(prop.content.trim().replace(/[\s\u0001-\u0020]+/g, ' '), (prop.search || '').split(wordSpliter)), 150))
  }
  parseSnippet(str) {
    let parts = str.split(/(<mark>|<\/mark>)/g)
    let isHighlight = false
    let elements = []
    for (let part of parts) {
      if (part === '<mark>') isHighlight = true
      else if (part === '</mark>') isHighlight = false
      else {
        elements.push({ str: part, highlight: isHighlight })
      }
    }
    return elements
  }
  cleanOCRNoise(str) {
    let s = str
    s = s.replace(/DO NOT WRITE IN THIS MARGIN/gi, '')
    s = s.replace(/\[Turn over/gi, '')
    s = s.replace(/BLANK PAGE/gi, '')
    s = s.replace(/Cambridge Assessment International Education/gi, '')
    s = s.replace(/Cambridge International Examinations/gi, '')
    s = s.replace(/UCLES \d{4}/gi, '')
    s = s.replace(/©\s\d{4}/gi, '')
    return s.replace(/\s+/g, ' ').trim()
  }
  render() {
    if (this.props.highlights && this.props.highlights.length > 0) {
      return (
        <div className='indexcontent snippets-container'>
          {this.props.highlights.map((hl, i) => {
            let cleanHl = this.cleanOCRNoise(hl)
            if (!cleanHl) return null
            let tokens = this.parseSnippet(cleanHl)
            return (
              <React.Fragment key={i}>
                <div className='snippet' style={{ lineHeight: '1.6', color: 'var(--text-color)' }}>
                  {tokens.map((token, j) => (
                    <span className={token.highlight ? 'highlight' : ''} key={j}>{token.str}</span>
                  ))}
                </div>
                {i < this.props.highlights.length - 1 ? (
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color, rgba(128, 128, 128, 0.2))', margin: '12px 0', opacity: 0.5 }} />
                ) : null}
              </React.Fragment>
            )
          })}
        </div>
      )
    }

    let tokens = this.state.tokens
    if (this.state.server && this.props.content && !this.props.highlights)
      tokens = this.computeTokens()

    if (!this.props.content && (!this.props.highlights || this.props.highlights.length === 0)) {
      return null
    }

    return (
      <div className='indexcontent'>
        {tokens.map((token, index) => (
          <span className={token.highlight ? 'highlight' : ''} key={index}>{token.str}</span>
        ))}
      </div>
    )
  }
  tokenize(str, highlights) {
    highlights = highlights.map(x => x.toLowerCase())
    let results = []
    function last() {
      return results[results.length - 1]
    }
    for (let i = 0; i < str.length; i++) {
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
  cutUseful(tokens, maxLength) {
    let highlightDistances = []
    let lastDistance = 0
    for (let i = 0; i < tokens.length; i++) {
      let current = tokens[i]
      if (current.highlight) {
        highlightDistances.push({
          dist: lastDistance,
          till: i
        })
        lastDistance = 0
      } else {
        lastDistance++
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
  mergeAlikeTokens(tokens) {
    let results = []
    for (let i = 0; i < tokens.length; i++) {
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
