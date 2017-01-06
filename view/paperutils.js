const shortTypes = ['qp', 'ms', 'in', 'er', 'gt', 'ir', 'ci', 'sp', 'sm', 'sr']
const longTypes = [
  'question paper',
  'marking scheme',
  'insert',
  'examiner report',
  'grade thresholds',
  'confidential instructions',
  'confidential instructions',
  'specimen question paper',
  'specimen mark scheme',
  'specimen confidential instructions'
]

const shortMonths = ['m', 's', 'w', 'y']
const longMonths = ['Feb/March', 'May/June', 'Oct/Nov', 'For examination from']
const odashMonths = ['F/M', 'M/J', 'O/N', 'SP']

module.exports = {
  setToString: entity => `${entity.subject}_${entity.time}_${entity.paper}_${entity.variant}`,
  setEqual: (a, b) => a.subject === b.subject && a.time === b.time && a.paper === b.paper && a.variant === b.variant,
  getTypeString: shortType => {
    let sIndex = shortTypes.indexOf(shortType)
    if (sIndex < 0) return shortType
    return longTypes[sIndex]
  },
  funcSortType: (t1, t2) => {
    t1 = t1.toLowerCase().trim()
    t2 = t2.toLowerCase().trim()
    let i1 = shortTypes.indexOf(t1)
    let i2 = shortTypes.indexOf(t2)
    if (i1 < 0 && i2 >= 0) {
      // t2 < t1
      return 1
    } else if (i2 < 0 && i1 >= 0) {
      return -1
    } else if (i1 < 0 && i2 < 0) {
      return 0
    } else {
      return Math.sign(i1 - i2)
    }
  },
  capitalizeFirst: str => {
    if (str.length === 0) return ''
    return str[0].toUpperCase() + str.substr(1)
  },
  funcSortBucket: (b1, b2) => {
    let sortSubj = Math.sign(parseInt(b1.subject) - parseInt(b2.subject))
    if (sortSubj !== 0 && !Number.isNaN(sortSubj)) return sortSubj

    let times = [b1, b2].map(b => b.time).map(t => [parseInt(t.substr(1)), t[0]])
    let sortYear = Math.sign(times[0][0] - times[1][0])
    if (sortYear !== 0 && !Number.isNaN(sortYear)) return sortYear

    let sortMonth = Math.sign(times[0][1].charCodeAt(0) - times[1][1].charCodeAt(0))
    if (sortMonth !== 0 && !Number.isNaN(sortMonth)) return sortMonth

    let pvs = [b1, b2].map(b => b.paper + b.variant).map(pv => parseInt(pv))
    return Math.sign(pvs[0] - pvs[1])
  },
  myTimeToHumanTime: myt => {
    let m = myt[0]
    let y = parseInt(myt.substr(1))
    if (Number.isNaN(y)) return myt
    let mi = shortMonths.indexOf(m)
    if (mi < 0) return myt
    if (y.length === 2) y = '20' + y
    return `${longMonths[mi]} ${y}`
  },
  odashMonthToMyMonth: odash => {
    let mi = odashMonths.indexOf(odash)
    if (mi < 0) return odash
    return shortMonths[mi]
  }
}
