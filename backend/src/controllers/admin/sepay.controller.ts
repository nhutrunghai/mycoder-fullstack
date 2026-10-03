import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { AdminAuditAction, AdminAuditTargetType } from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'
import adminAuditLogService from '~/services/admin/audit-log.service.js'
import adminSePayService from '~/services/admin/sepay.service.js'
import adminSystemSettingService, { SePayRuntimeConfig } from '~/services/admin/system-setting.service.js'
import { parseDateFilter } from '~/utils/date-range.util.js'

export const getAdminSePayConfigController = async (req: Request, res: Response) => {
  const config = await adminSePayService.getConfigStatus()

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: config
  })
}

export const updateAdminSePayConfigController = async (
  req: Request<any, any, Partial<SePayRuntimeConfig>>,
  res: Response
) => {
  const setting = await adminSystemSettingService.updateSePayConfig(req.body, req.user?._id)
  const config = await adminSePayService.getConfigStatus()

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.SEPAY_CONFIG_UPDATE,
    targetType: AdminAuditTargetType.SYSTEM_SETTING,
    targetId: setting?._id,
    statusCode: StatusCodes.OK,
    metadata: {
      updated_fields: Object.keys(req.body)
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: config
  })
}

export const rotateAdminSePaySecretsController = async (
  req: Request<any, any, { api_token?: string; webhook_secret?: string }>,
  res: Response
) => {
  const setting = await adminSystemSettingService.rotateSePaySecrets(req.body, req.user?._id)
  const config = await adminSePayService.getConfigStatus()

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.SEPAY_SECRET_ROTATE,
    targetType: AdminAuditTargetType.SYSTEM_SETTING,
    targetId: setting?._id,
    statusCode: StatusCodes.OK,
    metadata: {
      rotated_fields: Object.keys(req.body)
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: config
  })
}

export const testAdminSePayConnectionController = async (req: Request, res: Response) => {
  const result = await adminSePayService.testConnection()

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.ADMIN_SEPAY_CONNECTION_TEST_SUCCESS,
    data: result
  })
}

export const getAdminSePayDiagnosticsController = async (req: Request, res: Response) => {
  const { fromDate, toDate } = parseDateFilter(req.query)
  const diagnostics = await adminSePayService.getDiagnostics({ fromDate, toDate })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: diagnostics
  })
}
