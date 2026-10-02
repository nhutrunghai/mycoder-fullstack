import _ from 'lodash'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import { JobApplicationStatus, JobStatus } from '~/constants/enums.js'

class AdminCompanyService {
  async getCompanies({
    companyId,
    verified,
    keyword,
    page,
    limit
  }: {
    companyId?: ObjectId
    verified?: boolean
    keyword?: string
    page: number
    limit: number
  }) {
    const query: {
      _id?: ObjectId
      verified?: boolean
      company_name?: {
        $regex: string
        $options: string
      }
    } = {}

    if (companyId) {
      query._id = companyId
    }

    if (verified !== undefined) {
      query.verified = verified
    }

    if (keyword) {
      query.company_name = {
        $regex: _.escapeRegExp(keyword),
        $options: 'i'
      }
    }

    const [companies, total, statsResult] = await Promise.all([
      databaseService.companies
        .aggregate<{
          _id: ObjectId
          company_name: string
          logo?: string
          website?: string
          address: string
          verified?: boolean
          created_at?: Date
          updated_at?: Date
          owner?: {
            _id: ObjectId
            fullName?: string
            email: string
          }
        }>([
          { $match: query },
          { $sort: { updated_at: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: databaseService.users.collectionName,
              localField: 'user_id',
              foreignField: '_id',
              as: 'owner'
            }
          },
          {
            $unwind: {
              path: '$owner',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              _id: 1,
              company_name: 1,
              logo: 1,
              website: 1,
              address: 1,
              verified: 1,
              created_at: 1,
              updated_at: 1,
              owner: {
                _id: '$owner._id',
                fullName: '$owner.fullName',
                email: '$owner.email'
              }
            }
          }
        ])
        .toArray(),
      databaseService.companies.countDocuments(query),
      databaseService.companies
        .aggregate<{
          total: number
          verified: number
          unverified: number
        }>([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              verified: { $sum: { $cond: [{ $eq: ['$verified', true] }, 1, 0] } },
              unverified: {
                $sum: { $cond: [{ $or: [{ $eq: ['$verified', false] }, { $not: ['$verified'] }] }, 1, 0] }
              }
            }
          }
        ])
        .toArray()
    ])

    const stats = statsResult[0] || {
      total: 0,
      verified: 0,
      unverified: 0
    }

    return {
      companies,
      stats: {
        total: stats.total || 0,
        verified: stats.verified || 0,
        unverified: stats.unverified || 0
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async getCompanyDetail(companyId: ObjectId) {
    return databaseService.companies
      .aggregate<{
        _id: ObjectId
        company_name: string
        logo?: string
        website?: string
        address: string
        description?: string
        verified?: boolean
        created_at?: Date
        updated_at?: Date
        owner: {
          _id: ObjectId
          email: string
          fullName: string
          status?: number
          is_verified?: boolean
          role?: number
          created_at?: Date
          updated_at?: Date
        }
      }>([
        {
          $match: {
            _id: companyId
          }
        },
        {
          $lookup: {
            from: databaseService.users.collectionName,
            localField: 'user_id',
            foreignField: '_id',
            as: 'owner'
          }
        },
        {
          $unwind: '$owner'
        },
        {
          $project: {
            _id: 1,
            company_name: 1,
            logo: 1,
            website: 1,
            address: 1,
            description: 1,
            verified: 1,
            created_at: 1,
            updated_at: 1,
            owner: {
              _id: '$owner._id',
              email: '$owner.email',
              fullName: '$owner.fullName',
              status: '$owner.status',
              is_verified: '$owner.is_verified',
              role: '$owner.role',
              created_at: '$owner.created_at',
              updated_at: '$owner.updated_at'
            }
          }
        }
      ])
      .next()
  }

  async getCompanyJobsForAdmin({
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

  async getCompanyApplicationsForAdmin({
    companyId,
    status,
    jobId,
    candidateId,
    page,
    limit
  }: {
    companyId: ObjectId
    status?: JobApplicationStatus
    jobId?: ObjectId
    candidateId?: ObjectId
    page: number
    limit: number
  }) {
    const match: {
      company_id: ObjectId
      status?: JobApplicationStatus
      job_id?: ObjectId
      candidate_id?: ObjectId
    } = {
      company_id: companyId
    }

    if (status) {
      match.status = status
    }

    if (jobId) {
      match.job_id = jobId
    }

    if (candidateId) {
      match.candidate_id = candidateId
    }

    const [applications, totalResult] = await Promise.all([
      databaseService.jobApplications
        .aggregate<{
          _id: ObjectId
          status?: JobApplicationStatus
          applied_at?: Date
          updated_at?: Date
          job: {
            _id: ObjectId
            title: string
          }
          candidate: {
            _id: ObjectId
            fullName: string
            email: string
          }
        }>([
          {
            $match: match
          },
          {
            $sort: {
              applied_at: -1
            }
          },
          {
            $skip: (page - 1) * limit
          },
          {
            $limit: limit
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
            $lookup: {
              from: databaseService.users.collectionName,
              localField: 'candidate_id',
              foreignField: '_id',
              as: 'candidate'
            }
          },
          {
            $unwind: '$candidate'
          },
          {
            $project: {
              _id: 1,
              status: 1,
              applied_at: 1,
              updated_at: 1,
              job: {
                _id: '$job._id',
                title: '$job.title'
              },
              candidate: {
                _id: '$candidate._id',
                fullName: '$candidate.fullName',
                email: '$candidate.email'
              }
            }
          }
        ])
        .toArray(),
      databaseService.jobApplications
        .aggregate<{ total: number }>([
          { $match: match },
          { $count: 'total' }
        ])
        .toArray()
    ])

    const total = totalResult[0]?.total || 0

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async updateCompanyVerificationStatus(companyId: ObjectId, verified: boolean) {
    return databaseService.companies.findOneAndUpdate(
      { _id: companyId },
      {
        $set: {
          verified,
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    )
  }
}

const adminCompanyService = new AdminCompanyService()

export default adminCompanyService