import 'dotenv/config'
import { performance } from 'node:perf_hooks'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config'
import ElasticsearchConfig from '~/configs/elasticsearch.config'
import env from '~/configs/env.config'
import { JobLevel, JobStatus, JobType } from '~/constants/enums'
import Job from '~/models/schema/client/jobs.schema'
import { generateLocalEmbedding } from '~/services/chat/ai/embedding.service'
import jobIndexService from '~/services/chat/indexing/job-index.service'
import logger from '~/configs/logger.config.js'

type SearchHit = {
  job_id: string
  score: number
}

type SearchCandidate = {
  job_id: string
  lexical_score: number
  semantic_score: number
  final_score: number
}

type Formula = {
  name: string
  lexicalWeight: number
  semanticWeight: number
  threshold: number
  lexicalMinThreshold: number
}

type BenchmarkQuery = {
  query: string
  expectedTopTitles: string[]
}

type BenchmarkJobSeed = {
  title: string
  description: string
  requirements: string
  benefits: string
  location: string
  job_type: JobType
  level: JobLevel
  category_ids: ObjectId[]
  skills: string[]
}

const SEARCH_CANDIDATE_LIMIT = 100
const IT_CATEGORY_ID = new ObjectId('700000000000000000000001')
const BACKEND_CATEGORY_ID = new ObjectId('700000000000000000000002')
const FRONTEND_CATEGORY_ID = new ObjectId('700000000000000000000003')
const DATA_AI_CATEGORY_ID = new ObjectId('700000000000000000000007')
const FORMULAS: Formula[] = [
  {
    name: 'current_0.4_lex_0.6_sem',
    lexicalWeight: 0.4,
    semanticWeight: 0.6,
    threshold: 0.5,
    lexicalMinThreshold: 0.08
  },
  {
    name: 'balanced_0.5_lex_0.5_sem',
    lexicalWeight: 0.5,
    semanticWeight: 0.5,
    threshold: 0.5,
    lexicalMinThreshold: 0.08
  },
  {
    name: 'lexical_heavy_0.65_lex_0.35_sem',
    lexicalWeight: 0.65,
    semanticWeight: 0.35,
    threshold: 0.5,
    lexicalMinThreshold: 0.08
  },
  {
    name: 'semantic_heavy_0.25_lex_0.75_sem',
    lexicalWeight: 0.25,
    semanticWeight: 0.75,
    threshold: 0.5,
    lexicalMinThreshold: 0.08
  }
]

const BENCHMARK_QUERIES: BenchmarkQuery[] = [
  {
    query: 'nodejs backend api',
    expectedTopTitles: ['Senior Node.js Backend Engineer', 'Backend Platform Engineer', 'Java Spring Backend Engineer']
  },
  {
    query: 'vector search llm ranking',
    expectedTopTitles: ['Search Relevance Engineer', 'AI Product Engineer']
  },
  {
    query: 'frontend giao dien web',
    expectedTopTitles: ['Vue Frontend Engineer', 'Frontend Performance Engineer']
  }
]

