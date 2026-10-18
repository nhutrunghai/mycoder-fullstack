import { ObjectId } from 'mongodb'
import { JobLevel, JobType } from '../src/constants/enums/job.enum.js'

jest.mock('../src/services/client/job.service.js', () => ({
  __esModule: true,
  default: {
    searchPublicJobsForChat: jest.fn(),
    countPublicJobs: jest.fn(),
    getPublicJobDetail: jest.fn()
  }
}))

jest.mock('../src/services/client/company.service.js', () => ({
  __esModule: true,
  default: {
    getPublicCompanyDetail: jest.fn()
  }
}))

import jobsService from '../src/services/client/job.service.js'
import companyService from '../src/services/client/company.service.js'
import { AgentJobToolsService } from '../src/services/chat/agent/tools/job-tools.service.js'

const userId = '507f1f77bcf86cd799439011'
const jobId = '507f1f77bcf86cd799439012'
const companyId = '507f1f77bcf86cd799439013'
const context = { user_id: userId }

const mockedJobsService = jest.mocked(jobsService)
const mockedCompanyService = jest.mocked(companyService)

describe('agent job tools service', () => {
  const service = new AgentJobToolsService()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps search_jobs arguments to the hybrid public search and exposes only safe summaries', async () => {
    mockedJobsService.searchPublicJobsForChat.mockResolvedValue({
      items: [
        {
          _id: new ObjectId(jobId),
          title: 'Frontend Engineer',
          location: 'Ho Chi Minh City',
          job_type: JobType.FULL_TIME,
          level: JobLevel.MIDDLE,
          salary: { min: 20000000, max: 30000000, currency: 'VND' },
          skills: ['React', 'TypeScript'],
          published_at: new Date('2026-10-01T00:00:00.000Z'),
          expired_at: new Date('2026-11-01T00:00:00.000Z'),
          company: { _id: new ObjectId(companyId), company_name: 'Acme', logo: 'logo.png' },
          description: 'private to summary',
          requirements: 'private to summary',
          benefits: 'private to summary'
        }
      ],
      pagination: { page: 1, limit: 10, total: 37, total_pages: 4 }
    })

    const result = await service.searchJobs(
      {
        query: 'Frontend',
        location: 'Ho Chi Minh City',
        job_type: JobType.FULL_TIME,
        level: JobLevel.MIDDLE,
        limit: 99
      } as never,
      context
    )

    expect(mockedJobsService.searchPublicJobsForChat).toHaveBeenCalledWith({
      q: 'Frontend',
      location: 'Ho Chi Minh City',
      job_type: JobType.FULL_TIME,
      level: JobLevel.MIDDLE,
      category_id: undefined,
      page: 1,
      limit: 20
    })
    expect(result).toEqual({
      tool: 'search_jobs',
      data: {
        items: [
          {
            job_id: jobId,
            title: 'Frontend Engineer',
            company_name: 'Acme',
            location: 'Ho Chi Minh City',
            job_type: JobType.FULL_TIME,
            level: JobLevel.MIDDLE,
            salary: { min: 20000000, max: 30000000, currency: 'VND' },
            skills: ['React', 'TypeScript'],
            published_at: new Date('2026-10-01T00:00:00.000Z'),
            expired_at: new Date('2026-11-01T00:00:00.000Z')
          }
        ],
        total: 37,
        page: 1,
        limit: 20
      },
      sources: [{ type: 'job', id: jobId, title: 'Frontend Engineer' }]
    })
    expect(JSON.stringify(result)).not.toContain('private to summary')
  })

  it('defaults search_jobs limit to 10', async () => {
    mockedJobsService.searchPublicJobsForChat.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, total_pages: 0 }
    })

    await service.searchJobs({ query: 'Frontend' }, context)

    expect(mockedJobsService.searchPublicJobsForChat).toHaveBeenCalledWith({
      q: 'Frontend',
      location: undefined,
      job_type: undefined,
      level: undefined,
      category_id: undefined,
      page: 1,
      limit: 10
    })
  })

  it('uses the database-wide public count path rather than the search page total', async () => {
    mockedJobsService.countPublicJobs.mockResolvedValue(37)

    const result = await service.countJobs(
      {
        query: 'DevOps',
        location: 'Da Nang',
        job_type: JobType.REMOTE,
        level: JobLevel.SENIOR,
        category_id: '507f1f77bcf86cd799439014'
      },
      context
    )

    expect(mockedJobsService.countPublicJobs).toHaveBeenCalledWith({
      q: 'DevOps',
      location: 'Da Nang',
      job_type: JobType.REMOTE,
      level: JobLevel.SENIOR,
      category_id: '507f1f77bcf86cd799439014',
      page: 1,
      limit: 1
    })
    expect(result).toEqual({
      tool: 'count_jobs',
      data: {
        total: 37,
        filters: {
          query: 'DevOps',
          location: 'Da Nang',
          job_type: JobType.REMOTE,
          level: JobLevel.SENIOR,
          category_id: '507f1f77bcf86cd799439014'
        }
      },
      sources: []
    })
  })

  it('returns safe public job detail and sources, without private fields', async () => {
    mockedJobsService.getPublicJobDetail.mockResolvedValue({
      job: {
        _id: new ObjectId(jobId),
        title: 'Frontend Engineer',
        description: 'Build user interfaces.',
        requirements: 'React experience.',
        benefits: 'Health insurance.',
        salary: { min: 20000000, currency: 'VND' },
        location: 'Ho Chi Minh City',
        job_type: JobType.FULL_TIME,
        level: JobLevel.MIDDLE,
        category_ids: [new ObjectId('507f1f77bcf86cd799439014')],
        skills: ['React'],
        quantity: 2,
        published_at: new Date('2026-10-01T00:00:00.000Z'),
        expired_at: new Date('2026-11-01T00:00:00.000Z'),
        blocked_reason: 'must not leak'
      },
      company: {
        _id: new ObjectId(companyId),
        company_name: 'Acme',
        logo: 'logo.png',
        website: 'https://acme.example',
        address: 'District 1',
        description: 'Software company',
        user_id: new ObjectId(userId)
      }
    } as never)

    const result = await service.getJobDetail({ job_id: jobId }, context)

    expect(mockedJobsService.getPublicJobDetail).toHaveBeenCalledWith(jobId)
    expect(result.data).toEqual(
      expect.objectContaining({
        job_id: jobId,
        title: 'Frontend Engineer',
        company: expect.objectContaining({ company_id: companyId, company_name: 'Acme' })
      })
    )
    expect(result.sources).toEqual([
      { type: 'job', id: jobId, title: 'Frontend Engineer' },
      { type: 'company', id: companyId, title: 'Acme' }
    ])
    expect(JSON.stringify(result)).not.toContain('must not leak')
    expect(JSON.stringify(result)).not.toContain(userId)
  })

  it('returns null with no sources when a public job is not found', async () => {
    mockedJobsService.getPublicJobDetail.mockResolvedValue(null)

    await expect(service.getJobDetail({ job_id: jobId }, context)).resolves.toEqual({
      tool: 'get_job_detail',
      data: null,
      sources: []
    })
  })

  it('returns details for every available requested job while preserving request order', async () => {
    mockedJobsService.getPublicJobDetail
      .mockResolvedValueOnce({
        job: {
          _id: new ObjectId(jobId),
          title: 'Frontend Engineer',
          description: 'Build user interfaces.',
          requirements: 'React experience.',
          benefits: 'Health insurance.',
          salary: { min: 20000000, currency: 'VND' },
          location: 'Ho Chi Minh City',
          job_type: JobType.FULL_TIME,
          level: JobLevel.MIDDLE,
          category_ids: [],
          skills: ['React'],
          quantity: 1
        },
        company: {
          _id: new ObjectId(companyId),
          company_name: 'Acme',
          address: 'District 1'
        }
      } as never)
      .mockResolvedValueOnce(null)

    const result = await service.getJobDetails(
      { job_ids: [jobId, '507f1f77bcf86cd799439014'] },
      context
    )

    expect(result.tool).toBe('get_job_details')
    expect(result.data.items).toHaveLength(1)
    expect(result.data.items[0]).toMatchObject({ job_id: jobId, title: 'Frontend Engineer' })
    expect(result.sources).toContainEqual({ type: 'job', id: jobId, title: 'Frontend Engineer' })
  })

  it('returns safe public company detail and no private ownership fields', async () => {
    mockedCompanyService.getPublicCompanyDetail.mockResolvedValue({
      _id: new ObjectId(companyId),
      company_name: 'Acme',
      logo: 'logo.png',
      website: 'https://acme.example',
      address: 'District 1',
      description: 'Software company',
      verified: true,
      user_id: new ObjectId(userId),
      payout_account: 'must not leak'
    } as never)

    const result = await service.getCompanyDetail({ company_id: companyId }, context)

    expect(mockedCompanyService.getPublicCompanyDetail).toHaveBeenCalledWith(companyId)
    expect(result).toEqual({
      tool: 'get_company_detail',
      data: {
        company_id: companyId,
        company_name: 'Acme',
        logo: 'logo.png',
        website: 'https://acme.example',
        address: 'District 1',
        description: 'Software company',
        verified: true
      },
      sources: [{ type: 'company', id: companyId, title: 'Acme' }]
    })
    expect(JSON.stringify(result)).not.toContain(userId)
    expect(JSON.stringify(result)).not.toContain('must not leak')
  })

  it('returns null with no sources when a public company is not found', async () => {
    mockedCompanyService.getPublicCompanyDetail.mockResolvedValue(null)

    await expect(service.getCompanyDetail({ company_id: companyId }, context)).resolves.toEqual({
      tool: 'get_company_detail',
      data: null,
      sources: []
    })
  })
})
