const CIESubjects = require('./CIESubjects.js')
const PaperUtils = require('./paperutils.js')
const AppStateInit = require('./appstateinit.js')

module.exports = function (state, origin = window.location.origin, siteName = window.location.hostname) {
  state = Object.assign({}, AppStateInit, state)
  try {
    if (state.feedback && state.feedback.show) {
      return {
        title: 'Provide feedback'
      }
    }
    if (state.view === 'home') {
      if (state.querying === null || state.querying.query.trim() === '') {
        if (!state.showHelp) {
          return {
            url: origin,
            title: siteName,
            description: `A past paper storage & search engine for CIE papers - IGCSE, AS and A Level, now offering ${CIESubjects.length} subjects.`
          }
        } else {
          return {
            url: origin + '/help/',
            title: siteName + ' help manual',
            description: `Tl;dr: type anything you want—keywords, question, subject, etc. Read this if you want to know more detail.`
          }
        }
      } else if (state.querying) {
        let query = state.querying.query.trim()
        if (query.length === 0) return null
        let url = origin + '/search/?as=page&query=' + encodeURIComponent(query)
        if (/^\d{4}$/.test(query)) {
          let subject = null
          let queryResult = state.querying.result || {response: 'empty'}
          if ((subject = CIESubjects.findExactById(query))) {
            return {
              url,
              title: `${subject.level} ${subject.name} - ${siteName} Subject Page`,
              description: `Past papers, mark scheme and example candidate responses on ${subject.level} ${subject.name} ( Syllabus code ${subject.id} )`
            }
          } else if (queryResult.response === 'pp' && queryResult.list.length === 0) {
            return {
              url,
              title: `No result for ${query} - ${siteName} query`,
              description: `${siteName} don't have past papers for syllabus ${query}.`,
              noindex: true
            }
          }
        }
        let match = null
        if ((match = query.match(/^(\d{4})\s+([a-z]\d{2})$/))) {
          let subject = CIESubjects.findExactById(match[1])
          let time = match[2]
          let timeStr = PaperUtils.myTimeToHumanTime(time)
          if (subject && timeStr !== time) {
            let queryResult = state.querying.result
            let haveContent = queryResult ? (
              (queryResult.response === 'pp' && queryResult.list.length > 0) ||
                queryResult.response === 'overflow') : true
            if (haveContent) {
              return {
                url,
                title: `${timeStr} - ${subject.level} ${subject.name} - ${siteName} query`,
                description: `${timeStr} (${time}) past papers for ${subject.level} ${subject.name}`
              }
            } else {
              return {
                url,
                title: `No result for ${timeStr} - ${subject.level} ${subject.name} - ${siteName} query`,
                description: `${siteName} don't have the ${timeStr} past papers for ${subject.level} ${subject.name}.`,
                noindex: true
              }
            }
          }
        }
        return {
          url,
          title: `${query} - ${siteName} query`,
          description: `Search result for ${query}`
        }
      }
      return {
        noindex: true
      }
    }
    if (state.view === 'collection') {
      // TODO
      if (state.collection && state.collection.id) {
        return {
          url: origin + `/collection/${state.collection.id}/view/`,
          title: `${siteName} Collection Viewer`,
          noindex: true
        }
      }
    }
    if (state.view === 'disclaim') {
      return {
        url: origin + '/disclaim/',
        title: `Disclaimer - ${siteName}`,
        description: 'Some non-professional legal text.'
      }
    }
    if (state.view === 'subjects') {
      return {
        url: origin + '/subjects/',
        title: `List of supported subjects by ${siteName}`,
        description: `We have papers for these ${CIESubjects.length} subjects.`
      }
    }
    return {
      noindex: true
    }
  } catch (e) {
    console.error(e)
    return {
      noindex: true
    }
  }
}
