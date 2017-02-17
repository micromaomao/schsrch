const subjects = require('./CIESubjects.data.min.js')

module.exports = {
  search: query => {
    query = query.trim()
    if (query === '') return []
    return subjects.filter(subj => subj.name.toLowerCase().indexOf(query.toLowerCase()) >= 0 || subj.id.substr(0, query.length) === query)
  },
  findExactById: id => {
    id = id.toString()
    return subjects.find(subj => subj.id === id)
  }
}
