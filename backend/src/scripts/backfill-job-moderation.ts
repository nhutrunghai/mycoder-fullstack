import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import ElasticsearchConfig from '~/configs/elasticsearch.config.js'
import env from '~/configs/env.config.js'
import { publicJobsSearchSchema } from '~/configs/search.config.js'
import { JobModerationStatus } from '~/constants/enums.js'
import jobIndexService from '~/services/chat/indexing/job-index.service.js'
import logger from '~/configs/logger.config.js'

async function backfillMongoJobs() {
  const result = await databaseService.jobs.updateMany(
    {
      moderation_status: { $exists: false }
    },
    {
      $set: {
        moderation_status: JobModerationStatus.ACTIVE
      }
    }
  )

  logger.info(
    { matched: result.matchedCount, modified: result.modifiedCount },
    'Job moderation backfill updated MongoDB'
  )
}

async function ensureElasticsearchMapping() {
  const client = ElasticsearchConfig.getInstance()

  await client.indices.putMapping({
    index: env.PUBLIC_JOBS_SEARCH_INDEX,
    properties: {
      moderation_status: publicJobsSearchSchema.moderation_status
    }
  })

  logger.info(
    { index: env.PUBLIC_JOBS_SEARCH_INDEX, field: 'moderation_status' },
    'Job moderation Elasticsearch mapping updated'
  )
}

async function reindexAllJobs() {
  const cursor = databaseService.jobs.find(
    {},
    {
      projection: {
        _id: 1
      }
    }
  )

  let processed = 0

  for await (const job of cursor) {
    await jobIndexService.upsertJobDocument(job._id as ObjectId)
    processed += 1
  }

  logger.info({ processed }, 'Job moderation backfill reindex completed')
}

async function main() {
  await databaseService.connect()
  await backfillMongoJobs()
  await ensureElasticsearchMapping()
  await reindexAllJobs()
  process.exit(0)
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Job moderation backfill failed')
  process.exit(1)
})
