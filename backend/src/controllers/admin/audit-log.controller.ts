import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import adminAuditLogService from '~/services/admin/audit-log.service.js'
import { parseDateFilter } from '~/utils/date-range.util.js'

export const getAdminAuditLogsController = async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined

  const rawAdminId = req.query.adminId || req.query.admin_id
  const adminId =
    typeof rawAdminId === 'string' && /^[a-fA-F0-9]{24}$/.test(rawAdminId) ? new ObjectId(rawAdminId) : undefined

  const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined

  const rawTargetType = req.query.targetType || req.query.target_type
  const targetType = typeof rawTargetType === 'string' && rawTargetType ? rawTargetType : undefined

  const rawTargetId = req.query.targetId || req.query.target_id
  const targetId =
    typeof rawTargetId === 'string' && rawTargetId
      ? /^[a-fA-F0-9]{24}$/.test(rawTargetId)
        ? new ObjectId(rawTargetId)
        : rawTargetId
      : undefined

  const success =
    req.query.success === 'true'
      ? true
      : req.query.success === 'false'
        ? false
        : undefined

  const { fromDate, toDate } = parseDateFilter(req.query)

  const result = await adminAuditLogService.getLogs({
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
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      logs: result.logs,
      pagination: result.pagination
    }
  })
}