const BENCHMARK_JOBS: BenchmarkJobSeed[] = [
  {
    title: 'Senior Node.js Backend Engineer',
    description:
      'Build Node.js backend APIs for recruitment search, Redis caching, authentication, and Elasticsearch integration.',
    requirements: 'Node.js, TypeScript, Express, REST API, Redis, Elasticsearch',
    benefits: 'Direct ownership of backend platform and API quality.',
    location: 'Ha Noi',
    job_type: JobType.FULL_TIME,
    level: JobLevel.SENIOR,
    category_ids: [IT_CATEGORY_ID, BACKEND_CATEGORY_ID],
    skills: ['nodejs', 'typescript', 'express', 'redis', 'elasticsearch']
  },
  {
    title: 'Backend Platform Engineer',
    description:
      'Design backend platform services, internal APIs, indexing workflows, and search infrastructure for hiring products.',
    requirements: 'TypeScript, API design, Elasticsearch, queues, service architecture',
    benefits: 'Platform focus with deep backend systems work.',
    location: 'Ha Noi',
    job_type: JobType.FULL_TIME,
    level: JobLevel.MIDDLE,
    category_ids: [IT_CATEGORY_ID, BACKEND_CATEGORY_ID],
    skills: ['typescript', 'api', 'elasticsearch', 'microservices', 'platform']
  },
  {
    title: 'Java Spring Backend Engineer',
    description: 'Maintain Java backend APIs, PostgreSQL integrations, and enterprise service workflows.',
    requirements: 'Java, Spring Boot, REST API, SQL',
    benefits: 'Work on stable backend business systems.',
    location: 'Ho Chi Minh',
    job_type: JobType.FULL_TIME,
    level: JobLevel.MIDDLE,
    category_ids: [IT_CATEGORY_ID, BACKEND_CATEGORY_ID],
    skills: ['java', 'spring', 'api', 'sql']
  },
  {
    title: 'Search Relevance Engineer',
    description:
      'Improve vector search, embeddings, retrieval quality, semantic matching, and ranking logic for job search.',
    requirements: 'Vector search, embeddings, relevance tuning, Elasticsearch, ranking',
    benefits: 'Own semantic search and retrieval quality.',
    location: 'Da Nang',
    job_type: JobType.CONTRACT,
    level: JobLevel.LEAD,
    category_ids: [IT_CATEGORY_ID, DATA_AI_CATEGORY_ID],
    skills: ['vector search', 'embeddings', 'ranking', 'elasticsearch', 'retrieval']
  },
  {
    title: 'AI Product Engineer',
    description: 'Build LLM ranking, recommendation flows, semantic retrieval, and AI-assisted search experiences.',
    requirements: 'LLM, ranking, vector database, embeddings, product engineering',
    benefits: 'Hands-on AI product work with semantic retrieval.',
    location: 'Da Nang',
    job_type: JobType.CONTRACT,
    level: JobLevel.SENIOR,
    category_ids: [IT_CATEGORY_ID, DATA_AI_CATEGORY_ID],
    skills: ['llm', 'ranking', 'embeddings', 'vector search', 'recommendation']
  },
  {
    title: 'Vue Frontend Engineer',
    description: 'Develop frontend giao dien web for job discovery, search forms, filters, and candidate-facing UI.',
    requirements: 'Vue, frontend, giao dien web, search UI, component architecture',
    benefits: 'Own responsive frontend search experience.',
    location: 'Da Nang',
    job_type: JobType.FULL_TIME,
    level: JobLevel.MIDDLE,
    category_ids: [IT_CATEGORY_ID, FRONTEND_CATEGORY_ID],
    skills: ['vue', 'frontend', 'ui', 'web', 'search']
  },
  {
    title: 'Frontend Performance Engineer',
    description: 'Optimize web frontend performance, rendering, bundle size, and candidate search pages.',
    requirements: 'Frontend, web performance, JavaScript, UX, browser rendering',
    benefits: 'Deep browser and UI performance work.',
    location: 'Da Nang',
    job_type: JobType.FULL_TIME,
    level: JobLevel.SENIOR,
    category_ids: [IT_CATEGORY_ID, FRONTEND_CATEGORY_ID],
    skills: ['frontend', 'web', 'performance', 'javascript', 'ux']
  }
]

const buildFilters = (jobIds: string[]) => [
  { term: { status: JobStatus.OPEN } },
  { exists: { field: 'published_at' } },
  { range: { expired_at: { gt: new Date().toISOString() } } },
  { terms: { job_id: jobIds } }
]

