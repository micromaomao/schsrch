const pino = require('pino')

const isProduction = process.env.NODE_ENV === 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    : undefined,
  base: {
    pid: false
  },
  timestamp: pino.stdTimeFunctions.isoTime
})

module.exports = logger
