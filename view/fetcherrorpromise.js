module.exports = {
  then: res => new Promise((resolve, reject) => {
    let _res = res.clone()
    res.text().then(rspText => {
      if (!res.ok) {
        reject(new Error(res.status + (rspText.length < 100 ? ` ${rspText}` : '')))
      } else {
        resolve(_res)
      }
    }, err => reject(new Error(res.status)))
  }),
  error: err => new Promise((resolve, reject) => {
    reject(new Error('Network unstable or SchSrch has crashed.'))
  })
}
