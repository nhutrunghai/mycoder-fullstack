import { ObjectId } from 'mongodb'

const mockInsertOne = jest.fn()
const mockUpdateOne = jest.fn()
const mockIngestResume = jest.fn()
const mockSyncCandidateDefaultResume = jest.fn()

jest.mock('../src/configs/database.config.js', () => ({
  __esModule: true,
  default: {
    resumes: {
      insertOne: mockInsertOne,
      updateOne: mockUpdateOne
    }
  }
}))

jest.mock('../src/services/chat/ingestion/resume-ingestion.service.js', () => ({
  __esModule: true,
  default: {
    ingestResume: mockIngestResume
  }
}))

jest.mock('../src/services/chat/indexing/resume-index.service.js', () => ({
  __esModule: true,
  default: {
    syncCandidateDefaultResume: mockSyncCandidateDefaultResume
  }
}))

jest.mock('../src/providers/uploadthing.provider.js', () => ({
  __esModule: true,
  default: {
    deleteFile: jest.fn()
  }
}))

jest.mock('../src/configs/logger.config.js', () => ({
  __esModule: true,
  default: {
    error: jest.fn()
  }
}))

import Resume from '../src/models/schema/client/resumes.schema.js'
import resumeService from '../src/services/client/resume.service.js'

const candidateId = new ObjectId('64b64c2f1d94338aa7e8ba01')
const resumeId = new ObjectId('64b64c2f1d94338aa7e8ba02')

const flushBackgroundWork = async () => {
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

describe('resume indexing state', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInsertOne.mockResolvedValue({ insertedId: resumeId })
    mockUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
    mockIngestResume.mockResolvedValue({
      status: 'completed',
      chunks_indexed: 3
    })
  })

  it('persists queued indexing state for a newly created resume', async () => {
    const result = await resumeService.createResume(String(candidateId), {
      title: 'CV Frontend',
      cv_url: 'https://files.example.com/cv.pdf',
      resume_file_key: 'private-file-key'
    })

    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        indexing: expect.objectContaining({
          status: 'queued',
          chunks_indexed: 0,
          updated_at: expect.any(Date)
        })
      })
    )
    expect(result.resume_indexing).toEqual(
      expect.objectContaining({
        status: 'queued',
        chunks_indexed: 0
      })
    )
  })

  it('persists processing then completed state with indexed chunks and completion timestamp', async () => {
    await resumeService.createResume(String(candidateId), {
      title: 'CV Frontend',
      cv_url: 'https://files.example.com/cv.pdf',
      resume_file_key: 'private-file-key'
    })
    await flushBackgroundWork()

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      1,
      {
        _id: resumeId,
        candidate_id: candidateId
      },
      {
        $set: {
          indexing: expect.objectContaining({
            status: 'processing',
            chunks_indexed: 0,
            started_at: expect.any(Date),
            updated_at: expect.any(Date)
          }),
          updated_at: expect.any(Date)
        }
      }
    )
    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      2,
      {
        _id: resumeId,
        candidate_id: candidateId
      },
      {
        $set: {
          indexing: expect.objectContaining({
            status: 'completed',
            chunks_indexed: 3,
            started_at: expect.any(Date),
            completed_at: expect.any(Date),
            updated_at: expect.any(Date)
          }),
          updated_at: expect.any(Date)
        }
      }
    )
  })

  it.each([
    [
      'skipped result',
      {
        status: 'skipped',
        chunks_indexed: 0,
        error: 'Resume PDF does not contain extractable text.'
      }
    ],
    [
      'failed result',
      {
        status: 'failed',
        chunks_indexed: 0,
        error: 'Resume ingestion only supports PDF files.'
      }
    ]
  ])('persists failed state for an ingestion %s', async (_caseName, indexingResult) => {
    mockIngestResume.mockResolvedValueOnce(indexingResult)

    await resumeService.createResume(String(candidateId), {
      title: 'CV Frontend',
      cv_url: 'https://files.example.com/cv.pdf',
      resume_file_key: 'private-file-key'
    })
    await flushBackgroundWork()

    expect(mockUpdateOne).toHaveBeenLastCalledWith(
      {
        _id: resumeId,
        candidate_id: candidateId
      },
      {
        $set: {
          indexing: expect.objectContaining({
            status: 'failed',
            chunks_indexed: 0,
            error: indexingResult.error,
            started_at: expect.any(Date),
            completed_at: expect.any(Date)
          }),
          updated_at: expect.any(Date)
        }
      }
    )
  })

  it('persists failed state when ingestion throws', async () => {
    mockIngestResume.mockRejectedValueOnce(new Error('network details must not be persisted'))

    await resumeService.createResume(String(candidateId), {
      title: 'CV Frontend',
      cv_url: 'https://files.example.com/cv.pdf',
      resume_file_key: 'private-file-key'
    })
    await flushBackgroundWork()

    expect(mockUpdateOne).toHaveBeenLastCalledWith(
      {
        _id: resumeId,
        candidate_id: candidateId
      },
      {
        $set: {
          indexing: expect.objectContaining({
            status: 'failed',
            chunks_indexed: 0,
            error: 'Unable to process resume PDF.',
            started_at: expect.any(Date),
            completed_at: expect.any(Date)
          }),
          updated_at: expect.any(Date)
        }
      }
    )
  })

  it('always scopes indexing updates to the candidate and resume identifiers', async () => {
    const anotherCandidateId = new ObjectId('64b64c2f1d94338aa7e8ba03')

    await resumeService.updateResumeIndexingState(anotherCandidateId, resumeId, {
      status: 'failed',
      chunks_indexed: 0,
      error: 'Unable to process resume PDF.'
    })

    expect(mockUpdateOne).toHaveBeenCalledWith(
      {
        _id: resumeId,
        candidate_id: anotherCandidateId
      },
      expect.any(Object)
    )
  })

  it('keeps legacy resume documents without indexing readable without adding a new default', () => {
    const legacyResume = new Resume({
      _id: resumeId,
      candidate_id: candidateId,
      title: 'CV cu',
      cv_url: 'https://files.example.com/legacy.pdf'
    })

    expect(legacyResume.indexing).toBeUndefined()
    expect(legacyResume.title).toBe('CV cu')
  })
})