const mergeCandidates = (lexicalHits: SearchHit[], semanticHits: SearchHit[], formula: Formula) => {
  const candidatesMap = new Map<string, SearchCandidate>()

  for (const hit of lexicalHits) {
    candidatesMap.set(hit.job_id, {
      job_id: hit.job_id,
      lexical_score: hit.score,
      semantic_score: 0,
      final_score: 0
    })
  }

  for (const hit of semanticHits) {
    const existing = candidatesMap.get(hit.job_id)
    if (existing) {
      existing.semantic_score = hit.score
      continue
    }

    candidatesMap.set(hit.job_id, {
      job_id: hit.job_id,
      lexical_score: 0,
      semantic_score: hit.score,
      final_score: 0
    })
  }

  const candidates = Array.from(candidatesMap.values())
  const lexicalMax = Math.max(0, ...candidates.map((item) => item.lexical_score))
  const semanticMax = Math.max(0, ...candidates.map((item) => item.semantic_score))

  for (const item of candidates) {
    item.lexical_score = lexicalMax > 0 ? item.lexical_score / lexicalMax : 0
    item.semantic_score = semanticMax > 0 ? item.semantic_score / semanticMax : 0
    item.final_score =
      semanticMax > 0
        ? formula.lexicalWeight * item.lexical_score + formula.semanticWeight * item.semantic_score
        : item.lexical_score
  }

  return candidates
    .filter((item) => item.final_score >= formula.threshold && item.lexical_score >= formula.lexicalMinThreshold)
    .sort((a, b) => b.final_score - a.final_score)
}

const summarizeRanking = (candidates: SearchCandidate[], jobsById: Map<string, Job>, expectedTopTitles: string[]) => {
  const rankedTitles = candidates.slice(0, 5).map((item) => jobsById.get(item.job_id)?.title || item.job_id)
  const topTitle = rankedTitles[0] || 'none'
  const topMatch = expectedTopTitles.some((title) => topTitle.includes(title))
  return {
    topMatch,
    rankedTitles
  }
}

