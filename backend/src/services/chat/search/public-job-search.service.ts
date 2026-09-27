import { performance } from 'node:perf_hooks'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config'
import { JobModerationStatus, JobStatus } from '~/constants/enums'
import hybridJobSearchService from './hybrid-job-search.service'
import lexicalJobSearchService from './lexical-job-search.service'
import semanticJobSearchService from './semantic-job-search.service'
import { PublicJobListItem, SearchCandidate, SearchPublicJobsParams, SearchScorePreview } from './job-search.type'
import logger from '~/configs/logger.config.js'

class PublicJobSearchService {
  async searchForPublicPage(params: SearchPublicJobsParams) {
    const normalized = this.normalizeSearchParams(params)
    const startedAt = performance.now()
    const lexicalStartedAt = performance.now()
    const hits = await lexicalJobSearchService.search(normalized)
    const lexicalElapsedMs = performance.now() - lexicalStartedAt

    const total = hits.length
    const start = (normalized.page - 1) * normalized.limit
    const pagedHits = hits.slice(start, start + normalized.limit)

    const hydrateStartedAt = performance.now()
    const jobs = await this.hydratePublicJobsFromMongo(pagedHits.map((item) => item.job_id))
    const hydrateElapsedMs = performance.now() - hydrateStartedAt
    const totalElapsedMs = performance.now() - startedAt

    logger.debug(
      {
        mode: 'lexical',
        query_length: (normalized.q ?? '').length,
        page: normalized.page,
        limit: normalized.limit,
        lexical_ms: Number(lexicalElapsedMs.toFixed(2)),
        hydrate_ms: Number(hydrateElapsedMs.toFixed(2)),
        total_hits: total,
        total_ms: Number(totalElapsedMs.toFixed(2))
      },
      'Public jobs search completed'
    )

    return {
      items: this.attachAndPreserveJobIdOrder(
        pagedHits.map((item) => item.job_id),
        jobs
      ),
      pagination: {
        page: normalized.page,
        limit: normalized.limit,
        total,
        total_pages: Math.ceil(total / normalized.limit)
      }
    }
  }

  async searchForChat(params: SearchPublicJobsParams) {
    const normalized = this.normalizeSearchParams(params)
    const startedAt = performance.now()

    const lexicalStartedAt = performance.now()
    const lexicalPromise = lexicalJobSearchService.search(normalized).then((hits) => ({
      hits,
      elapsedMs: performance.now() - lexicalStartedAt
    }))

    const semanticStartedAt = performance.now()
    const semanticPromise = semanticJobSearchService
      .search(normalized)
      .then((result) => ({
        ...result,
        totalElapsedMs: performance.now() - semanticStartedAt,
        fallback: false
      }))
      .catch((error) => {
        logger.warn(
          { err: error, query_length: (normalized.q ?? '').length },
          'Public jobs semantic search failed; using fallback'
        )

        return {
          hits: [],
          embeddingElapsedMs: 0,
          semanticSearchElapsedMs: 0,
          totalElapsedMs: performance.now() - semanticStartedAt,
          fallback: true
        }
      })

    const [{ hits: lexicalHits, elapsedMs: lexicalElapsedMs }, semanticResult] = await Promise.all([
      lexicalPromise,
      semanticPromise
    ])

    const mergeStartedAt = performance.now()
    const candidates = hybridJobSearchService.mergeSearchCandidates(lexicalHits, semanticResult.hits)
    const rankingResult = hybridJobSearchService.applySearchThresholdAndSort(candidates)
    const ranked = rankingResult.items
    const mergeElapsedMs = performance.now() - mergeStartedAt

    const total = ranked.length
    const start = (normalized.page - 1) * normalized.limit
    const pagedCandidates = ranked.slice(start, start + normalized.limit)

    const hydrateStartedAt = performance.now()
    const jobs = await this.hydratePublicJobsFromMongo(pagedCandidates.map((item) => item.job_id))
    const hydrateElapsedMs = performance.now() - hydrateStartedAt
    const totalElapsedMs = performance.now() - startedAt
    const scorePreview = this.buildScorePreview(pagedCandidates, jobs)

    logger.debug(
      {
        mode: 'hybrid',
        query_length: (normalized.q ?? '').length,
        page: normalized.page,
        limit: normalized.limit,
        lexical_ms: Number(lexicalElapsedMs.toFixed(2)),
        embedding_ms: Number(semanticResult.embeddingElapsedMs.toFixed(2)),
        semantic_es_ms: Number(semanticResult.semanticSearchElapsedMs.toFixed(2)),
        semantic_total_ms: Number(semanticResult.totalElapsedMs.toFixed(2)),
        semantic_fallback: semanticResult.fallback,
        merge_rank_ms: Number(mergeElapsedMs.toFixed(2)),
        hydrate_ms: Number(hydrateElapsedMs.toFixed(2)),
        total_candidates: candidates.length,
        total_ranked: total,
        semantic_rescue_count: rankingResult.semanticRescueCount,
        top_scores: scorePreview,
        total_ms: Number(totalElapsedMs.toFixed(2))
      },
      'Public jobs hybrid search completed'
    )

    return {
      items: this.attachAndPreserveOrder(pagedCandidates, jobs),
      pagination: {
        page: normalized.page,
        limit: normalized.limit,
        total,
        total_pages: Math.ceil(total / normalized.limit)
      }
    }
  }

