const React = require('react')
const CIESubjects = require('./CIESubjects.js')
const AppState = require('./appstate.js')
const URL_BANNER = require('./banner.png')
const URL_BANNER_SMALL = require('./banner-small.png')

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
    if (AppState.getState().serverrender) {
      this.state.server = true
      let querying = AppState.getState().querying
      if (querying)
        this.state.query = querying.query
    }
    this.inputDelay = 1000
    this.handlePlaceholderClick = this.handlePlaceholderClick.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
    this.handleKey = this.handleKey.bind(this)
  }
  componentDidMount () {
    this.setQuery(this.props.setQuery || '')
  }
  handlePlaceholderClick (evt) {
    evt.preventDefault()
    this.input.focus()
  }
  handleQueryChange (evt, immediate = false) {
    let val = evt.target.value
    if (this.state.lastTimeout) {
      clearTimeout(this.state.lastTimeout)
    }
    this.setState({query: val, lastQueryChange: Date.now(), lastTimeout: setTimeout(() => {
      if (val !== this.state.lastQuerySubmited)
        this.props.onQuery && this.props.onQuery(val)
      this.setState({lastTimeout: null, lastQuerySubmited: val})
    }, immediate ? 1 : this.inputDelay), subjectHintSelect: null})
  }
  clear () {
    this.setQuery('')
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
    if (this.props.setQuery !== nextProps.setQuery) {
      this.setQuery(nextProps.setQuery || '')
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
    }, true)
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
    let hideBanner = !this.state.server && !this.props.big && window.innerWidth <= 800
    let strokeFillStyle = {}
    let lastChangedDur = Date.now() - this.state.lastQueryChange
    let loadingDur = Date.now() - this.state.loadingStart
    let loadAnimationCycle = 1000
    if (this.state.loadingStart !== null) {
      let ani = (loadingDur % loadAnimationCycle) / loadAnimationCycle
      if (ani <= 0.5) {
        // Stretch out from left
        strokeFillStyle.transform = `translateX(-${Math.round((1 - ani / 0.5) * 1000) / 10}%)`
      } else {
        // Stretch in from right
        strokeFillStyle.transform = `translateX(${Math.round((ani / 0.5 - 1) * 1000) / 10}%)`
      }
      strokeFillStyle.willChange = 'transform'
      requestAnimationFrame(() => {this.forceUpdate()})
    } else if (this.state.lastTimeout !== null && lastChangedDur <= this.inputDelay) {
      let prog = Math.pow(lastChangedDur / this.inputDelay, 5)
      if (this.props.big) {
        // Stretch out from center
        strokeFillStyle.transform = `scaleX(${Math.round(prog * 1000) / 1000})`
      } else {
        // Stretch out from left
        strokeFillStyle.transform = `translateX(-${Math.round((1 - prog) * 1000) / 10}%)`
      }
      strokeFillStyle.willChange = 'transform'
      requestAnimationFrame(() => {this.forceUpdate()})
    } else {
      strokeFillStyle.transform = `translateX(0)`
    }
    let subjectHint = null
    let subjectSearchRes = this.state.focus ? this.searchSubject(this.state.query) : null
    if (!this.state.server && subjectSearchRes && subjectSearchRes.length > 0) {
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
    const placeholderText = '... Type here ...'
    let renderT = (
      <div className={this.props.big ? 'searchbar big' : 'searchbar small'}>
        <div className={'bannerContain' + (hideBanner ? ' hide' : '')}>
          <img className='banner' src={this.props.big ? URL_BANNER : URL_BANNER_SMALL} alt='SchSrch' />
        </div>
        <div className={'inputContain' + (hideBanner ? ' hidebanner' : '')}>
          <div className='inputPositionWrap'>
            <input
              className={'querybox' + (this.state.server ? ' border' : '')}
              type='text'
              ref={f => this.input = f}
              value={this.state.query}
              placeholder={this.state.server && !this.state.query ? placeholderText : null}
              onChange={this.handleQueryChange}
              onFocus={evt => {
                this.setState({focus: true})
                AppState.dispatch({type: 'queryFocus'})
              }}
              onBlur={evt => {
                this.setState({focus: false, subjectHintSelect: null})
                AppState.dispatch({type: 'queryUnfocus'})
              }}
              onKeyDown={this.handleKey}
              name='query'
              autoComplete='off' />
            {this.props.big && !this.state.server
              ? <div className={'placeholder' + (this.state.query !== '' ? ' hide' : '')} onMouseDown={this.handlePlaceholderClick} onTouchStart={this.handlePlaceholderClick}>{placeholderText}</div>
              : null}
            {this.state.server ? null : (
              <div className='stroke'>
                <div className='fill' style={strokeFillStyle} />
              </div>
            )}
            <div className='rightWrap'>
              {this.state.server ? (
                <button className='formsubmit' type='submit'>Search</button>
              ) : null}
              {this.state.query.length && !this.state.server
                ? (
                  <div className='clearInput' onClick={evt => this.clear()}>
                    <svg className="icon ii-c"><use href="#ii-c" xlinkHref="#ii-c"></use></svg>
                  </div>
                )
                : null}
            </div>
          </div>
          {subjectHint}
        </div>
      </div>
    )
    if (this.state.server) {
      return (
        <form action='/search' method='get'>
          <input type='hidden' name='as' value='page' />
          {renderT}
        </form>
      )
    }
    return renderT
  }
}

module.exports = SearchBar
