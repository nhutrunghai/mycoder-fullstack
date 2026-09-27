import pino from 'pino'

const nodeEnv = process.env.NODE_ENV ?? 'development'

const logLevelByNodeEnv = {
  development: 'debug',
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
  level: logLevelByNodeEnv[nodeEnv as keyof typeof logLevelByNodeEnv] ?? 'info',
  base: {
    service: 'mycoder-backend',
    node_env: nodeEnv
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
