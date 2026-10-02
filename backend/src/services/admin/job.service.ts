import _ from 'lodash'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import { JobModerationStatus, JobStatus } from '~/constants/enums.js'
import jobIndexService from '~/services/chat/indexing/job-index.service.js'
import { buildUploadThingFileUrl } from '~/utils/avatar.util.js'

type AdminJobListItem = {
  _id: ObjectId
  title: string
  location: string
  job_type: string
  level: string
  salary?: {
    min?: number
    max?: number
    currency?: string
    is_negotiable?: boolean
  }
  status?: JobStatus
  moderation_status?: JobModerationStatus
  blocked_reason?: string
  published_at?: Date
  expired_at?: Date
  created_at?: Date
  updated_at?: Date
  company: {
    _id: ObjectId
    company_name: string
    verified?: boolean
  }
}

class AdminJobService {
  async getJobs({
    companyId,
    categoryId,
    status,
    moderationStatus,
    keyword,
    page,
    limit
  }: {
    companyId?: ObjectId
    categoryId?: ObjectId
    status?: JobStatus
    moderationStatus?: JobModerationStatus
    keyword?: string
    page: number
    limit: number
  }) {
    const matchQuery: Record<string, any> = {}

    if (companyId) {
      matchQuery.company_id = companyId
    }

    if (categoryId) {
      matchQuery.category_ids = categoryId
    }

    if (status) {
      matchQuery.status = status
    }

    if (moderationStatus) {
      matchQuery.moderation_status = moderationStatus
    }

    const pipeline: any[] = [
      { $match: matchQuery },
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
        $lookup: {
          from: databaseService.jobCategories.collectionName,
          localField: 'category_ids',
          foreignField: '_id',
          as: 'categories'
        }
      }
    ]

    if (keyword) {
      const escaped = _.escapeRegExp(keyword)
      pipeline.push({
        $match: {
          $or: [
            { title: { $regex: escaped, $options: 'i' } },
            { location: { $regex: escaped, $options: 'i' } },
            { 'company.company_name': { $regex: escaped, $options: 'i' } }
          ]
        }
      })
    }

    const countPipeline = [...pipeline, { $count: 'total' }]
    const dataPipeline = [
      ...pipeline,
      {
        $project: {
          _id: 1,
          title: 1,
          location: 1,
          job_type: 1,
          level: 1,
          salary: 1,
          status: 1,
          moderation_status: 1,
          blocked_reason: 1,
          published_at: 1,
          expired_at: 1,
          created_at: 1,
          updated_at: 1,
          company: {
            _id: '$company._id',
            company_name: '$company.company_name',
            verified: '$company.verified'
          },
          category_names: '$categories.name'
        }
      },
      { $sort: { updated_at: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]

    const [jobs, countResult, statsResult] = await Promise.all([
      databaseService.jobs.aggregate<AdminJobListItem>(dataPipeline).toArray(),
      databaseService.jobs.aggregate<{ total: number }>(countPipeline).toArray(),
      databaseService.jobs
        .aggregate<{
          total: number
          open: number
          paused: number
          blocked: number
        }>([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              open: {
                $sum: {
                  $cond: [{ $eq: ['$status', JobStatus.OPEN] }, 1, 0]
                }
              },
              paused: {
                $sum: {
                  $cond: [{ $eq: ['$status', JobStatus.PAUSED] }, 1, 0]
                }
              },
              blocked: {
                $sum: {
                  $cond: [{ $eq: ['$moderation_status', JobModerationStatus.BLOCKED] }, 1, 0]
                }
              }
            }
          }
        ])
        .toArray()
    ])

    const total = countResult[0]?.total ?? 0
    const stats = statsResult[0] ?? {
      total: 0,
      open: 0,
      paused: 0,
      blocked: 0
    }

    return {
      jobs,
      stats,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async updateModerationStatus({
    jobId,
    moderationStatus,
    blockedReason,
    adminUserId
  }: {
    jobId: ObjectId
    moderationStatus: JobModerationStatus
    blockedReason?: string
    adminUserId: ObjectId
  }) {
    const now = new Date()

    const updatedJob =
      moderationStatus === JobModerationStatus.BLOCKED
        ? await databaseService.jobs.findOneAndUpdate(
            { _id: jobId },
            {
              $set: {
                moderation_status: JobModerationStatus.BLOCKED,
                blocked_reason: blockedReason,
                blocked_at: now,
                blocked_by: adminUserId,
                updated_at: now
              }
            },
            {
              returnDocument: 'after'
            }
          )
        : await databaseService.jobs.findOneAndUpdate(
            { _id: jobId },
            {
              $set: {
                moderation_status: JobModerationStatus.ACTIVE,
                updated_at: now
              },
              $unset: {
                blocked_reason: '',
                blocked_at: '',
                blocked_by: ''
              }
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

  async getJobApplicationsForAdmin({
    jobId,
    page = 1,
    limit = 20
  }: {
    jobId: ObjectId
    page?: number
    limit?: number
  }) {
    const match = { job_id: jobId }

    const [applications, total] = await Promise.all([
      databaseService.jobApplications
        .aggregate([
          { $match: match },
          { $sort: { applied_at: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: databaseService.users.collectionName,
              localField: 'candidate_id',
              foreignField: '_id',
              as: 'candidate'
            }
          },
          {
            $unwind: {
              path: '$candidate',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              _id: 1,
              status: 1,
              applied_at: 1,
              updated_at: 1,
              candidate: {
                _id: '$candidate._id',
                fullName: '$candidate.fullName',
                email: '$candidate.email',
                avatar_file_key: '$candidate.avatar_file_key',
                username: '$candidate.username'
              }
            }
          }
        ])
        .toArray(),
      databaseService.jobApplications.countDocuments(match)
    ])

    return {
      applications: applications.map((app: any) => ({
        _id: app._id,
        status: app.status,
        applied_at: app.applied_at,
        updated_at: app.updated_at,
        candidate: app.candidate
          ? {
              _id: app.candidate._id,
              fullName: app.candidate.fullName,
              email: app.candidate.email,
              avatar: buildUploadThingFileUrl(app.candidate.avatar_file_key),
              username: app.candidate.username
            }
          : null
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }
}

const adminJobService = new AdminJobService()

export default adminJobService
