const React = require('react')
const CIESubjects = require('./CIESubjects.js')
const AppState = require('./appstate.js')
const AnimatorReactComponent = require('./animatorReactComponent.jsx')
import IconData from 'raw-loader!./icon.svg'
import BannerDrawing from 'raw-loader!./banner.svg'

class SearchBar extends AnimatorReactComponent {
  constructor (props) {
    super(props)
    this.state = {
      query: '', // The string in the input box
      lastQueryChange: 0, // timestamp
      loadingStart: null, // timestamp
      lastTimeout: null, // return of setTimeout
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
    this.handleQueryChange = this.handleQueryChange.bind(this)
    this.handleKey = this.handleKey.bind(this)
    this.handleAppStateUpdate = this.handleAppStateUpdate.bind(this)
  }
  shouldShowLoading () {
    let querying = AppState.getState().querying
    return querying && querying.loading
  }
  componentDidMount () {
    if (AppState.getState().querying) {
      let q = AppState.getState().querying.query
      if (!q) return
      this.setState({
        query: q,
        lastQuerySubmited: q,
        lastQueryChange: Date.now()
      })
    }
    this.setState({loadingStart: this.shouldShowLoading() ? Date.now() : null})
    this.unsub = AppState.subscribe(this.handleAppStateUpdate)
  }
  handleAppStateUpdate () {
    let showLoading = this.shouldShowLoading()
    if (showLoading && this.state.loadingStart === null) {
      this.setState({loadingStart: Date.now()})
    } else if (!showLoading && this.state.loadingStart !== null) {
      this.setState({loadingStart: null})
    }

    let { querying } = AppState.getState()
    if (querying && querying.query !== this.state.lastQuerySubmited && !this.state.focus) {
      this.setQueryImmediate(querying.query)
    }
  }
  handleQueryChange (evt, immediate = false) { // called by onChange
    let val = evt.target.value
    if (this.state.lastTimeout) {
      clearTimeout(this.state.lastTimeout)
    }
    this.setState({query: val, lastQueryChange: Date.now(), lastTimeout: setTimeout(() => {
      let lastQuerySubmited = this.state.lastQuerySubmited
      if (val !== lastQuerySubmited)
        this.props.onQuery && this.props.onQuery(val)
      this.setState({lastTimeout: null, lastQuerySubmited: val})
    }, immediate ? 1 : this.inputDelay), subjectHintSelect: null})
  }
  clear () {
    this.setQueryImmediate('')
    this.focus()
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
    this.focus()
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
  componentWillUnmount () {
    this.blur()
    if (this.state.lastTimeout) {
      clearTimeout(this.state.lastTimeout)
    }
    this.unsub()
    this.unsub = null
  }
  chooseSubject (id) {
    this.setQueryImmediate(id + ' ')
    setTimeout(() => this.input.focus(), 1)
  }
  setQueryImmediate (query) {
    this.handleQueryChange({
      target: {
        value: query
      }
    }, true)
  }
  searchSubject (query) {
    return CIESubjects.search(query.replace(/^\s+/, ''))
  }
  calculateSubjectHintSelect (select, length) {
    select = select % length
    if (select < 0) {
      select = length + select
    }
    return select
  }
  render () {
    let hideBanner = !this.state.server && !this.props.big && !this.props.alwaysShowIcon && window.innerWidth <= 800
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
      this.nextFrameForceUpdate()
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
      this.nextFrameForceUpdate()
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
    let renderT = (
      <div className={this.props.big ? 'searchbar big' : 'searchbar small'}>
        <div className={'bannerContain' + (hideBanner ? ' hide' : '')} key='bannerContain'>
          <img className='icon' src={'data:image/svg+xml,' + encodeURIComponent(IconData)} alt='SchSrch' />
          <img className='banner' key='banner' src={'data:image/svg+xml,' + encodeURIComponent(BannerDrawing)} alt='SchSrch' />
        </div>
        <div className={'inputContain' + (hideBanner ? ' hidebanner' : '')}>
          <div className='inputPositionWrap'>
            <input
              className={'querybox' + (this.state.server ? ' border' : '')}
              type='text'
              ref={f => this.input = f}
              value={this.state.query}
              onChange={this.handleQueryChange}
              onFocus={evt => this.focus(true)}
              onBlur={evt => this.blur(true)}
              onKeyDown={this.handleKey}
              name='query'
              autoComplete='off' />
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
  focus (dryRun) {
    if (!dryRun) this.input.focus()
    this.setState({focus: true})
  }
  blur (dryRun) {
    if (!dryRun) this.input.blur()
    this.setState({focus: false, subjectHintSelect: null})
  }
}

module.exports = SearchBar
