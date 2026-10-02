import { z } from 'zod'
import {
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType
} from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'

const adminWalletTransactionTypeValues = [
  WalletTransactionType.TOP_UP,
  WalletTransactionType.PROMOTION_PURCHASE,
  WalletTransactionType.REFUND,
  WalletTransactionType.ADJUSTMENT
] as const

const adminWalletTransactionStatusValues = [
  WalletTransactionStatus.PENDING,
  WalletTransactionStatus.SUCCEEDED,
  WalletTransactionStatus.FAILED,
  WalletTransactionStatus.CANCELLED
] as const

const adminWalletTransactionDirectionValues = [
  WalletTransactionDirection.CREDIT,
  WalletTransactionDirection.DEBIT
] as const

export const getAdminWalletTransactionsValidator = z.object({
  query: z.object({
    keyword: z.string().trim().optional(),
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
      .optional(),
    user_id: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
      .optional(),
    type: z
      .enum(adminWalletTransactionTypeValues, {
        message: UserMessages.INVALID_DATA
      })
      .optional(),
    status: z
      .enum(adminWalletTransactionStatusValues, {
        message: UserMessages.INVALID_STATUS
      })
      .optional(),
    direction: z
      .enum(adminWalletTransactionDirectionValues, {
        message: UserMessages.INVALID_DATA
      })
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})

export const adjustAdminWalletTransactionValidator = z.object({
  body: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      }),
    amount: z.coerce
      .number()
      .int({
        message: UserMessages.WALLET_AMOUNT_INVALID
      })
      .min(1, {
        message: UserMessages.WALLET_AMOUNT_INVALID
      })
      .max(100000000, {
        message: UserMessages.WALLET_AMOUNT_INVALID
      }),
    direction: z.enum(adminWalletTransactionDirectionValues, {
      message: UserMessages.INVALID_DATA
    }),
    description: z.string().trim().min(1).max(500)
  })
})