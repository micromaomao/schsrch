module.exports = {
  then: res => new Promise((resolve, reject) => {
    if (!res.ok) {
      reject(new Error(res.statusText || res.status))
    } else {
      resolve(res)
    }
  }),
  error: err => new Promise((resolve, reject) => {
    reject(new Error('Network unstable or SchSrch has crashed.'))
  })
}
