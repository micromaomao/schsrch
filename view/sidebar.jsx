import * as React from 'react'
import * as FetchErrorPromise from './fetcherrorpromise.jsx'
import { AppState } from './appstate.js'

export default class Sidebar extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
  }

  render () {
    let { currentView: view } = this.props
    return (
      <div className={'sidebar ' + (this.props.show ? 'show' : 'hide')}>
        {this.state.userOperationError && !this.state.userOperationProgressText ?
          (
            <div className='userOperationError'>
              <div className='error'>{this.state.userOperationError.message}</div>
              <div className='clear' onClick={evt => this.setState({userOperationError: null})}>Dismiss</div>
            </div>
          ) : null}
        <div className='menu'>
          <div className={'menuitem' + (view === 'home' ? ' current' : '')} onClick={evt => AppState.dispatch({type: 'home'})}>Home</div>
        </div>
        <div className='bottom'>
          <a onClick={evt => AppState.dispatch({type: 'disclaim'})}>Disclaimer</a>
          <a href='https://github.com/micromaomao/schsrch/blob/master/index.js' target='_blank'>API</a>
        </div>
      </div>
    )
  }
}
