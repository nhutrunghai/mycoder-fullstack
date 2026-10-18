import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { AppError } from '../src/errors/app-error.js'

jest.mock('../src/services/client/resume.service.js', () => ({
  __esModule: true,
  default: {
    getResumeForChat: jest.fn()
  }
}))

jest.mock('../src/services/chat/retrieval/resume-retrieval.service.js', () => ({
  __esModule: true,
  default: {
    retrieveForCvReview: jest.fn()
  }
}))

jest.mock('../src/services/chat/retrieval/job-retrieval.service.js', () => ({
  __esModule: true,
  default: {
    retrieveForJobSearch: jest.fn()
  }
}))

import resumeService from '../src/services/client/resume.service.js'
import resumeChatRetrievalService from '../src/services/chat/retrieval/resume-retrieval.service.js'
import jobChatRetrievalService from '../src/services/chat/retrieval/job-retrieval.service.js'
import { AgentResumeToolsService } from '../src/services/chat/agent/tools/resume-tools.service.js'

const userId = '507f1f77bcf86cd799439011'
const resumeId = '507f1f77bcf86cd799439012'
const context = { user_id: userId }

const mockedResumeService = jest.mocked(resumeService)
const mockedResumeRetrievalService = jest.mocked(resumeChatRetrievalService)
const mockedJobRetrievalService = jest.mocked(jobChatRetrievalService)

function createResume(indexing?: {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  chunks_indexed: number
}) {
  return {
    _id: new ObjectId(resumeId),
    candidate_id: new ObjectId(userId),
    title: 'Frontend CV',
    cv_url: 'https://private.example/cv.pdf',
    resume_file_key: 'private-file-key',
    is_default: true,
    indexing: indexing && {
      ...indexing,
      started_at: new Date('2026-10-10T00:00:00.000Z'),
      completed_at: new Date('2026-10-10T00:01:00.000Z'),
      updated_at: new Date('2026-10-10T00:01:00.000Z')
    }
  }
}

