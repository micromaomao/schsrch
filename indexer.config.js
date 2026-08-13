/* eslint-disable no-useless-escape */
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true })

const ajvSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', pattern: '^\\d{4}$' },
    time: { type: 'string', pattern: '^[mswy]\\d{2}$' },
    type: { type: 'string', pattern: '^[a-z]+$' },
    paper: { type: 'number', minimum: 0 },
    variant: { type: 'number', minimum: 0 }
  },
  required: ['subject', 'time', 'type', 'paper', 'variant']
}
const validate = ajv.compile(ajvSchema)

module.exports = {
  ignore: [
    /(^|[\/\\])\.[^\/\\]/g,
    /\.tmp$/i,
    /output\.txt$/i
  ],

  filenameParsers: [
    function (fileName) {
      let stdMatch = fileName.match(/^(\d+)_([a-z]\d\d)_([a-zA-Z0-9]+)(?:_(\d{1,2}))?\.(\w+)$/)
      if (!stdMatch) {
        stdMatch = fileName.match(/^(\d+)_([a-z]\d\d)_0_0_([a-zA-Z0-9]+)\.(\w+)$/)
        if (stdMatch) stdMatch = [stdMatch[0], stdMatch[1], stdMatch[2], stdMatch[3], null, stdMatch[4]]
      }
      if (stdMatch) {
        const meta = { subject: stdMatch[1], time: stdMatch[2], type: stdMatch[3], ext: stdMatch[5] }
        const pv = stdMatch[4]
        if (pv && pv.length > 0) {
          if (pv.length === 1) { meta.paper = parseInt(pv[0], 10); meta.variant = 0 } else if (pv[0] === '0') { meta.paper = parseInt(pv[1], 10); meta.variant = 0 } else { meta.paper = parseInt(pv[0], 10); meta.variant = parseInt(pv[1], 10) }
        } else { meta.paper = 0; meta.variant = 0 }
        return meta
      }

      const specMatch = fileName.match(/specimen-paper-(\d+)/i)
      if (specMatch) {
        const meta = { paper: parseInt(specMatch[1], 10), variant: 0 }
        if (fileName.match(/confidential-instructions/i)) meta.type = 'sr'
        else if (fileName.match(/mark-scheme/i)) meta.type = 'sm'
        else if (fileName.match(/insert/i)) meta.type = 'sin'
        else meta.type = 'sp'
        meta.ext = fileName.split('.').pop()
        return meta
      }

      return null
    }
  ],

  folderParsers: [
    function (filePath) {
      const meta = {}
      const normalizedPath = filePath.replace(/\\/g, '/')

      const subjMatch = normalizedPath.match(/(?:^|\/)[a-zA-Z\s\-]+\((\d{4})\)\//)
      if (subjMatch) {
        meta.subject = subjMatch[1]
      }

      const specMatch = normalizedPath.match(/\/(\d{4})\/.*Specimen Paper/i)
      if (specMatch) {
        meta.time = 'y' + specMatch[1].slice(2)
      }

      const sessMatch = normalizedPath.match(/\/(\d{4})\/.*?(Feb-March|March|May-June|June|Oct-Nov|Nov|November)/i)
      if (sessMatch) {
        const year = sessMatch[1].slice(2)
        const s = sessMatch[2].toLowerCase()
        if (s.includes('march')) meta.time = 'm' + year
        else if (s.includes('june')) meta.time = 's' + year
        else if (s.includes('nov')) meta.time = 'w' + year
      }

      return Object.keys(meta).length > 0 ? meta : null
    }
  ],

  validators: [
    function (meta) {
      if (typeof meta !== 'object' || meta === null) return 'Metadata must be an object'
      const valid = validate(meta)
      if (!valid) {
        return validate.errors.map(e => `${e.instancePath || 'metadata'} ${e.message}`).join('; ')
      }
      return true
    }
  ]
}
