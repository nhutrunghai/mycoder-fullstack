import { Request } from 'express'
import { ObjectId } from 'mongodb'
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
    const query: {
      admin_id?: ObjectId
      action?: string
      target_type?: string
      target_id?: ObjectId | string
      success?: boolean
      created_at?: {
        $gte?: Date
        $lte?: Date
      }
    } = {}

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

    const [logs, total] = await Promise.all([
      databaseService.adminAuditLogs
        .find(query)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
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
