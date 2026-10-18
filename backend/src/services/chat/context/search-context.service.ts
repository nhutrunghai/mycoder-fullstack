import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { JobLevel, JobType } from '~/constants/enums'
import {
  ChatSessionDocument,
  SearchContext,
  SearchContextFilters,
  SearchContextStatus
} from '~/services/chat/types/chat.type'

export const MAX_SEARCH_CONTEXTS = 20
export const MAX_SEARCH_CONTEXT_JOB_IDS = 20

const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId.')
const contextIdSchema = z.string().uuid()
const jobTypeValues = Object.values(JobType) as [JobType, ...JobType[]]
const jobLevelValues = Object.values(JobLevel) as [JobLevel, ...JobLevel[]]

const searchContextFiltersSchema = z
  .object({
    location: z.string().trim().min(1).max(100).optional(),
    job_type: z.enum(jobTypeValues).optional(),
    level: z.enum(jobLevelValues).optional(),
    category_id: objectIdSchema.optional()
  })
  .strict()

const searchContextInputSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    query: z.string().trim().min(1).max(200),
    filters: searchContextFiltersSchema.default({}),
    job_ids: z.array(objectIdSchema)
  })
  .strict()

export type SearchContextInput = {
  label: string
  query: string
  filters?: SearchContextFilters
  job_ids: string[]
}

export type SearchContextState = Pick<ChatSessionDocument, 'search_contexts' | 'last_retrieved_job_ids'>

export type SearchContextMutation = {
  context: SearchContext
  contexts: SearchContext[]
}

export class SearchContextService {
  create(
    existingContexts: readonly SearchContext[] | undefined,
    input: unknown,
    now = new Date()
  ): SearchContextMutation {
    const parsed = this.parseInput(input)
    const context = this.createContext(parsed, now)
    const contexts = this.capContexts([...(existingContexts ?? []), context])

    return { context, contexts }
  }

  replace(
    existingContexts: readonly SearchContext[] | undefined,
    contextId: string,
    input: unknown,
    now = new Date()
  ): SearchContextMutation {
    const parsedContextId = contextIdSchema.parse(contextId)
    const parsed = this.parseInput(input)
    const existing = existingContexts ?? []
    const replaced = existing.find((context) => context.context_id === parsedContextId && context.status === 'active')

    if (!replaced) {
      throw new Error('Active search context was not found.')
    }

    const context = this.createContext(parsed, now)
    const contexts = this.capContexts([
      ...existing.map((item) =>
        item.context_id === parsedContextId
          ? {
              ...item,
              status: 'superseded' as const,
              updated_at: now
            }
          : item
      ),
      context
    ])

    return { context, contexts }
  }

  list(contexts: readonly SearchContext[] | undefined, status?: SearchContextStatus): SearchContext[] {
    return this.capContexts([...(contexts ?? [])])
      .filter((context) => !status || context.status === status)
      .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime())
  }

  getActive(contexts: readonly SearchContext[] | undefined, contextId: string): SearchContext | null {
    const parsedContextId = contextIdSchema.parse(contextId)
    return this.list(contexts, 'active').find((context) => context.context_id === parsedContextId) ?? null
  }

  getActiveJobIds(state: SearchContextState, contextId?: string): string[] {
    if (contextId) {
      return this.getActive(state.search_contexts, contextId)?.job_ids ?? []
    }

    const activeContext = this.list(state.search_contexts, 'active')[0]
    if (activeContext) {
      return activeContext.job_ids
    }

    return this.normalizeJobIds(state.last_retrieved_job_ids ?? [])
  }

  normalizeJobIds(jobIds: unknown): string[] {
    const parsedJobIds = z.array(objectIdSchema).parse(jobIds)
    return [...new Set(parsedJobIds)].slice(0, MAX_SEARCH_CONTEXT_JOB_IDS)
  }

  private parseInput(input: unknown) {
    const parsed = searchContextInputSchema.parse(input)
    return {
      label: parsed.label,
      query: parsed.query,
      filters: parsed.filters,
      job_ids: this.normalizeJobIds(parsed.job_ids)
    }
  }

  private createContext(input: Required<SearchContextInput>, now: Date): SearchContext {
    return {
      context_id: randomUUID(),
      label: input.label,
      query: input.query,
      filters: input.filters,
      job_ids: input.job_ids,
      created_at: now,
      updated_at: now,
      status: 'active'
    }
  }

  private capContexts(contexts: SearchContext[]): SearchContext[] {
    return [...contexts]
      .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime())
      .slice(0, MAX_SEARCH_CONTEXTS)
  }
}

const searchContextService = new SearchContextService()
export default searchContextService
