const AppState = require('./appstate.js')

module.exports = {
  then: res => new Promise((resolve, reject) => {
    let _res = res.clone()
    res.text().then(rspText => {
      if (!res.ok) {
        reject(new Error(`${(rspText.length < 100 ? ` ${rspText}` : '')} (HTTP status: ${res.status})`))
        if (rspText.trim() === 'Authorization token invalid.') {
          AppState.dispatch({type: 'clear-token'})
        }
      } else {
        resolve(_res)
      }
    }, err => reject(new Error(res.status)))
  }),
  error: err => new Promise((resolve, reject) => {
    reject(new Error('Network unstable or SchSrch has crashed.'))
  })
}
