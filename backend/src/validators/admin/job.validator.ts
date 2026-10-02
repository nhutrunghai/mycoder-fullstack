import { z } from 'zod'
import { JobModerationStatus, JobStatus } from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'

const adminJobStatusValues = [
  JobStatus.DRAFT,
  JobStatus.OPEN,
  JobStatus.PAUSED,
  JobStatus.CLOSED,
  JobStatus.EXPIRED
] as const

const adminJobModerationStatusValues = [JobModerationStatus.ACTIVE, JobModerationStatus.BLOCKED] as const

export const getAdminJobsValidator = z.object({
  query: z.object({
    companyId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.COMPANY_ID_INVALID
      })
      .optional(),
    company_id: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.COMPANY_ID_INVALID
      })
      .optional(),
    categoryId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: 'ID danh mục không hợp lệ'
      })
      .optional(),
    category_id: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: 'ID danh mục không hợp lệ'
      })
      .optional(),
    status: z
      .enum(adminJobStatusValues, {
        message: UserMessages.JOB_UPDATE_STATUS_INVALID
      })
      .optional(),
    moderation_status: z
      .enum(adminJobModerationStatusValues, {
        message: UserMessages.INVALID_STATUS
      })
      .optional(),
    keyword: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})

export const getAdminJobDetailValidator = z.object({
  params: z.object({
    jobId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.JOB_ID_INVALID
      })
  })
})

export const updateAdminJobModerationStatusValidator = z
  .object({
    params: z.object({
      jobId: z
        .string()
        .trim()
        .regex(/^[a-fA-F0-9]{24}$/, {
          message: UserMessages.JOB_ID_INVALID
        })
    }),
    body: z.object({
      moderation_status: z.enum(adminJobModerationStatusValues, {
        message: UserMessages.INVALID_STATUS
      }),
      blocked_reason: z.string().trim().min(1).max(500).optional()
    })
  })
  .superRefine((data, ctx) => {
    if (data.body.moderation_status === JobModerationStatus.BLOCKED && !data.body.blocked_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: UserMessages.INVALID_DATA,
        path: ['body', 'blocked_reason']
      })
    }
  })
export const getAdminJobApplicationsValidator = z.object({
  params: z.object({
    jobId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.JOB_ID_INVALID
      })
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20)
  })
})
