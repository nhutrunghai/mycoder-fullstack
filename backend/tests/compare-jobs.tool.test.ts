import { ObjectId } from 'mongodb'
import { JobLevel, JobType } from '../src/constants/enums/job.enum.js'

jest.mock('../src/services/client/job.service.js', () => ({
  __esModule: true,
  default: {
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
import { AgentJobToolsService } from '../src/services/chat/agent/tools/job-tools.service.js'
import { parseAgentToolArguments } from '../src/services/chat/agent/tools/tool-arguments.schema.js'

const userId = '507f1f77bcf86cd799439011'
const firstJobId = '507f1f77bcf86cd799439012'
const secondJobId = '507f1f77bcf86cd799439013'
const missingJobId = '507f1f77bcf86cd799439014'
const firstCompanyId = '507f1f77bcf86cd799439015'
const secondCompanyId = '507f1f77bcf86cd799439016'

const mockedJobsService = jest.mocked(jobsService)

const publicDetail = (jobId: string, companyId: string, title: string) => ({
  job: {
    _id: new ObjectId(jobId),
    title,
    description: `${title} description`,
    requirements: `${title} requirements`,
    benefits: `${title} benefits`,
    salary: { min: 20000000, max: 30000000, currency: 'VND' as const },
    location: 'Ho Chi Minh City',
    job_type: JobType.FULL_TIME,
    level: JobLevel.MIDDLE,
    category_ids: [],
    skills: ['TypeScript'],
    quantity: 1,
    published_at: new Date('2026-10-01T00:00:00.000Z'),
    expired_at: new Date('2026-11-01T00:00:00.000Z'),
    private_job_field: 'must not leak'
  },
  company: {
    _id: new ObjectId(companyId),
    company_name: `${title} Company`,
    logo: 'logo.png',
    website: 'https://example.com',
    address: 'District 1',
    description: `${title} company`,
    user_id: new ObjectId(userId),
    payout_account: 'must not leak'
  }
})

describe('compare_jobs tool', () => {
  const service = new AgentJobToolsService()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('accepts 2 to 4 valid ObjectIds and rejects invalid counts or fields', () => {
    expect(parseAgentToolArguments('compare_jobs', { job_ids: [firstJobId, secondJobId] })).toEqual({
      job_ids: [firstJobId, secondJobId]
    })
    expect(
      parseAgentToolArguments('compare_jobs', {
        job_ids: [firstJobId, secondJobId, missingJobId, firstCompanyId]
      })
    ).toEqual({
      job_ids: [firstJobId, secondJobId, missingJobId, firstCompanyId]
    })

    for (const job_ids of [
      [firstJobId],
      [firstJobId, secondJobId, missingJobId, firstCompanyId, secondCompanyId],
      [firstJobId, 'not-an-object-id'],
      [firstJobId, firstJobId]
    ]) {
      expect(() => parseAgentToolArguments('compare_jobs', { job_ids })).toThrow()
    }

    expect(() =>
      parseAgentToolArguments('compare_jobs', { job_ids: [firstJobId, secondJobId], user_id: userId })
    ).toThrow()
  })

  it('preserves requested order and returns only safe public fields and sources', async () => {
    mockedJobsService.getPublicJobDetail
      .mockResolvedValueOnce(publicDetail(secondJobId, secondCompanyId, 'Backend Engineer') as never)
      .mockResolvedValueOnce(publicDetail(firstJobId, firstCompanyId, 'Frontend Engineer') as never)

    const result = await service.compareJobs({ job_ids: [secondJobId, firstJobId] }, { user_id: userId })

    expect(mockedJobsService.getPublicJobDetail).toHaveBeenNthCalledWith(1, secondJobId)
    expect(mockedJobsService.getPublicJobDetail).toHaveBeenNthCalledWith(2, firstJobId)
    expect(result.tool).toBe('compare_jobs')
    expect(result.data.items.map((item) => item.job_id)).toEqual([secondJobId, firstJobId])
    expect(result.sources).toEqual([
      { type: 'job', id: secondJobId, title: 'Backend Engineer' },
      { type: 'company', id: secondCompanyId, title: 'Backend Engineer Company' },
      { type: 'job', id: firstJobId, title: 'Frontend Engineer' },
      { type: 'company', id: firstCompanyId, title: 'Frontend Engineer Company' }
    ])
    expect(JSON.stringify(result)).not.toContain('must not leak')
    expect(JSON.stringify(result)).not.toContain(userId)
  })

  it('skips missing or unpublished jobs deterministically and returns no leaked source', async () => {
    mockedJobsService.getPublicJobDetail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(publicDetail(firstJobId, firstCompanyId, 'Frontend Engineer') as never)

    const result = await service.compareJobs({ job_ids: [missingJobId, firstJobId] }, { user_id: userId })

    expect(result.data.items.map((item) => item.job_id)).toEqual([firstJobId])
    expect(result.sources).toEqual([
      { type: 'job', id: firstJobId, title: 'Frontend Engineer' },
      { type: 'company', id: firstCompanyId, title: 'Frontend Engineer Company' }
    ])
  })
})
