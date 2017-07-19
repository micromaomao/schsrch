function assertValidPoint (point) {
  if (!Array.isArray(point)) throw new Error('Expected point to be an array.')
  if (typeof point[0] !== 'number' && typeof point[1] !== 'number') throw new Error('Expected numbers in array.')
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw new Error('Expected finite numbers as coordinates.')
  return true
}

function client2view (point, view) {
  assertValidPoint(point)
  let rect = view.getBoundingClientRect()
  if (rect.left === 0 && rect.top === 0)
    console.warn("client2view won't work if the view isn't affecting layout. (e.g. display: none)")
  var supportPageOffset = window.pageXOffset !== undefined
  var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat")
  var scrollX = supportPageOffset ? window.pageXOffset : isCSS1Compat ? document.documentElement.scrollLeft : document.body.scrollLeft
  var scrollY = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop
  return [point[0] - (rect.left + scrollX), point[1] - (rect.top + scrollY)]
}

function pointDistance (a, b) {
  assertValidPoint(a)
  assertValidPoint(b)
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2))
}

module.exports = {assertValidPoint, client2view, pointDistance}
