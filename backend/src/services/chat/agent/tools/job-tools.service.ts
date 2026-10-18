import { AgentToolArguments } from '~/services/chat/agent/tools/tool-arguments.schema'
import jobsService from '~/services/client/job.service'
import companyService from '~/services/client/company.service'

export type AgentToolExecutionContext = {
  user_id: string
}

export type AgentToolSource = {
  type: 'job' | 'company'
  id: string
  title?: string
}

export type AgentToolExecutionResult<
  Tool extends 'search_jobs' | 'count_jobs' | 'compare_jobs' | 'get_job_detail' | 'get_job_details' | 'get_company_detail',
  Data
> = {
  tool: Tool
  data: Data
  sources: AgentToolSource[]
}

type SearchJobsArguments = AgentToolArguments['search_jobs']
type CountJobsArguments = AgentToolArguments['count_jobs']
type CompareJobsArguments = AgentToolArguments['compare_jobs']
type GetJobDetailArguments = AgentToolArguments['get_job_detail']
type GetJobDetailsArguments = AgentToolArguments['get_job_details']
type GetCompanyDetailArguments = AgentToolArguments['get_company_detail']

type PublicJobSummary = {
  job_id: string
  title: string
  company_name: string
  location: string
  job_type: string
  level: string
  salary: unknown
  skills: string[]
  published_at: Date
  expired_at: Date
}

type PublicJobDetailData = {
  job_id: string
  title: string
  description: string
  requirements: string
  benefits: string
  salary: unknown
  location: string
  job_type: string
  level: string
  category_ids: string[]
  skills: string[]
  quantity: number
  published_at?: Date
  expired_at: Date
  company: {
    company_id: string
    company_name: string
    logo?: string
    website?: string
    address: string
    description?: string
  }
}

type PublicCompanyDetailData = {
  company_id: string
  company_name: string
  logo?: string
  website?: string
  address: string
  description?: string
  verified?: boolean
}

type CompareJobsData = {
  items: PublicJobDetailData[]
}

const toSearchParams = (args: SearchJobsArguments | CountJobsArguments, limit: number) => ({
  q: args.query,
  location: args.location,
  job_type: args.job_type,
  level: args.level,
  category_id: args.category_id,
  page: 1,
  limit
})

export class AgentJobToolsService {
  async searchJobs(
    args: SearchJobsArguments,
    _context: AgentToolExecutionContext
  ): Promise<AgentToolExecutionResult<'search_jobs', { items: PublicJobSummary[]; total: number; page: 1; limit: number }>> {
    const limit = Math.min(args.limit ?? 10, 20)
    const result = await jobsService.searchPublicJobsForChat(toSearchParams(args, limit))
    const items = result.items.map((job) => ({
      job_id: String(job._id),
      title: job.title,
      company_name: job.company.company_name,
      location: job.location,
      job_type: job.job_type,
      level: job.level,
      salary: job.salary,
      skills: Array.isArray(job.skills) ? job.skills : [],
      published_at: job.published_at,
      expired_at: job.expired_at
    }))

    return {
      tool: 'search_jobs',
      data: {
        items,
        total: result.pagination.total,
        page: 1,
        limit
      },
      sources: items.map((job) => ({
        type: 'job',
        id: job.job_id,
        title: job.title
      }))
    }
  }

  async countJobs(
    args: CountJobsArguments,
    _context: AgentToolExecutionContext
  ): Promise<AgentToolExecutionResult<'count_jobs', { total: number; filters: CountJobsArguments }>> {
    const filters = {
      ...args
    }
    const total = await jobsService.countPublicJobs(toSearchParams(filters, 1))

    return {
      tool: 'count_jobs',
      data: {
        total,
        filters
      },
      sources: []
    }
  }

