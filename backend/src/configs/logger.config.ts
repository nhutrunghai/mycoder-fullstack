import pino from 'pino'

const buildMode = process.env.BUILD_MODE ?? 'dev'

const logLevelByBuildMode = {
  dev: 'debug',
  production: 'info',
  test: 'silent'
} as const

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack
    }
  }

  return {
    type: typeof error,
    message: String(error)
  }
}

const logger = pino({
  level: logLevelByBuildMode[buildMode as keyof typeof logLevelByBuildMode] ?? 'info',
  base: {
    service: 'mycoder-backend',
    build_mode: buildMode
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: serializeError
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.otp',
      'req.body.otpCode',
      'req.body.access_token',
      'req.body.refresh_token',
      'req.body.apiKey',
      'req.body.api_key',
      'req.body.secret',
      'req.body.token'
    ],
    censor: '[REDACTED]'
  }
})

export default logger
