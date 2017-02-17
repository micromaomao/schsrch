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
  shortTypes, longTypes,
  shortMonths, longMonths, odashMonths,
  setToString: entity => `${entity.subject}_${entity.time}_${entity.paper}_${entity.variant}`,
  setEqual: (a, b) => a.subject === b.subject && a.time === b.time && a.paper === b.paper && a.variant === b.variant,
  getTypeString: shortType => {
    if (!shortType) return '--'
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
      // t1 < t2
      return -1
    } else if (i2 < 0 && i1 >= 0) {
      return 1
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
  funcSortSet: (b1, b2) => {
    ;[b1, b2].forEach(b => {
      if (!Number.isSafeInteger(b.paper) || !Number.isSafeInteger(b.variant)) {
        throw new Error('paper and variant must both be integer.')
      }
    })
    let sortSubj = Math.sign(parseInt(b1.subject) - parseInt(b2.subject))
    if (sortSubj !== 0 && !Number.isNaN(sortSubj)) return sortSubj

    let times = [b1, b2].map(b => b.time).map(t => [parseInt(t.substr(1)), t[0]])
    let sortYear = Math.sign(times[0][0] - times[1][0])
    if (sortYear !== 0 && !Number.isNaN(sortYear)) return sortYear
    else if (Number.isNaN(sortYear)) return Math.sign([0, 1].map(p => times[p][0]).map(x => Number.isNaN(x) ? -1 : 1).reduce((a, b) => a - b))

    let sortMonth = Math.sign(shortMonths.indexOf(times[0][1]) - shortMonths.indexOf(times[1][1]))
    if (sortMonth !== 0 && !Number.isNaN(sortMonth)) return sortMonth

    let sortP = Math.sign(b1.paper - b2.paper)
    if (sortP !== 0) return sortP

    return Math.sign(b1.variant - b2.variant)
  },
  myTimeToHumanTime: myt => {
    let m = myt[0]
    let y = parseInt(myt.substr(1))
    if (Number.isNaN(y)) return myt
    let mi = shortMonths.indexOf(m)
    if (mi < 0) return myt
    if (y < 10) y = '0' + y
    return `${longMonths[mi]} 20${y}`
  },
  odashMonthToMyMonth: odash => {
    let mi = odashMonths.indexOf(odash)
    if (mi < 0) return odash
    return shortMonths[mi]
  }
}
