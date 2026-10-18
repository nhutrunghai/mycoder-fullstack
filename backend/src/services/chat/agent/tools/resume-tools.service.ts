import { StatusCodes } from 'http-status-codes'
import { AppError } from '~/errors/app-error'
import Resume from '~/models/schema/client/resumes.schema'
import resumeChatRetrievalService from '~/services/chat/retrieval/resume-retrieval.service'
import jobChatRetrievalService from '~/services/chat/retrieval/job-retrieval.service'
import resumeService from '~/services/client/resume.service'
import { AgentToolArguments } from './tool-arguments.schema'
import { AgentToolExecutionContext } from './job-tools.service'

type GetSelectedResumeArguments = AgentToolArguments['get_selected_resume']
type SearchResumeChunksArguments = AgentToolArguments['search_resume_chunks']
type MatchResumeToJobsArguments = AgentToolArguments['match_resume_to_jobs']

type ResumeSource = {
  type: 'resume'
  id: string
  title: string
}

type JobSource = {
  type: 'job'
  id: string
  title: string
}

type AgentResumeToolResult<Tool extends 'get_selected_resume' | 'search_resume_chunks' | 'match_resume_to_jobs', Data> = {
  tool: Tool
  data: Data
  sources: Array<ResumeSource | JobSource>
}

type SafeResumeIndexing = {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  chunks_indexed: number
  started_at?: Date
  completed_at?: Date
  updated_at: Date
}

type SafeResume = {
  resume_id: string
  title: string
  is_default: boolean
  indexing?: SafeResumeIndexing
  ready_for_retrieval: boolean
}

type SafeResumeChunk = {
  chunk_id: string
  chunk_index: number
  title: string
  section?: string
  text: string
  score: number
}

type ResumeNotReadyData = {
  status: 'not_ready' | 'failed'
  resume_id: string
  chunks: []
  message: string
}

type SafeMatchedJob = {
  job_id: string
  title: string
  company: string
  location: string
  level: string
  job_type: string
  salary?: {
    min?: number
    max?: number
    currency: string
    is_negotiable?: boolean
  }
  skills: string[]
  match_context: string[]
}

const MAX_RESUME_CHUNKS = 6
const MAX_MATCHED_JOBS = 20
const MAX_JOB_QUERY_LENGTH = 2000
const DEFAULT_MATCH_QUERY = 'Hãy phân tích kỹ năng và kinh nghiệm trong CV này'

function isNotFoundError(error: unknown): error is AppError {
  return error instanceof AppError && error.statusCode === StatusCodes.NOT_FOUND
}

function toResumeSource(resume: Resume): ResumeSource {
  return {
    type: 'resume',
    id: String(resume._id),
    title: resume.title
  }
}

function toSafeResume(resume: Resume): SafeResume {
  const indexing = resume.indexing

  return {
    resume_id: String(resume._id),
    title: resume.title,
    is_default: Boolean(resume.is_default),
    indexing: indexing
      ? {
          status: indexing.status,
          chunks_indexed: indexing.chunks_indexed,
          started_at: indexing.started_at,
          completed_at: indexing.completed_at,
          updated_at: indexing.updated_at
        }
      : undefined,
    ready_for_retrieval: indexing?.status === 'completed' && indexing.chunks_indexed > 0
  }
}

function getUnavailableRetrievalData(resume: Resume): ResumeNotReadyData | null {
  if (resume.indexing?.status === 'completed' && resume.indexing.chunks_indexed > 0) {
    return null
  }

  if (!resume.indexing) {
    return {
      status: 'not_ready',
      resume_id: String(resume._id),
      chunks: [],
      message: 'CV ch\u01b0a c\u00f3 tr\u1ea1ng th\u00e1i ch\u1ec9 m\u1ee5c; vui l\u00f2ng ch\u1ea1y l\u1ea1i pipeline x\u1eed l\u00fd CV.'
    }
  }

  if (resume.indexing.status === 'failed') {
    return {
      status: 'failed',
      resume_id: String(resume._id),
      chunks: [],
      message: 'CV khong the su dung cho truy xuat do qua trinh xu ly that bai.'
    }
  }

  if (resume.indexing.status === 'completed') {
    return {
      status: 'not_ready',
      resume_id: String(resume._id),
      chunks: [],
      message: 'CV chua co noi dung da duoc chi muc de truy xuat.'
    }
  }

  return {
    status: 'not_ready',
    resume_id: String(resume._id),
    chunks: [],
    message: 'CV dang duoc xu ly va chua san sang cho truy xuat.'
  }
}

function buildJobQuery(args: MatchResumeToJobsArguments, chunks: SafeResumeChunk[]): string {
  const requestedQuery = args.query?.trim() || DEFAULT_MATCH_QUERY
  const filters = [
    args.location ? `Dia diem mong muon: ${args.location}` : undefined,
    args.job_type ? `Loai hinh cong viec: ${args.job_type}` : undefined,
    args.level ? `Cap bac: ${args.level}` : undefined,
    args.category_id ? `Nhom nganh: ${args.category_id}` : undefined
  ].filter((value): value is string => Boolean(value))

  const resumeText = chunks
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join('\n')

  return [requestedQuery, ...filters, `Noi dung CV:\n${resumeText}`].join('\n').slice(0, MAX_JOB_QUERY_LENGTH)
}

