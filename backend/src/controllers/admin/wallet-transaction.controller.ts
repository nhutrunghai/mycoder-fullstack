import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import {
  AdminAuditAction,
  AdminAuditTargetType,
  NotificationType,
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType
} from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'
import adminAuditLogService from '~/services/admin/audit-log.service.js'
import adminWalletTransactionService from '~/services/admin/wallet-transaction.service.js'
import notificationService from '~/services/client/notification.service.js'
import logger from '~/configs/logger.config.js'

export const getAdminWalletTransactionsController = async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const keyword = typeof req.query.keyword === 'string' && req.query.keyword.trim() ? req.query.keyword.trim() : undefined
  const rawUserId = (req.query.userId || req.query.user_id) as string | undefined
  const userId = typeof rawUserId === 'string' && rawUserId.trim() ? new ObjectId(rawUserId.trim()) : undefined
  const type = req.query.type as WalletTransactionType | undefined
  const status = req.query.status as WalletTransactionStatus | undefined
  const direction = req.query.direction as WalletTransactionDirection | undefined

  const result = await adminWalletTransactionService.getWalletTransactions({
    keyword,
    userId,
    type,
    status,
    direction,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      transactions: result.transactions,
      pagination: result.pagination,
      stats: result.stats
    }
  })
}

export const adjustAdminWalletTransactionController = async (
  req: Request<
    any,
    any,
    {
      userId: string
      amount: number
      direction: WalletTransactionDirection
      description: string
    }
  >,
  res: Response
) => {
  const targetUserId = new ObjectId(req.body.userId)
  const normalizedDescription = req.body.description?.trim() || ''
  const result = await adminWalletTransactionService.adjustWalletBalance({
    userId: targetUserId,
    amount: req.body.amount,
    direction: req.body.direction,
    description: normalizedDescription
  })

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.WALLET_ADJUST,
    targetType: AdminAuditTargetType.USER,
    targetId: req.body.userId,
    statusCode: StatusCodes.OK,
    metadata: {
      wallet_id: result.wallet._id,
      transaction_id: result.transaction._id,
      amount: req.body.amount,
      direction: req.body.direction,
      balance_before: result.transaction.balance_before,
      balance_after: result.transaction.balance_after,
      description: normalizedDescription
    }
  })

  try {
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(req.body.amount)
    const reasonText = normalizedDescription ? ` Lý do: ${normalizedDescription}` : ''
    await notificationService.create({
      userId: targetUserId,
      type: NotificationType.WALLET_ADJUSTED,
      title: 'Số dư ví đã được điều chỉnh',
      content:
        req.body.direction === WalletTransactionDirection.CREDIT
          ? `Ví của bạn được cộng ${formattedAmount} VND.${reasonText}`
          : `Ví của bạn bị trừ ${formattedAmount} VND.${reasonText}`,
      data: {
        wallet_id: String(result.wallet._id),
        transaction_id: String(result.transaction._id),
        amount: req.body.amount,
        direction: req.body.direction,
        description: normalizedDescription
      }
    })
  } catch (error) {
    logger.error(
      {
        err: error,
        user_id: req.body.userId,
        transaction_id: String(result.transaction._id)
      },
      'Wallet adjustment notification failed'
    )
  }

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.ADMIN_WALLET_ADJUST_SUCCESS,
    data: result
  })
}