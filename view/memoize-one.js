module.exports = function (fn) {
  let lastCallArg = null
  let lastCallResult = null

  return function (arg) {
    if (lastCallArg === arg) return lastCallResult
    lastCallArg = arg
    return lastCallResult = fn(arg)
  }
}
