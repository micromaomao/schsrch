const React = require('react')

class CollectionsView extends React.Component {
  constructor () {
    super()
    this.state = {
      content: ''
    }
    this.handleInputChange = this.handleInputChange.bind(this)
  }
  handleInputChange (content) {
    this.setState({content})
  }
  render () {
    let col = this.props.collection
    if (col === null) return null
    return (
      <div className='list'>
        <div className='top'>
          <div className='close'>Close</div>
          <h1>{col.loading ? 'Collection\u2026' : col.name}</h1>
          <div className='menu'>&hellip;</div>
        </div>
        <div className='editorcontain'>
          <Editor content={this.state.content} onChange={this.handleInputChange} />
        </div>
        <div className='bottom'>
          Not saving&hellip;
        </div>
      </div>
    )
  }
}

class Editor extends React.Component {
  constructor () {
    super()
    this.handleInput = this.handleInput.bind(this)
  }
  normalizeHTML (html = '') {
    let parser = new DOMParser()
    let parsedDOM = parser.parseFromString(html, 'text/html')
    if (!parsedDOM.body) {
      return html
    }
    let nodes = parsedDOM.body.childNodes
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i]
      if (node.nodeName === '#text') continue
      if (node.nodeName.match(/^([bi]|del)$/i)) {
        let newElement = parsedDOM.createElement(node.nodeName)
        newElement.innerHTML = this.normalizeHTML(node.innerHTML)
        parsedDOM.body.replaceChild(newElement, nodes[i])
      } else if (node.nodeName.toLowerCase() === 'br' && i === nodes.length - 1) { // Firefox wired behavior
        let newNode = parsedDOM.createElement('br')
        parsedDOM.body.replaceChild(newNode, nodes[i])
      } else {
        let newNode = parsedDOM.createTextNode(node.innerText)
        parsedDOM.body.replaceChild(newNode, nodes[i])
      }
    }
    return parsedDOM.body.innerHTML
  }
  handleInput (evt) {
    if (this.props.onChange) {
      this.props.onChange(this.normalizeHTML(evt.target.innerHTML))
    }
  }
  shouldComponentUpdate(nextProps, nextState) {
    if (!this.editorDOM) return true
    if (this.normalizeHTML(nextProps.content) === this.editorDOM.innerHTML) {
      return false
    }
    return true
  }
  render () {
    return (
      <div className='collectionEditor'>
        <div className='content' contentEditable='true' ref={f => this.editorDOM = f} onInput={this.handleInput}
          dangerouslySetInnerHTML={{__html: this.normalizeHTML(this.props.content)}} />
      </div>
    )
  }
}

module.exports = { CollectionsView }
