const React = require('react')

class AnimatorReactComponent extends React.Component {
  constructor (props) {
    super(props)
    this.nextFrameForceUpdateAnimationFrameRequest = null
  }

  nextFrameForceUpdate () {
    if (this.nextFrameForceUpdateAnimationFrameRequest !== null) return
    this.nextFrameForceUpdateAnimationFrameRequest = requestAnimationFrame(() => {
      this.nextFrameForceUpdateAnimationFrameRequest = null
      this.forceUpdate()
    })
  }
}

module.exports = AnimatorReactComponent
