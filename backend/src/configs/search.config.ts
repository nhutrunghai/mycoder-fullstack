import env from './env.config'
import ElasticsearchConfig from './elasticsearch.config'
import logger from './logger.config.js'

const ELASTICSEARCH_BOOT_RETRY_ATTEMPTS = 1
const ELASTICSEARCH_BOOT_RETRY_DELAY_MS = 3000

export const PUBLIC_JOBS_SEARCH_INDEX = env.PUBLIC_JOBS_SEARCH_INDEX
export const JOB_EMBEDDING_DIMS = 768
export const RESUME_SEARCH_INDEX = env.RESUME_SEARCH_INDEX
export const RESUME_EMBEDDING_DIMS = env.RESUME_EMBEDDING_DIMS

export const PUBLIC_JOB_SEARCHABLE_FIELDS = ['title', 'description', 'requirements', 'benefits', 'search_text'] as const

export const PUBLIC_JOB_FILTER_FIELDS = [
  'location',
  'job_type',
  'level',
  'category_ids',
  'category_names',
  'category_slugs',
  'skills',
  'status',
  'moderation_status'
] as const

// Schema field cua document search job public
export const publicJobsSearchSchema = {
  job_id: { type: 'keyword' },
  company_id: { type: 'keyword' },

  title: { type: 'text' },
  description: { type: 'text' },
  requirements: { type: 'text' },
  benefits: { type: 'text' },
  search_text: { type: 'text' },

  location: { type: 'keyword' },
  job_type: { type: 'keyword' },
  level: { type: 'keyword' },
  category_ids: { type: 'keyword' },
  category_names: { type: 'text', fields: { keyword: { type: 'keyword' } } },
  category_slugs: { type: 'keyword' },
  skills: { type: 'keyword' },
  status: { type: 'keyword' },
  moderation_status: { type: 'keyword' },

  published_at: { type: 'date' },
  expired_at: { type: 'date' },

  embedding: {
    type: 'dense_vector',
    dims: JOB_EMBEDDING_DIMS
  }
} as const

// Settings co ban cho phase dau
export const publicJobsSearchSettings = {
  number_of_shards: 1,
  number_of_replicas: 0
} as const

// Mapping dung format Elasticsearch
export const publicJobsSearchMapping = {
  settings: publicJobsSearchSettings,
  mappings: {
    properties: publicJobsSearchSchema
  }
} as const

export const resumeChunksSearchSchema = {
  resume_id: { type: 'keyword' },
  candidate_id: { type: 'keyword' },
  chunk_id: { type: 'keyword' },
  chunk_index: { type: 'integer' },
  status: { type: 'keyword' },
  is_default: { type: 'boolean' },

  title: { type: 'text' },
  text: { type: 'text' },
  section: { type: 'keyword' },
  source_url: { type: 'keyword', index: false },
  resume_file_key: { type: 'keyword', index: false },
  embedding_model: { type: 'keyword' },

  created_at: { type: 'date' },
  updated_at: { type: 'date' },

  embedding: {
    type: 'dense_vector',
    dims: RESUME_EMBEDDING_DIMS
  }
} as const

export const resumeChunksSearchMapping = {
  settings: publicJobsSearchSettings,
  mappings: {
    properties: resumeChunksSearchSchema
  }
} as const

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const ensurePublicJobsSearchIndex = async () => {
  return ensureSearchIndex(PUBLIC_JOBS_SEARCH_INDEX, publicJobsSearchMapping, 'public_jobs_search_index_ready')
}

export const ensureResumeChunksSearchIndex = async () => {
  return ensureSearchIndex(RESUME_SEARCH_INDEX, resumeChunksSearchMapping, 'resume_chunks_search_index_ready')
}

const ensureSearchIndex = async (index: string, mapping: object, readyTag: string) => {
  const client = ElasticsearchConfig.getInstance()

  for (let attempt = 1; attempt <= ELASTICSEARCH_BOOT_RETRY_ATTEMPTS; attempt++) {
    try {
      const existsResponse = await client.indices.exists({
        index
      })
      const exists =
        typeof existsResponse === 'boolean' ? existsResponse : Boolean((existsResponse as { body?: boolean }).body)

      if (!exists) {
        await client.indices.create({
          index,
          ...mapping
        })
      }

      if (attempt > 1) {
        logger.info({ tag: readyTag, index, attempt }, 'Elasticsearch search index ready')
      }

      return
    } catch (error) {
      const isLastAttempt = attempt === ELASTICSEARCH_BOOT_RETRY_ATTEMPTS

      logger.warn(
        {
          tag: 'search_index_waiting',
          index,
          attempt,
          max_attempts: ELASTICSEARCH_BOOT_RETRY_ATTEMPTS,
          retry_in_ms: isLastAttempt ? 0 : ELASTICSEARCH_BOOT_RETRY_DELAY_MS,
          err: error
        },
        'Elasticsearch search index initialization failed'
      )

      if (isLastAttempt) {
        throw error
      }

      await sleep(ELASTICSEARCH_BOOT_RETRY_DELAY_MS)
    }
  }
}
