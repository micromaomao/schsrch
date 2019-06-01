// Copied from https://github.com/micromaomao/schsrch/blob/master/view/CIESubjects.js

const subjects = require('./CIESubjects.data.js')
let idIndex = {}
let formerIndex = {}
subjects.forEach(s => {
  if (!s || typeof s !== 'object') {
    throw new Error('CIESubjects data invalid.')
  }
  s.id = s.id.toString()
  if (idIndex[s.id]) {
    throw new Error(`Duplicate subject: ${s.id}.`)
  }
  idIndex[s.id] = s
  if (s.deprecation) {
    let conflictingFormor
    if ((conflictingFormor = formerIndex[s.deprecation.successor])) {
      throw new Error(`${conflictingFormor.id} and ${s.id} can't both be the former of ${s.deprecation.successor}.`)
    }
    formerIndex[s.deprecation.successor] = s
  }
})

module.exports = {
  search: query => {
    query = query.trim()
    if (query === '') return []
    return subjects.filter(subj => subj.name.toLowerCase().indexOf(query.toLowerCase()) >= 0 || subj.id.substr(0, query.length) === query)
  },
  findExactById: function (id) {
    id = id.toString()
    return idIndex[id]
  },
  deprecationStates: function (id) {
    let subj = this.findExactById(id)
    if (!subj) {
      return []
    }
    let depStates = []
    if (subj.deprecation) {
      depStates.push({type: 'former', of: subj.deprecation.successor, final: subj.deprecation.final}) // Read: I'm a former of...
    }
    let former
    if ((former = formerIndex[subj.id])) { // Read: if I have a former...
      depStates.push({type: 'successor', of: former.id, formerFinal: former.deprecation.final})
    }
    return depStates
  },
  length: subjects.length
}
