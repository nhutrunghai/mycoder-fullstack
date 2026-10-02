import { Request } from 'express'
import { Filter, ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import { AdminAuditAction, AdminAuditTargetType } from '~/constants/enums.js'
import AdminAuditLog from '~/models/schema/admin/adminAuditLogs.schema.js'
import logger from '~/configs/logger.config.js'

type CreateAuditLogInput = {
  req?: Request
  adminId?: ObjectId
  adminEmail?: string
  action: AdminAuditAction | string
  targetType: AdminAuditTargetType | string
  targetId?: ObjectId | string
  statusCode?: number
  success?: boolean
  metadata?: Record<string, unknown>
}

class AdminAuditLogService {
  async create(input: CreateAuditLogInput) {
    const adminId = input.adminId || input.req?.user?._id

    if (!adminId) {
      return null
    }

    const log = new AdminAuditLog({
      admin_id: adminId,
      admin_email: input.adminEmail || input.req?.user?.email,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      method: input.req?.method,
      path: input.req?.originalUrl || input.req?.path,
      ip: input.req?.ip,
      user_agent: typeof input.req?.headers['user-agent'] === 'string' ? input.req.headers['user-agent'] : undefined,
      status_code: input.statusCode,
      success: input.success ?? true,
      metadata: this.sanitizeMetadata(input.metadata)
    })

    try {
      const result = await databaseService.adminAuditLogs.insertOne(log)
      return {
        _id: result.insertedId,
        ...log
      }
    } catch (error) {
      logger.error({ err: error, action: input.action }, 'Admin audit log write failed')
      return null
    }
  }

  async getLogs({
    keyword,
    adminId,
    action,
    targetType,
    targetId,
    success,
    fromDate,
    toDate,
    page,
    limit
  }: {
    keyword?: string
    adminId?: ObjectId
    action?: string
    targetType?: string
    targetId?: ObjectId | string
    success?: boolean
    fromDate?: Date
    toDate?: Date
    page: number
    limit: number
  }) {
    const query: Filter<AdminAuditLog> = {}

    if (adminId) {
      query.admin_id = adminId
    }

    if (action) {
      query.action = action
    }

    if (targetType) {
      query.target_type = targetType
    }

    if (targetId) {
      query.target_id = targetId
    }

    if (success !== undefined) {
      query.success = success
    }

    if (fromDate || toDate) {
      query.created_at = {}

      if (fromDate) {
        query.created_at.$gte = fromDate
      }

      if (toDate) {
        query.created_at.$lte = toDate
      }
    }

    if (keyword) {
      const trimmed = keyword.trim()
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'i')

      const [matchedUsers, matchedCompanies, matchedJobs] = await Promise.all([
        databaseService.users
          .find(
            { $or: [{ fullName: regex }, { username: regex }, { email: regex }] },
            { projection: { _id: 1 } }
          )
          .limit(50)
          .toArray(),
        databaseService.companies
          .find(
            { $or: [{ company_name: regex }, { email: regex }] },
            { projection: { _id: 1 } }
          )
          .limit(50)
          .toArray(),
        databaseService.jobs
          .find({ title: regex }, { projection: { _id: 1 } })
          .limit(50)
          .toArray()
      ])

      const matchedTargetIds: (ObjectId | string)[] = []
      const matchedAdminIds: ObjectId[] = []

      for (const u of matchedUsers) {
        matchedTargetIds.push(u._id)
        matchedTargetIds.push(u._id.toString())
        matchedAdminIds.push(u._id)
      }
      for (const c of matchedCompanies) {
        matchedTargetIds.push(c._id)
        matchedTargetIds.push(c._id.toString())
      }
      for (const j of matchedJobs) {
        matchedTargetIds.push(j._id)
        matchedTargetIds.push(j._id.toString())
      }

      const orConditions: any[] = [
        { action: { $regex: regex } },
        { admin_email: { $regex: regex } },
        { ip: { $regex: regex } },
        { target_type: { $regex: regex } }
      ]

      if (matchedAdminIds.length > 0) {
        orConditions.push({ admin_id: { $in: matchedAdminIds } })
      }

      if (matchedTargetIds.length > 0) {
        orConditions.push({ target_id: { $in: matchedTargetIds } })
      }

      if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
        orConditions.push({ target_id: new ObjectId(trimmed) })
        orConditions.push({ target_id: trimmed })
      } else {
        orConditions.push({ target_id: { $regex: regex } })
      }

      query.$or = orConditions
    }

    const [logs, total] = await Promise.all([
      databaseService.adminAuditLogs
        .aggregate([
          { $match: query },
          { $sort: { created_at: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: databaseService.users.collectionName,
              localField: 'admin_id',
              foreignField: '_id',
              as: 'admin'
            }
          },
          {
            $unwind: {
              path: '$admin',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $addFields: {
              admin_id: {
                $cond: [
                  { $ifNull: ['$admin._id', false] },
                  {
                    _id: '$admin._id',
                    fullName: '$admin.fullName',
                    username: '$admin.username',
                    email: '$admin.email',
                    avatar: '$admin.avatar'
                  },
                  {
                    _id: '$admin_id',
                    email: '$admin_email'
                  }
                ]
              },
              target_object_id: {
                $cond: [
                  { $eq: [{ $type: '$target_id' }, 'objectId'] },
                  '$target_id',
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: [{ $type: '$target_id' }, 'string'] },
                          { $regexMatch: { input: '$target_id', regex: '^[a-fA-F0-9]{24}$' } }
                        ]
                      },
                      { $toObjectId: '$target_id' },
                      null
                    ]
                  }
                ]
              }
            }
          },
          {
            $lookup: {
              from: databaseService.users.collectionName,
              localField: 'target_object_id',
              foreignField: '_id',
              as: 'target_user'
            }
          },
          {
            $lookup: {
              from: databaseService.companies.collectionName,
              localField: 'target_object_id',
              foreignField: '_id',
              as: 'target_company'
            }
          },
          {
            $lookup: {
              from: databaseService.jobs.collectionName,
              localField: 'target_object_id',
              foreignField: '_id',
              as: 'target_job'
            }
          },
          {
            $lookup: {
              from: databaseService.jobPromotionPlans.collectionName,
              localField: 'target_object_id',
              foreignField: '_id',
              as: 'target_promotion_plan'
            }
          },
          {
            $lookup: {
              from: databaseService.jobPromotions.collectionName,
              localField: 'target_object_id',
              foreignField: '_id',
              as: 'target_promotion'
            }
          },
          {
            $lookup: {
              from: databaseService.systemSettings.collectionName,
              localField: 'target_object_id',
              foreignField: '_id',
              as: 'target_setting'
            }
          },
          {
            $addFields: {
              target_name: {
                $switch: {
                  branches: [
                    {
                      case: { $in: ['$target_type', ['user', 'admin']] },
                      then: {
                        $let: {
                          vars: { u: { $arrayElemAt: ['$target_user', 0] } },
                          in: {
                            $cond: [
                              { $ifNull: ['$$u._id', false] },
                              {
                                _id: '$$u._id',
                                name: { $ifNull: ['$$u.fullName', '$$u.username'] },
                                email: '$$u.email'
                              },
                              null
                            ]
                          }
                        }
                      }
                    },
                    {
                      case: { $eq: ['$target_type', 'company'] },
                      then: {
                        $let: {
                          vars: { c: { $arrayElemAt: ['$target_company', 0] } },
                          in: {
                            $cond: [
                              { $ifNull: ['$$c._id', false] },
                              {
                                _id: '$$c._id',
                                name: '$$c.company_name',
                                email: '$$c.email'
                              },
                              null
                            ]
                          }
                        }
                      }
                    },
                    {
                      case: { $eq: ['$target_type', 'job'] },
                      then: {
                        $let: {
                          vars: { j: { $arrayElemAt: ['$target_job', 0] } },
                          in: {
                            $cond: [
                              { $ifNull: ['$$j._id', false] },
                              {
                                _id: '$$j._id',
                                name: '$$j.title'
                              },
                              null
                            ]
                          }
                        }
                      }
                    },
                    {
                      case: { $eq: ['$target_type', 'job_promotion_plan'] },
                      then: {
                        $let: {
                          vars: { pp: { $arrayElemAt: ['$target_promotion_plan', 0] } },
                          in: {
                            $cond: [
                              { $ifNull: ['$$pp._id', false] },
                              {
                                _id: '$$pp._id',
                                name: '$$pp.name',
                                code: '$$pp.code'
                              },
                              null
                            ]
                          }
                        }
                      }
                    },
                    {
                      case: { $eq: ['$target_type', 'job_promotion'] },
                      then: {
                        $let: {
                          vars: { p: { $arrayElemAt: ['$target_promotion', 0] } },
                          in: {
                            $cond: [
                              { $ifNull: ['$$p._id', false] },
                              {
                                _id: '$$p._id',
                                name: { $ifNull: ['$$p.plan_snapshot.name', 'Chiến dịch quảng cáo'] }
                              },
                              null
                            ]
                          }
                        }
                      }
                    },
                    {
                      case: { $eq: ['$target_type', 'system_setting'] },
                      then: {
                        $let: {
                          vars: { s: { $arrayElemAt: ['$target_setting', 0] } },
                          in: {
                            $cond: [
                              { $ifNull: ['$$s._id', false] },
                              {
                                _id: '$$s._id',
                                name: {
                                  $switch: {
                                    branches: [
                                      { case: { $in: ['$$s.key', ['sepay', 'SEPAY']] }, then: 'Cấu hình cổng SePay' },
                                      { case: { $in: ['$$s.key', ['rag_chat', 'RAG_CHAT']] }, then: 'Cấu hình trợ lý RAG AI' }
                                    ],
                                    default: { $ifNull: ['$$s.key', 'Cấu hình hệ thống'] }
                                  }
                                }
                              },
                              null
                            ]
                          }
                        }
                      }
                    },
                    {
                      case: { $in: ['$target_type', ['sepay', 'SEPAY']] },
                      then: { name: 'Cấu hình cổng SePay' }
                    },
                    {
                      case: { $in: ['$target_type', ['rag_chat', 'RAG_CHAT']] },
                      then: { name: 'Cấu hình trợ lý RAG AI' }
                    }
                  ],
                  default: null
                }
              }
            }
          },
          {
            $project: {
              admin: 0,
              target_object_id: 0,
              target_user: 0,
              target_company: 0,
              target_job: 0,
              target_promotion_plan: 0,
              target_promotion: 0,
              target_setting: 0
            }
          }
        ])
        .toArray(),
      databaseService.adminAuditLogs.countDocuments(query)
    ])

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>) {
    if (!metadata) {
      return undefined
    }

    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', 'api_key']
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeys.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = value
      }
    }

    return result
  }
}

const adminAuditLogService = new AdminAuditLogService()

export default adminAuditLogService