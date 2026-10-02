import { z } from 'zod'
import { UserRole, UserStatus, WalletTopUpOrderStatus } from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'

const adminUserRoleValues = [UserRole.CANDIDATE, UserRole.EMPLOYER, UserRole.ADMIN] as const
const adminUserStatusValues = [UserStatus.ACTIVE, UserStatus.BANNED, UserStatus.DELETED] as const
const adminEditableUserStatusValues = [UserStatus.ACTIVE, UserStatus.BANNED] as const
const adminWalletTopUpOrderStatusValues = [
  WalletTopUpOrderStatus.PENDING,
  WalletTopUpOrderStatus.PAID,
  WalletTopUpOrderStatus.FAILED,
  WalletTopUpOrderStatus.CANCELLED,
  WalletTopUpOrderStatus.EXPIRED
] as const

const isValidAdminUserRole = (value: number) =>
  adminUserRoleValues.includes(value as (typeof adminUserRoleValues)[number])

const isValidAdminUserStatus = (value: number) =>
  adminUserStatusValues.includes(value as (typeof adminUserStatusValues)[number])

const isValidEditableAdminUserStatus = (value: number) =>
  adminEditableUserStatusValues.includes(value as (typeof adminEditableUserStatusValues)[number])

export const getAdminUsersValidator = z.object({
  query: z.object({
    role: z.coerce.number().refine(isValidAdminUserRole, {
      message: UserMessages.INVALID_ROLE
    }).optional(),
    status: z.coerce.number().refine(isValidAdminUserStatus, {
      message: UserMessages.INVALID_STATUS
    }).optional(),
    keyword: z.string().trim().min(1).max(100).optional(),
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
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})

export const getAdminUserDetailValidator = z.object({
  params: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
  })
})

export const getAdminUserWalletValidator = z.object({
  params: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
  })
})

export const getAdminUserTopUpOrdersValidator = z.object({
  params: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
  }),
  query: z.object({
    status: z
      .enum(adminWalletTopUpOrderStatusValues, {
        message: UserMessages.INVALID_STATUS
      })
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})

export const updateAdminUserStatusValidator = z.object({
  params: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
  }),
  body: z.object({
    status: z.coerce.number().refine(isValidEditableAdminUserStatus, {
      message: UserMessages.INVALID_STATUS
    })
  })
})

export const updateAdminUserRoleValidator = z.object({
  params: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
  }),
  body: z.object({
    role: z.coerce.number().refine(isValidAdminUserRole, {
      message: UserMessages.INVALID_ROLE
    })
  })
})

export const getAdminUserApplicationsValidator = z.object({
  params: z.object({
    userId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
})