export class AgentResumeToolsService {
  async getSelectedResume(
    args: GetSelectedResumeArguments,
    context: AgentToolExecutionContext
  ): Promise<AgentResumeToolResult<'get_selected_resume', SafeResume | null>> {
    try {
      const resume = await resumeService.getResumeForChat(context.user_id, args.resume_id)
      const data = toSafeResume(resume)

      return {
        tool: 'get_selected_resume',
        data,
        sources: [toResumeSource(resume)]
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return { tool: 'get_selected_resume', data: null, sources: [] }
      }

      throw error
    }
  }

  async searchResumeChunks(
    args: SearchResumeChunksArguments,
    context: AgentToolExecutionContext
  ): Promise<
    AgentResumeToolResult<
      'search_resume_chunks',
      { status: 'ready'; resume_id: string; chunks: SafeResumeChunk[] } | ResumeNotReadyData | null
    >
  > {
    let resume: Resume

    try {
      resume = await resumeService.getResumeForChat(context.user_id, args.resume_id)
    } catch (error) {
      if (isNotFoundError(error)) {
        return { tool: 'search_resume_chunks', data: null, sources: [] }
      }

      throw error
    }

    const unavailable = getUnavailableRetrievalData(resume)
    if (unavailable) {
      return {
        tool: 'search_resume_chunks',
        data: unavailable,
        sources: [toResumeSource(resume)]
      }
    }

    const limit = Math.min(args.limit ?? MAX_RESUME_CHUNKS, MAX_RESUME_CHUNKS)
    const retrievedChunks = await resumeChatRetrievalService.retrieveForCvReview(args.query, resume, limit)
    const chunks: SafeResumeChunk[] = retrievedChunks.map((chunk) => ({
      chunk_id: chunk.chunk_id,
      chunk_index: chunk.chunk_index,
      title: chunk.title,
      section: chunk.section,
      text: chunk.text,
      score: chunk.score
    }))

    return {
      tool: 'search_resume_chunks',
      data: {
        status: 'ready',
        resume_id: String(resume._id),
        chunks
      },
      sources: [toResumeSource(resume)]
    }
  }

  async matchResumeToJobs(
    args: MatchResumeToJobsArguments,
    context: AgentToolExecutionContext
  ): Promise<
    AgentResumeToolResult<
      'match_resume_to_jobs',
      { resume_id: string; jobs: SafeMatchedJob[] } | ResumeNotReadyData | null
    >
  > {
    let resume: Resume

    try {
      resume = await resumeService.getResumeForChat(context.user_id, args.resume_id)
    } catch (error) {
      if (isNotFoundError(error)) {
        return { tool: 'match_resume_to_jobs', data: null, sources: [] }
      }

      throw error
    }

    const unavailable = getUnavailableRetrievalData(resume)
    if (unavailable) {
      return {
        tool: 'match_resume_to_jobs',
        data: unavailable,
        sources: [toResumeSource(resume)]
      }
    }

    const retrievalQuery = args.query?.trim() || DEFAULT_MATCH_QUERY
    const retrievedChunks = await resumeChatRetrievalService.retrieveForCvReview(
      retrievalQuery,
      resume,
      MAX_RESUME_CHUNKS
    )
    const chunks: SafeResumeChunk[] = retrievedChunks.map((chunk) => ({
      chunk_id: chunk.chunk_id,
      chunk_index: chunk.chunk_index,
      title: chunk.title,
      section: chunk.section,
      text: chunk.text,
      score: chunk.score
    }))

    if (chunks.length === 0) {
      return {
        tool: 'match_resume_to_jobs',
        data: { resume_id: String(resume._id), jobs: [] },
        sources: [toResumeSource(resume)]
      }
    }

    const limit = Math.min(args.limit ?? 10, MAX_MATCHED_JOBS)
    const jobs = await jobChatRetrievalService.retrieveForJobSearch(buildJobQuery(args, chunks), limit)
    const matchContext = chunks.map((chunk) => chunk.chunk_id)
    const safeJobs: SafeMatchedJob[] = jobs.map((job) => ({
      job_id: job.job_id,
      title: job.title,
      company: job.company,
      location: job.location,
      level: job.level,
      job_type: job.job_type,
      salary: job.salary,
      skills: Array.isArray(job.skills) ? job.skills : [],
      match_context: matchContext
    }))

    return {
      tool: 'match_resume_to_jobs',
      data: {
        resume_id: String(resume._id),
        jobs: safeJobs
      },
      sources: [
        toResumeSource(resume),
        ...safeJobs.map((job) => ({
          type: 'job' as const,
          id: job.job_id,
          title: job.title
        }))
      ]
    }
  }
}

const agentResumeToolsService = new AgentResumeToolsService()
export default agentResumeToolsService
