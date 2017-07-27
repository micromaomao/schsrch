const AppState = require('./appstate.js')

module.exports = {
  then: res => new Promise((resolve, reject) => {
    if (!res.ok) {
      res.text().then(rspText => {
        reject(new Error(`${(rspText.length < 100 ? `${rspText} ` : '')}(HTTP status: ${res.status})`))
        if (rspText.trim() === 'Authorization token invalid.') {
          AppState.dispatch({type: 'clear-token'})
        }
      }, reject)
    } else {
      resolve(res)
    }
  }),
  error: err => new Promise((resolve, reject) => {
    reject(new Error('Network unstable or SchSrch has crashed.'))
  })
}
