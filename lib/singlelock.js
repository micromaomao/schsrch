module.exports = function () {
  let queue = []
  let doing = false
  let check = () => {
    if (!doing) {
      if (queue.length === 0) return
      doing = true
      queue.pop()(function () {
        doing = false
        check()
      })
    }
  }
  return function (task) {
    queue.push(task)
    check()
  }
}