describe('agent resume tools service', () => {
  const service = new AgentResumeToolsService()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the trusted context user id and returns only safe selected resume fields', async () => {
    mockedResumeService.getResumeForChat.mockResolvedValue(createResume({ status: 'completed', chunks_indexed: 3 }) as never)

    const result = await service.getSelectedResume({ resume_id: resumeId }, context)

    expect(mockedResumeService.getResumeForChat).toHaveBeenCalledWith(userId, resumeId)
    expect(result.data).toEqual({
      resume_id: resumeId,
      title: 'Frontend CV',
      is_default: true,
      indexing: {
        status: 'completed',
        chunks_indexed: 3,
        started_at: new Date('2026-10-10T00:00:00.000Z'),
        completed_at: new Date('2026-10-10T00:01:00.000Z'),
        updated_at: new Date('2026-10-10T00:01:00.000Z')
      },
      ready_for_retrieval: true
    })
    expect(JSON.stringify(result)).not.toContain('private.example')
    expect(JSON.stringify(result)).not.toContain('private-file-key')
    expect(JSON.stringify(result)).not.toContain(userId)
  })

  it.each([
    ['queued', 0],
    ['processing', 0],
    ['failed', 0],
    ['completed', 0]
  ] as const)('does not retrieve chunks when indexing is explicitly %s', async (status, chunksIndexed) => {
    mockedResumeService.getResumeForChat.mockResolvedValue(createResume({ status, chunks_indexed: chunksIndexed }) as never)

    const result = await service.searchResumeChunks({ query: 'React', limit: 6 }, context)

    expect(result.data).toEqual(
      expect.objectContaining({
        status: status === 'failed' ? 'failed' : 'not_ready',
        resume_id: resumeId,
        chunks: []
      })
    )
    expect(mockedResumeRetrievalService.retrieveForCvReview).not.toHaveBeenCalled()
  })

  it('retrieves completed resumes with bounded limits and safe chunks', async () => {
    mockedResumeService.getResumeForChat.mockResolvedValueOnce(
      createResume({ status: 'completed', chunks_indexed: 3 }) as never
    )
    mockedResumeRetrievalService.retrieveForCvReview.mockResolvedValueOnce([
      {
        resume_id: resumeId,
        candidate_id: userId,
        chunk_id: 'chunk-1',
        chunk_index: 0,
        status: 'active',
        is_default: true,
        title: 'Frontend CV',
        section: 'skills',
        text: 'React and TypeScript',
        score: 0.97
      }
    ] as never)

    const completedResult = await service.searchResumeChunks({ query: 'React', limit: 99 } as never, context)

    expect(mockedResumeRetrievalService.retrieveForCvReview).toHaveBeenCalledWith(
      'React',
      expect.objectContaining({ _id: expect.any(ObjectId) }),
      6
    )
    expect(completedResult.data).toEqual({
      status: 'ready',
      resume_id: resumeId,
      chunks: [
        {
          chunk_id: 'chunk-1',
          chunk_index: 0,
          title: 'Frontend CV',
          section: 'skills',
          text: 'React and TypeScript',
          score: 0.97
        }
      ]
    })
    expect(JSON.stringify(completedResult)).not.toContain(userId)

    mockedResumeService.getResumeForChat.mockResolvedValueOnce(createResume() as never)

    await expect(service.searchResumeChunks({ query: 'TypeScript' }, context)).resolves.toEqual({
      tool: 'search_resume_chunks',
      data: expect.objectContaining({
        status: 'not_ready',
        resume_id: resumeId,
        chunks: []
      }),
      sources: [{ type: 'resume', id: resumeId, title: 'Frontend CV' }]
    })
    expect(mockedResumeRetrievalService.retrieveForCvReview).toHaveBeenCalledTimes(1)
  })

  it('matches jobs from a non-empty bounded query and only exposes safe job data', async () => {
    mockedResumeService.getResumeForChat.mockResolvedValue(createResume({ status: 'completed', chunks_indexed: 2 }) as never)
    mockedResumeRetrievalService.retrieveForCvReview.mockResolvedValue([
      {
        resume_id: resumeId,
        candidate_id: userId,
        chunk_id: 'chunk-1',
        chunk_index: 0,
        status: 'active',
        is_default: true,
        title: 'Frontend CV',
        text: 'React '.repeat(700),
        score: 0.99
      }
    ] as never)
    mockedJobRetrievalService.retrieveForJobSearch.mockResolvedValue([
      {
        job_id: '507f1f77bcf86cd799439013',
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Da Nang',
        level: 'middle',
        job_type: 'full_time',
        salary: { currency: 'VND' },
        skills: ['React'],
        description: 'must not leak',
        requirements: 'must not leak',
        benefits: 'must not leak'
      }
    ])

    const result = await service.matchResumeToJobs(
      {
        query: ' ',
        location: 'Da Nang',
        job_type: 'full_time' as never,
        level: 'middle' as never,
        category_id: '507f1f77bcf86cd799439014',
        limit: 99
      } as never,
      context
    )

    expect(mockedResumeService.getResumeForChat).toHaveBeenCalledWith(userId, undefined)
    expect(mockedResumeRetrievalService.retrieveForCvReview).toHaveBeenCalledWith(
      expect.stringMatching(/\S/),
      expect.anything(),
      6
    )
    const [query, limit] = mockedJobRetrievalService.retrieveForJobSearch.mock.calls[0]
    expect(query).toContain('Da Nang')
    expect(query).toContain('full_time')
    expect(query.length).toBeLessThanOrEqual(2000)
    expect(limit).toBe(20)
    expect(result.data).toEqual({
      resume_id: resumeId,
      jobs: [
        expect.objectContaining({
          job_id: '507f1f77bcf86cd799439013',
          title: 'Frontend Engineer',
          match_context: ['chunk-1']
        })
      ]
    })
    expect(JSON.stringify(result)).not.toContain('must not leak')
    expect(JSON.stringify(result)).not.toContain(userId)
  })

  it('returns stable empty results for no chunks or missing resumes and propagates unexpected errors', async () => {
    mockedResumeService.getResumeForChat.mockResolvedValueOnce(
      createResume({ status: 'completed', chunks_indexed: 1 }) as never
    )
    mockedResumeRetrievalService.retrieveForCvReview.mockResolvedValueOnce([])

    await expect(service.matchResumeToJobs({}, context)).resolves.toEqual({
      tool: 'match_resume_to_jobs',
      data: { resume_id: resumeId, jobs: [] },
      sources: [{ type: 'resume', id: resumeId, title: 'Frontend CV' }]
    })
    expect(mockedJobRetrievalService.retrieveForJobSearch).not.toHaveBeenCalled()

    mockedResumeService.getResumeForChat.mockRejectedValueOnce(
      new AppError({ statusCode: StatusCodes.NOT_FOUND, message: 'Resume not found' })
    )
    await expect(service.searchResumeChunks({ query: 'React' }, context)).resolves.toEqual({
      tool: 'search_resume_chunks',
      data: null,
      sources: []
    })

    mockedResumeService.getResumeForChat.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(service.getSelectedResume({}, context)).rejects.toThrow('database unavailable')
  })
})
