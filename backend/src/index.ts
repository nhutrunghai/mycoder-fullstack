import { env } from 'process'
import { createApp } from './app.js'
import logger from './configs/logger.config.js'
;(async () => {
  const app = await createApp()
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API listening')
  })
})().catch((e) => {
  logger.fatal({ err: e }, 'Application failed to start')
  process.exit(1)
})
