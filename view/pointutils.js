function assertValidPoint (point) {
  if (!Array.isArray(point)) throw new Error('Expected point to be an array.')
  if (typeof point[0] !== 'number' && typeof point[1] !== 'number') throw new Error('Expected numbers in array.')
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw new Error('Expected finite numbers as coordinates.')
  return true
}

let getClientOffsetCache = null

function getClientOffset (view) {
  let rect = null
  if (getClientOffsetCache && getClientOffsetCache.target === view) {
    rect = getClientOffsetCache.rect
  } else {
    rect = view.getBoundingClientRect()
    getClientOffsetCache = {
      target: view,
      rect
    }
  }
  if (rect.left === 0 && rect.top === 0)
    console.warn("client2view and view2client won't work if the view isn't affecting layout. (e.g. display: none)")
  return [rect.left, rect.top]
}

function removeClientOffsetCache () {
  getClientOffsetCache = null
  requestAnimationFrame(removeClientOffsetCache)
}

function client2view (point, view) {
  assertValidPoint(point)
  let cOffset = getClientOffset(view)
  return [0, 1].map(p => point[p] - cOffset[p])
}

function view2client (point, view) {
  assertValidPoint(point)
  let cOffset = getClientOffset(view)
  return [0, 1].map(p => point[p] + cOffset[p])
}

function pointDistance (a, b) {
  assertValidPoint(a)
  assertValidPoint(b)
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2))
}

module.exports = {assertValidPoint, client2view, pointDistance, view2client, removeClientOffsetCache}
