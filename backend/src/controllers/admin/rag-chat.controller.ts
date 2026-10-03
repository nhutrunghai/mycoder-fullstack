import ElasticsearchConfig from '~/configs/elasticsearch.config.js'
import UserMessages from '~/constants/messages/admin.message.js'
import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import env from '~/configs/env.config.js'
import { AdminAuditAction, AdminAuditTargetType } from '~/constants/enums.js'
import adminAuditLogService from '~/services/admin/audit-log.service.js'
import adminSystemSettingService, { LlmProvider, RagChatRuntimeConfig } from '~/services/admin/system-setting.service.js'

export const getAdminRagChatConfigController = async (req: Request, res: Response) => {
  const config = await adminSystemSettingService.getRagChatConfig()

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      config,
      secrets: await adminSystemSettingService.getRagChatSecretStatus()
    }
  })
}

export const updateAdminRagChatConfigController = async (
  req: Request<any, any, Partial<RagChatRuntimeConfig>>,
  res: Response
) => {
  const setting = await adminSystemSettingService.updateRagChatConfig(req.body, req.user?._id)
  const config = await adminSystemSettingService.getRagChatConfig()

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.RAG_CHAT_CONFIG_UPDATE,
    targetType: AdminAuditTargetType.SYSTEM_SETTING,
    targetId: setting?._id,
    statusCode: StatusCodes.OK,
    metadata: {
      updated_fields: Object.keys(req.body)
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      config,
      ...config
    }
  })
}

export const rotateAdminRagChatSecretsController = async (
  req: Request<any, any, { openai_api_key?: string; gemini_api_key?: string }>,
  res: Response
) => {
  const setting = await adminSystemSettingService.rotateRagChatSecrets(req.body, req.user?._id)
  const secretStatus = await adminSystemSettingService.getRagChatSecretStatus()

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.RAG_CHAT_SECRET_ROTATE,
    targetType: AdminAuditTargetType.SYSTEM_SETTING,
    targetId: setting?._id,
    statusCode: StatusCodes.OK,
    metadata: {
      rotated_fields: Object.keys(req.body)
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      secrets: secretStatus
    }
  })
}

export const getAdminRagChatHealthController = async (req: Request, res: Response) => {
  const config = await adminSystemSettingService.getRagChatConfig()
  const secretStatus = await adminSystemSettingService.getRagChatSecretStatus()
  const providerConfigured =
    config.provider === 'openai' ? secretStatus.openai_api_key_configured : secretStatus.gemini_api_key_configured

  let vectorDbConnected = false
  try {
    const es = ElasticsearchConfig.getInstance()
    vectorDbConnected = await Promise.race([
      es.ping(),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ])
  } catch {
    vectorDbConnected = false
  }

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      enabled: config.enabled,
      provider: config.provider,
      provider_configured: providerConfigured,
      openai_api_key_configured: secretStatus.openai_api_key_configured,
      openai_api_key_source: secretStatus.openai_api_key_source,
      openai_api_key_preview: secretStatus.openai_api_key_preview,
      gemini_api_key_configured: secretStatus.gemini_api_key_configured,
      gemini_api_key_source: secretStatus.gemini_api_key_source,
      gemini_api_key_preview: secretStatus.gemini_api_key_preview,
      vector_db_connected: vectorDbConnected,
      resume_search_index: env.RESUME_SEARCH_INDEX,
      public_jobs_search_index: env.PUBLIC_JOBS_SEARCH_INDEX,
      embedding_api_url: env.EMBEDDING_API_URL
    }
  })
}

export const testAdminRagChatConnectionController = async (req: Request, res: Response) => {
  const requestedProvider = req.body?.provider as LlmProvider | undefined
  const result = await adminSystemSettingService.testRagChatConnection(requestedProvider)

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.RAG_CHAT_CONNECTION_TEST,
    targetType: AdminAuditTargetType.RAG_CHAT,
    statusCode: result.connected ? StatusCodes.OK : StatusCodes.BAD_REQUEST,
    metadata: {
      provider: result.provider,
      model: result.model,
      connected: result.connected,
      latency_ms: result.latency_ms,
      reason: (result as any).reason || null
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: result.connected
      ? UserMessages.ADMIN_RAG_CHAT_CONNECTION_TEST_SUCCESS
      : 'Kiểm tra kết nối AI thất bại: ' + ((result as any).message || ''),
    data: result
  })
}