  async compareJobs(
    args: CompareJobsArguments,
    _context: AgentToolExecutionContext
  ): Promise<AgentToolExecutionResult<'compare_jobs', CompareJobsData>> {
    const details = await Promise.all(args.job_ids.map((jobId) => jobsService.getPublicJobDetail(jobId)))
    const items: PublicJobDetailData[] = []
    const sources: AgentToolSource[] = []

    for (const detail of details) {
      if (!detail) {
        continue
      }

      const data = this.toPublicJobDetailData(detail)
      items.push(data)
      sources.push(
        { type: 'job', id: data.job_id, title: data.title },
        { type: 'company', id: data.company.company_id, title: data.company.company_name }
      )
    }

    return {
      tool: 'compare_jobs',
      data: { items },
      sources
    }
  }

  async getJobDetail(
    args: GetJobDetailArguments,
    _context: AgentToolExecutionContext
  ): Promise<AgentToolExecutionResult<'get_job_detail', PublicJobDetailData | null>> {
    const detail = await jobsService.getPublicJobDetail(args.job_id)

    if (!detail) {
      return { tool: 'get_job_detail', data: null, sources: [] }
    }

    const data = this.toPublicJobDetailData(detail)

    return {
      tool: 'get_job_detail',
      data,
      sources: [
        { type: 'job', id: data.job_id, title: data.title },
        { type: 'company', id: data.company.company_id, title: data.company.company_name }
      ]
    }
  }

  async getJobDetails(
    args: GetJobDetailsArguments,
    _context: AgentToolExecutionContext
  ): Promise<AgentToolExecutionResult<'get_job_details', { items: PublicJobDetailData[] }>> {
    const details = await Promise.all(args.job_ids.map((jobId) => jobsService.getPublicJobDetail(jobId)))
    const items: PublicJobDetailData[] = []
    const sources: AgentToolSource[] = []

    for (const detail of details) {
      if (!detail) {
        continue
      }

      const data = this.toPublicJobDetailData(detail)
      items.push(data)
      sources.push(
        { type: 'job', id: data.job_id, title: data.title },
        { type: 'company', id: data.company.company_id, title: data.company.company_name }
      )
    }

    return {
      tool: 'get_job_details',
      data: { items },
      sources
    }
  }

  private toPublicJobDetailData(detail: NonNullable<Awaited<ReturnType<typeof jobsService.getPublicJobDetail>>>) {
    return {
      job_id: String(detail.job._id),
      title: detail.job.title,
      description: detail.job.description,
      requirements: detail.job.requirements,
      benefits: detail.job.benefits,
      salary: detail.job.salary,
      location: detail.job.location,
      job_type: detail.job.job_type,
      level: detail.job.level,
      category_ids: detail.job.category_ids.map(String),
      skills: Array.isArray(detail.job.skills) ? detail.job.skills : [],
      quantity: detail.job.quantity,
      published_at: detail.job.published_at,
      expired_at: detail.job.expired_at,
      company: {
        company_id: String(detail.company._id),
        company_name: detail.company.company_name,
        logo: detail.company.logo,
        website: detail.company.website,
        address: detail.company.address,
        description: detail.company.description
      }
    } satisfies PublicJobDetailData
  }

  async getCompanyDetail(
    args: GetCompanyDetailArguments,
    _context: AgentToolExecutionContext
  ): Promise<AgentToolExecutionResult<'get_company_detail', PublicCompanyDetailData | null>> {
    const company = await companyService.getPublicCompanyDetail(args.company_id)

    if (!company) {
      return { tool: 'get_company_detail', data: null, sources: [] }
    }

    const data: PublicCompanyDetailData = {
      company_id: String(company._id),
      company_name: company.company_name,
      logo: company.logo,
      website: company.website,
      address: company.address,
      description: company.description,
      verified: company.verified
    }

    return {
      tool: 'get_company_detail',
      data,
      sources: [{ type: 'company', id: data.company_id, title: data.company_name }]
    }
  }
}

const agentJobToolsService = new AgentJobToolsService()
export default agentJobToolsService
