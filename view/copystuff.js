export default function (text) {
  let ta = document.createElement('textarea')
  Object.assign(ta.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '1rem',
    height: '1rem',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    opacity: 0.1
  })
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy command failed.')
    }
  } catch (e) {
    prompt("Copy the text below.\nSeamless copying isn't supported in your browser.", text)
  }
  ta.remove()
}