const main = async () => {
  const startedAt = performance.now()
  const createdJobIds: ObjectId[] = []
  let companyId: ObjectId | null = null

  try {
    await databaseService.connect()

    const company = await databaseService.companies.findOne({}, { projection: { _id: 1, company_name: 1 } })
    if (!company?._id) {
      throw new Error('No company document found to attach benchmark jobs.')
    }
    companyId = company._id

    const now = Date.now()
    const jobs = BENCHMARK_JOBS.map(
      (seed, index) =>
        new Job({
          company_id: companyId!,
          title: `[BMK ${now}] ${seed.title}`,
          description: `${seed.description}\n\nBenchmark marker ${now}.`,
          requirements: seed.requirements,
          benefits: seed.benefits,
          salary: {
            min: 20000000 + index * 1000000,
            max: 30000000 + index * 1000000,
            currency: 'VND',
            is_negotiable: false
          },
          location: seed.location,
          job_type: seed.job_type,
          level: seed.level,
          category_ids: seed.category_ids,
          skills: seed.skills,
          quantity: 1,
          expired_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
          status: JobStatus.OPEN,
          published_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        })
    )

    const insertResult = await databaseService.jobs.insertMany(jobs)
    createdJobIds.push(...Object.values(insertResult.insertedIds))

    for (const jobId of createdJobIds) {
      await jobIndexService.upsertJobDocument(jobId)
    }

    await ElasticsearchConfig.getInstance().indices.refresh({
      index: env.PUBLIC_JOBS_SEARCH_INDEX
    })

    const jobIds = createdJobIds.map((id) => id.toString())
    const jobsById = new Map(
      (
        await databaseService.jobs
          .find({ _id: { $in: createdJobIds } })
          .project<Job>({ title: 1, description: 1, requirements: 1, benefits: 1, _id: 1 })
          .toArray()
      ).map((job) => [String(job._id), job])
    )

    const client = ElasticsearchConfig.getInstance()

    logger.info(
      {
        company_id: String(companyId),
        benchmark_job_ids: jobIds,
        benchmark_titles: Array.from(jobsById.values()).map((job) => job.title)
      },
      'Search benchmark dataset created'
    )

    for (const benchmarkQuery of BENCHMARK_QUERIES) {
      const lexicalStartedAt = performance.now()
      const lexicalResponse = await client.search({
        index: env.PUBLIC_JOBS_SEARCH_INDEX,
        size: SEARCH_CANDIDATE_LIMIT,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: benchmarkQuery.query,
                  fields: ['title^4', 'skills^3', 'category_names^2', 'description', 'requirements', 'benefits']
                }
              }
            ],
            filter: buildFilters(jobIds)
          }
        }
      })
      const lexicalElapsedMs = performance.now() - lexicalStartedAt
      const lexicalHits = lexicalResponse.hits.hits.map((hit) => ({
        job_id: String(hit._id),
        score: hit._score || 0
      }))

      const embeddingStartedAt = performance.now()
      const queryVector = await generateLocalEmbedding(benchmarkQuery.query)
      const embeddingElapsedMs = performance.now() - embeddingStartedAt

      const semanticStartedAt = performance.now()
      const semanticResponse = await client.search({
        index: env.PUBLIC_JOBS_SEARCH_INDEX,
        size: SEARCH_CANDIDATE_LIMIT,
        query: {
          script_score: {
            query: {
              bool: {
                filter: buildFilters(jobIds)
              }
            },
            script: {
              source: "cosineSimilarity(params.queryVector, 'embedding') + 1.0",
              params: {
                queryVector
              }
            }
          }
        }
      })
      const semanticElapsedMs = performance.now() - semanticStartedAt
      const semanticHits = semanticResponse.hits.hits.map((hit) => ({
        job_id: String(hit._id),
        score: hit._score || 0
      }))

      logger.debug(
        {
          query: benchmarkQuery.query,
          lexical_ms: Number(lexicalElapsedMs.toFixed(2)),
          embedding_ms: Number(embeddingElapsedMs.toFixed(2)),
          semantic_es_ms: Number(semanticElapsedMs.toFixed(2)),
          lexical_hits: lexicalHits.map((item) => ({
            title: jobsById.get(item.job_id)?.title,
            score: Number(item.score.toFixed(4))
          })),
          semantic_hits: semanticHits.slice(0, 5).map((item) => ({
            title: jobsById.get(item.job_id)?.title,
            score: Number(item.score.toFixed(4))
          }))
        },
        'Search benchmark query completed'
      )

      for (const formula of FORMULAS) {
        const ranked = mergeCandidates(lexicalHits, semanticHits, formula)
        const ranking = summarizeRanking(ranked, jobsById, benchmarkQuery.expectedTopTitles)

        logger.debug(
          {
            query: benchmarkQuery.query,
            formula: formula.name,
            top_match_expected: ranking.topMatch,
            ranked_titles: ranking.rankedTitles,
            ranked_scores: ranked.slice(0, 5).map((item) => ({
              title: jobsById.get(item.job_id)?.title,
              lexical: Number(item.lexical_score.toFixed(4)),
              semantic: Number(item.semantic_score.toFixed(4)),
              final: Number(item.final_score.toFixed(4))
            }))
          },
          'Search benchmark formula evaluated'
        )
      }
    }

    logger.info({ elapsed_ms: Number((performance.now() - startedAt).toFixed(2)) }, 'Search benchmark completed')
  } finally {
    if (createdJobIds.length > 0) {
      await databaseService.jobs.deleteMany({
        _id: { $in: createdJobIds }
      })

      const deleteOperations = createdJobIds.map((jobId) =>
        ElasticsearchConfig.getInstance()
          .delete({
            index: env.PUBLIC_JOBS_SEARCH_INDEX,
            id: jobId.toString()
          })
          .catch(() => null)
      )

      await Promise.all(deleteOperations)
      await ElasticsearchConfig.getInstance().indices.refresh({
        index: env.PUBLIC_JOBS_SEARCH_INDEX
      })

      logger.info({ deleted_job_count: createdJobIds.length }, 'Search benchmark cleanup completed')
    }
  }
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Search benchmark failed')
  process.exit(1)
})
