import _ from 'lodash'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config'
import {
  JobLevel,
  JobModerationStatus,
  JobPromotionStatus,
  JobPromotionType,
  JobStatus,
  JobType
} from '~/constants/enums'
import Job from '~/models/schema/client/jobs.schema'
import jobIndexService from '~/services/chat/indexing/job-index.service'
import publicJobSearchService from '~/services/chat/search/public-job-search.service'
import { SearchPublicJobsParams } from '~/services/chat/search/job-search.type'

type GetLatestPublicJobsParams = {
  page: number
  limit: number
}

type GetFeaturedPublicJobsParams = {
  page: number
  limit: number
}

type PublicJobListItem = {
  _id: ObjectId
  title: string
  location: string
  job_type: JobType
  level: JobLevel
  salary: Job['salary']
  skills: string[]
  published_at: Date
  expired_at: Date
  company: {
    _id: ObjectId
    company_name: string
    logo?: string
  }
}

type PublicFeaturedJobListItem = PublicJobListItem & {
  promotion: {
    _id: ObjectId
    type: JobPromotionType
    priority: number
    starts_at: Date
    ends_at: Date
  }
}

class JobsService {
  async createJob(job: Job) {
    const result = await databaseService.jobs.insertOne(job)
    await jobIndexService.upsertJobDocument(result.insertedId)
    return result
  }

  async updateCompanyJob(jobId: ObjectId, payload: Partial<Job>) {
    const updatedJob = await databaseService.jobs.findOneAndUpdate(
      { _id: jobId },
      {
        $set: payload
      },
      {
        returnDocument: 'after'
      }
    )

    if (updatedJob?._id) {
      await jobIndexService.upsertJobDocument(updatedJob._id)
    }

    return updatedJob
  }

  async getCompanyJobs({
    companyId,
    status,
    keyword,
    page,
    limit
  }: {
    companyId: ObjectId
    status?: JobStatus
    keyword?: string
    page: number
    limit: number
  }) {
    const query: {
      company_id: ObjectId
      status?: JobStatus
      title?: {
        $regex: string
        $options: string
      }
    } = {
      company_id: companyId
    }

    if (status) {
      query.status = status
    }

    if (keyword) {
      query.title = {
        $regex: _.escapeRegExp(keyword),
        $options: 'i'
      }
    }

    const [jobs, total] = await Promise.all([
      databaseService.jobs
        .find(query)
        .sort({ updated_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      databaseService.jobs.countDocuments(query)
    ])

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async searchPublicJobs(params: SearchPublicJobsParams) {
    return publicJobSearchService.searchForPublicPage(params)
  }

  async searchPublicJobsForChat(params: SearchPublicJobsParams) {
    return publicJobSearchService.searchForChat(params)
  }

  async countPublicJobs(params: SearchPublicJobsParams) {
    return publicJobSearchService.countPublicJobs(params)
  }

  async getPublicJobDetail(jobId: string) {
    return publicJobSearchService.getPublicJobDetail(jobId)
  }

  async getLatestPublicJobs(params: GetLatestPublicJobsParams) {
    const page = params.page
    const limit = params.limit
    const now = new Date()
    const match = {
      status: JobStatus.OPEN,
      moderation_status: JobModerationStatus.ACTIVE,
      published_at: { $ne: null },
      expired_at: { $gt: now }
    }

    const [result] = await databaseService.jobs
      .aggregate<{
        items: PublicJobListItem[]
        total: { count: number }[]
      }>([
        {
          $match: match
        },
        {
          $sort: {
            published_at: -1,
            created_at: -1,
            _id: -1
          }
        },
        {
          $facet: {
            items: [
              {
                $skip: (page - 1) * limit
              },
              {
                $limit: limit
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
            ],
            total: [
              {
                $count: 'count'
              }
            ]
          }
        }
      ])
      .toArray()

    const total = result?.total[0]?.count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      items: result?.items || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages
      }
    }
  }

  async getFeaturedPublicJobs(params: GetFeaturedPublicJobsParams) {
    const page = params.page
    const limit = params.limit
    const now = new Date()

    await databaseService.jobPromotions.updateMany(
      { status: { $in: [JobPromotionStatus.ACTIVE, JobPromotionStatus.SCHEDULED] }, ends_at: { $lte: now } },
      { $set: { status: JobPromotionStatus.EXPIRED, updated_at: now } }
    )
    await databaseService.jobPromotions.updateMany(
      { status: JobPromotionStatus.SCHEDULED, starts_at: { $lte: now }, ends_at: { $gt: now } },
      { $set: { status: JobPromotionStatus.ACTIVE, updated_at: now } }
    )

    const [result] = await databaseService.jobPromotions
      .aggregate<{
        items: PublicFeaturedJobListItem[]
        total: { count: number }[]
      }>([
        {
          $match: {
            type: JobPromotionType.HOMEPAGE_FEATURED,
            status: JobPromotionStatus.ACTIVE,
            starts_at: { $lte: now },
            ends_at: { $gt: now }
          }
        },
        {
          $sort: {
            priority: -1,
            starts_at: -1,
            _id: -1
          }
        },
        {
          $group: {
            _id: '$job_id',
            promotion: { $first: '$$ROOT' }
          }
        },
        {
          $replaceRoot: {
            newRoot: '$promotion'
          }
        },
        {
          $lookup: {
            from: databaseService.jobs.collectionName,
            localField: 'job_id',
            foreignField: '_id',
            as: 'job'
          }
        },
        {
          $unwind: '$job'
        },
        {
          $match: {
            'job.status': JobStatus.OPEN,
            'job.moderation_status': JobModerationStatus.ACTIVE,
            'job.published_at': { $ne: null },
            'job.expired_at': { $gt: now }
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
          $sort: {
            priority: -1,
            starts_at: -1,
            _id: -1
          }
        },
        {
          $facet: {
            items: [
              {
                $skip: (page - 1) * limit
              },
              {
                $limit: limit
              },
              {
                $project: {
                  _id: '$job._id',
                  title: '$job.title',
                  location: '$job.location',
                  job_type: '$job.job_type',
                  level: '$job.level',
                  salary: '$job.salary',
                  skills: '$job.skills',
                  published_at: '$job.published_at',
                  expired_at: '$job.expired_at',
                  promotion: {
                    _id: '$_id',
                    type: '$type',
                    priority: '$priority',
                    starts_at: '$starts_at',
                    ends_at: '$ends_at'
                  },
                  company: {
                    _id: '$company._id',
                    company_name: '$company.company_name',
                    logo: '$company.logo'
                  }
                }
              }
            ],
            total: [
              {
                $count: 'count'
              }
            ]
          }
        }
      ])
      .toArray()

    const total = result?.total[0]?.count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      items: result?.items || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages
      }
    }
  }

}

const jobsService = new JobsService()
export default jobsService
