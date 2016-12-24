const React = require('react')
const { createStore } = require('redux')

let feedbackState = createStore(function (state = {}, action) {
  switch (action.type) {
    case 'init':
      return {show: false}
    case 'show':
      return Object.assign({}, state, {show: true, search: action.search})
    case 'hide':
      return Object.assign({}, state, {show: false, search: null})
  }
})
feedbackState.dispatch({type: 'init'})

class FeedbackFrame extends React.Component {
  constructor () {
    super()
    this.state = {
      show: false,
      topAnimationStart: 0,
      submitting: false,
      error: null,
      success: false,
      email: '',
      feedbackText: '',
      search: null
    }
    this.unsub = null
    this.updateStatus = this.updateStatus.bind(this)
    this.handleFeedbackTextChange = this.handleFeedbackTextChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleEmailChange = this.handleEmailChange.bind(this)
  }
  componentDidMount () {
    this.updateStatus()
    this.unsub = feedbackState.subscribe(this.updateStatus)
  }
  componentWillUnmount () {
    this.unsub()
    this.unsub = null
  }
  updateStatus () {
    let storeState = feedbackState.getState()
    if (storeState.show !== this.state.show) {
      this.setState({show: storeState.show, topAnimationStart: Date.now(), search: storeState.search})
    }
  }
  render () {
    let topAnimationProgress = 1 - Math.pow(1 - ((Date.now() - this.state.topAnimationStart) / 500), 3)
    let topPs = 0
    if (!this.state.show && topAnimationProgress >= 1) return null
    if (topAnimationProgress < 1) {
      if (!this.state.show) {
        topPs = topAnimationProgress
      } else {
        topPs = 1 - topAnimationProgress
      }
      requestAnimationFrame(() => this.forceUpdate())
    }
    let content = this.getContent()
    return (
      <div className='feedback' style={topPs ? {top: (Math.round(topPs * 1000) / 10) + '%'} : {}}>
        <div className='top'>
          <span className='close' onClick={evt => {
            this.setState({success: false, error: null})
            feedbackState.dispatch({type: 'hide'})
          }}>Hide</span>
          &nbsp;
          Feedback
        </div>
        <div className='content'>
          {content}
        </div>
      </div>
    )
  }
  getContent () {
    if (this.state.success) {
      return (
        <div className='success'>
          <h2>Thank you!</h2>
          <p>Your feedback had been submitted successfully.</p>
        </div>
      )
    }
    let desc = null
    if (!this.state.search) {
      desc = (
        <div>
          <h2>General feedback</h2>
          <p>If you want to report errors, use feedback button in the search result.</p>
        </div>
      )
    } else {
      desc = (
        <div>
          <h2>Search feedback</h2>
          <p>If you want to report general things like design, use feedback button from the front screen.</p>
          <p className='searchReport'>Reporting issues with search <code>{this.state.search}</code></p>
        </div>
      )
    }
    return (
      <div className='general'>
        {desc}
        <p>Provide your feedback in <b>either</b> English or Chinese. If possible, please include examples on how to improve.</p>
        <textarea onChange={this.handleFeedbackTextChange} value={this.state.feedbackText}
          placeholder='Your feedback here...' disabled={this.state.submitting} />
        <p>Email address... (Optional)</p>
        <input type='email' placeholder='someone@example.com' className='email' disabled={this.state.submitting}
          onChange={this.handleEmailChange} value={this.state.email} />
        {
          this.state.error
          ? <div className='error'>Can't submit: {this.state.error}</div>
          : null
        }
        {
          this.state.submitting
            ? <div className='submitting'>Submitting</div>
            : <div className='submit' onClick={this.handleSubmit}>Submit</div>
        }
      </div>
    )
  }
  handleFeedbackTextChange (evt) {
    let val = evt.target.value
    this.setState({feedbackText: val})
  }
  handleEmailChange (evt) {
    let val = evt.target.value
    this.setState({email: val})
  }
  handleSubmit (evt) {
    let val = this.state.feedbackText
    this.setState({submitting: true, error: null})
    let ctHeaders = new Headers()
    ctHeaders.append('Content-Type', 'application/json')
    fetch('/feedback/', {method: 'POST', body: JSON.stringify({
      email: this.state.email,
      text: this.state.feedbackText,
      search: this.state.search
    }), headers: ctHeaders}).then(res => {
      if (!res.ok) {
        res.text().then(errText => {
          this.setState({submitting: false, error: errText})
        }, err => {
          this.setState({submitting: false, error: 'Unknow error.'})
        })
      } else {
        this.setState({submitting: false, success: true, feedbackText: '', email: ''})
      }
    }, err => {
      this.setState({submitting: false, error: err.message})
    })
  }
}

let Feedback = {
  reactInstance: (<FeedbackFrame />),
  show: search => feedbackState.dispatch({type: 'show', search: search || null})
}

module.exports = Feedback