  normalizeSearchParams(params: SearchPublicJobsParams): SearchPublicJobsParams {
    return {
      ...params,
      q: params.q?.trim() || '',
      page: Math.max(1, params.page),
      limit: Math.max(1, params.limit)
    }
  }

  private async hydratePublicJobsFromMongo(jobIds: string[]) {
    if (jobIds.length === 0) {
      return []
    }

    const objectIds = jobIds.map((id) => new ObjectId(id))

    return databaseService.jobs
      .aggregate<PublicJobListItem>([
        {
          $match: {
            _id: { $in: objectIds },
            status: JobStatus.OPEN,
            moderation_status: JobModerationStatus.ACTIVE,
            published_at: { $ne: null },
            expired_at: { $gt: new Date() }
          }
        },
        {
          $lookup: {
            from: databaseService.companies.collectionName,
            localField: 'company_id',
            foreignField: '_id',
            as: 'company'
          }
        },
        {
          $unwind: '$company'
        },
        {
          $project: {
            _id: 1,
            title: 1,
            location: 1,
            job_type: 1,
            level: 1,
            salary: 1,
            skills: 1,
            published_at: 1,
            expired_at: 1,
            company: {
              _id: '$company._id',
              company_name: '$company.company_name',
              logo: '$company.logo'
            }
          }
        }
      ])
      .toArray()
  }

  private attachAndPreserveOrder(candidates: SearchCandidate[], jobs: PublicJobListItem[]) {
    const jobsMap = new Map(jobs.map((job) => [String(job._id), job]))

    return candidates
      .map((candidate) => jobsMap.get(candidate.job_id) || null)
      .filter((job): job is PublicJobListItem => job !== null)
  }

  private attachAndPreserveJobIdOrder(jobIds: string[], jobs: PublicJobListItem[]) {
    const jobsMap = new Map(jobs.map((job) => [String(job._id), job]))

    return jobIds.map((jobId) => jobsMap.get(jobId) || null).filter((job): job is PublicJobListItem => job !== null)
  }

  private buildScorePreview(candidates: SearchCandidate[], jobs: PublicJobListItem[]): SearchScorePreview[] {
    const jobsMap = new Map(jobs.map((job) => [String(job._id), job]))

    return candidates.slice(0, 5).map((candidate) => ({
      job_id: candidate.job_id,
      title: jobsMap.get(candidate.job_id)?.title,
      lexical_score: Number(candidate.lexical_score.toFixed(4)),
      semantic_score: Number(candidate.semantic_score.toFixed(4)),
      final_score: Number(candidate.final_score.toFixed(4))
    }))
  }
}

const publicJobSearchService = new PublicJobSearchService()
export default publicJobSearchService
