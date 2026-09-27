import { randomUUID } from 'crypto'
import databaseService from '~/configs/database.config.js'
import adminJobPromotionService from '~/services/admin/job-promotion.service.js'
import logger from '~/configs/logger.config.js'

const LOCK_KEY = 'job_promotion_status_worker_lock'
const INTERVAL_MS = 5 * 60 * 1000
const LOCK_MS = 4 * 60 * 1000

async function runPromotionStatusSync(owner: string) {
  const now = new Date()
  let acquired = false
  try {
    const lock = await databaseService.systemSettings.findOneAndUpdate(
      {
        key: LOCK_KEY,
        $or: [{ 'value.locked_until': { $lte: now } }, { 'value.locked_until': { $exists: false } }]
      },
      {
        $set: {
          value: { owner, locked_until: new Date(now.getTime() + LOCK_MS) },
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true, returnDocument: 'after' }
    )
    acquired = lock?.value?.owner === owner
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
  }

  if (!acquired) return
  try {
    await adminJobPromotionService.syncPromotionStatuses()
  } finally {
    await databaseService.systemSettings.updateOne(
      { key: LOCK_KEY, 'value.owner': owner },
      { $set: { value: { owner: '', locked_until: new Date(0) }, updated_at: new Date() } }
    )
  }
}

export const startPromotionStatusWorker = () => {
  const owner = randomUUID()
  logger.info({ interval_ms: INTERVAL_MS }, 'Promotion status worker started')
  const run = () =>
    runPromotionStatusSync(owner).catch((error) => {
      logger.error({ err: error }, 'Promotion status sync failed')
    })
  void run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
}
