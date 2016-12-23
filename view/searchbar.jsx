const React = require('react')
const URL_LOGO = require('./logo.png')
const CIESubjects = require('./CIESubjects.js')
const SearchPrompt = require('./searchprompt.jsx')

class SearchBar extends React.Component {
  constructor () {
    super()
    this.state = {
      query: '',
      lastQueryChange: 0,
      loadingStart: null,
      lastTimeout: null,
      lastQuerySubmited: '',
      focus: true,
      subjectHintSelect: null
    }
    this.inputDelay = 1000
    this.handlePlaceholderClick = this.handlePlaceholderClick.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
    this.handleKey = this.handleKey.bind(this)
  }
  handlePlaceholderClick (evt) {
    evt.preventDefault()
    this.input.focus()
  }
  handleQueryChange (evt) {
    let val = evt.target.value
    if (this.state.lastTimeout) {
      clearTimeout(this.state.lastTimeout)
    }
    this.setState({query: val, lastQueryChange: Date.now(), lastTimeout: setTimeout(() => {
      if (val !== this.state.lastQuerySubmited)
        this.props.onQuery && this.props.onQuery(val.trim())
      this.setState({lastTimeout: null, lastQuerySubmited: val})
    }, this.inputDelay), subjectHintSelect: null})
  }
  handleKey (evt) {
    if (evt.key === 'ArrowDown' || evt.keyCode === 40) {
      evt.preventDefault()
      this.setState({subjectHintSelect: this.state.subjectHintSelect !== null ? this.state.subjectHintSelect + 1 : 0})
    }
    if (evt.key === 'ArrowUp' || evt.keyCode === 38) {
      evt.preventDefault()
      this.setState({subjectHintSelect: this.state.subjectHintSelect !== null ? this.state.subjectHintSelect - 1 : -1})
    }
    if (evt.key === 'Enter' || evt.keyCode === 13) {
      evt.preventDefault()
      this.selectThisSubject()
    }
    this.input.focus()
  }
  selectThisSubject () {
    if (this.state.subjectHintSelect === null || !this.state.focus) {
      return
    }
    let srs = this.searchSubject(this.state.query)
    let sr = srs[this.calculateSubjectHintSelect(this.state.subjectHintSelect, srs.length)]
    if (!sr) return
    this.chooseSubject(sr.id)
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.loading !== this.props.loading) {
      this.setState({loadingStart: nextProps.loading ? Date.now() : null})
    }
  }
  chooseSubject (id) {
    this.setQuery(id + ' ')
    setTimeout(() => this.input.focus(), 1)
  }
  setQuery (query) {
    this.handleQueryChange({
      target: {
        value: query
      }
    })
  }
  searchSubject (query) {
    return CIESubjects.search(query.replace(/^\s+/, ''))
  }
  calculateSubjectHintSelect(select, length) {
    select = select % length
    if (select < 0) {
      select = length + select
    }
    return select
  }
  render () {
    let hideLogo = !this.props.big && window.innerWidth <= 800
    let strokeFillStyle = {}
    let lastChangedDur = Date.now() - this.state.lastQueryChange
    let loadingDur = Date.now() - this.state.loadingStart
    let loadAnimationCycle = 1000
    if (this.state.loadingStart !== null) {
      let ani = (loadingDur % loadAnimationCycle) / loadAnimationCycle
      if (ani <= 0.5) {
        strokeFillStyle.width = (Math.round((ani / 0.5) * 100 * 10) / 10) + '%'
        strokeFillStyle.marginLeft = null
      } else {
        strokeFillStyle.width = (Math.round((1 - (ani - 0.5) / 0.5) * 100 * 10) / 10) + '%'
        strokeFillStyle.marginLeft = (Math.round(((ani - 0.5) / 0.5) * 100 * 10) / 10) + '%'
      }
      requestAnimationFrame(() => {this.forceUpdate()})
    } else if (this.state.lastTimeout !== null && lastChangedDur <= this.inputDelay) {
      let prog = Math.pow(lastChangedDur / this.inputDelay, 5)
      strokeFillStyle.width = (Math.round(prog * 100 * 10) / 10) + '%'
      if (this.props.big)
        strokeFillStyle.marginLeft = (Math.round((1 - prog) / 2 * 100 * 10) / 10) + '%'
      else
        strokeFillStyle.marginLeft = null
      requestAnimationFrame(() => {this.forceUpdate()})
    } else {
      strokeFillStyle.width = null
      strokeFillStyle.marginLeft = null
    }
    let subjectHint = null
    let subjectSearchRes = this.state.focus ? this.searchSubject(this.state.query) : null
    if (subjectSearchRes && subjectSearchRes.length > 0) {
      subjectSearchRes = subjectSearchRes.slice(0, 6)
      let sjHintSelect = this.state.subjectHintSelect
      if (sjHintSelect !== null) {
        sjHintSelect = this.calculateSubjectHintSelect(sjHintSelect, subjectSearchRes.length)
      }
      let getFocus = evt => {
        this.input.focus()
        evt.preventDefault()
      }
      subjectHint = (
        <div className='subjecthints'>
          {subjectSearchRes.map((sj, index) => {
            let thisSelected = index === sjHintSelect
            return (
              <div className={'subject' + (thisSelected ? ' select' : '')} key={sj.id}
                onClick={evt => this.chooseSubject(sj.id)}
                onTouchStart={getFocus} onTouchEnd={evt => {
                  getFocus(evt)
                  this.chooseSubject(sj.id)
                }} onMouseDown={getFocus} onMouseUp={getFocus}>
                <span className='id'>({sj.id})</span>
                &nbsp;
                <span className='level'>({sj.level})</span>
                &nbsp;
                <span className='name'>{sj.name}</span>
              </div>
          )
          })}
        </div>
      )
    }
    return (
      <div className={this.props.big ? 'searchbar big' : 'searchbar small'}>
        <div className={'logoContain' + (hideLogo ? ' hide' : '')}>
          <img className='logo' src={URL_LOGO} />
        </div>
        <div className={'inputContain' + (hideLogo ? ' hw' : '')}>
          <input
            type='text'
            ref={f => this.input = f}
            value={this.state.query}
            onChange={this.handleQueryChange}
            onFocus={evt => this.setState({focus: true})}
            onBlur={evt => this.setState({focus: false, subjectHintSelect: null})}
            onKeyDown={this.handleKey} />
          {this.props.big
            ? <div className={'placeholder' + (this.state.query !== '' ? ' hide' : '')} onMouseDown={this.handlePlaceholderClick} onTouchStart={this.handlePlaceholderClick}>... Type here ...</div>
            : null}
          <div className='stroke'>
            <div className='fill' style={strokeFillStyle} />
          </div>
          <SearchPrompt query={this.state.query} />
          {subjectHint}
        </div>
      </div>
    )
  }
}

module.exports = SearchBar
