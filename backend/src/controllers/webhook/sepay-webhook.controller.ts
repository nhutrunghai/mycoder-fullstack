import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import UserMessages from '~/constants/messages/index.js'
import { AppError } from '~/errors/app-error.js'
import adminSystemSettingService from '~/services/admin/system-setting.service.js'
import walletTopUpService from '~/services/client/wallet-topup.service.js'
import logger from '~/configs/logger.config.js'

export const sePayWebhookController = async (req: Request, res: Response) => {
  const expectedSecret = await adminSystemSettingService.getSePayWebhookSecret()
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const receivedSecret =
    (typeof req.headers['x-secret-key'] === 'string' ? req.headers['x-secret-key'] : '') ||
    authorization.replace(/^apikey\s+/i, '').trim()

  if (expectedSecret && receivedSecret !== expectedSecret) {
    throw new AppError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: UserMessages.PAYMENT_WEBHOOK_SECRET_INVALID
    })
  }

  const result = await walletTopUpService.processWebhook(req.body as Record<string, unknown>)
  logger.info(
    {
      tag: 'payment_webhook_processed',
      processed: result.processed,
      reason: result.reason
    },
    'SePay webhook processed'
  )

  return res.status(StatusCodes.OK).json({
    success: true,
    status: 'success',
    message: UserMessages.PAYMENT_WEBHOOK_RECEIVED,
    data: result
  })
}
