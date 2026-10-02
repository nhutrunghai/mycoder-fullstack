import { z } from 'zod'
import { JobApplicationStatus, JobStatus } from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'

const verifiedQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true')
const adminJobStatusValues = [
  JobStatus.DRAFT,
  JobStatus.OPEN,
  JobStatus.PAUSED,
  JobStatus.CLOSED,
  JobStatus.EXPIRED
] as const
const adminApplicationStatusValues = [
  JobApplicationStatus.SUBMITTED,
  JobApplicationStatus.REVIEWING,
  JobApplicationStatus.SHORTLISTED,
  JobApplicationStatus.INTERVIEWING,
  JobApplicationStatus.REJECTED,
  JobApplicationStatus.HIRED,
  JobApplicationStatus.WITHDRAWN
] as const

export const getAdminCompaniesValidator = z.object({
  query: z.object({
    verified: verifiedQuerySchema.optional(),
    keyword: z.string().trim().min(1).max(100).optional(),
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
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})

export const getAdminCompanyDetailValidator = z.object({
  params: z.object({
    companyId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.COMPANY_ID_INVALID
      })
  })
})

export const getAdminCompanyJobsValidator = z.object({
  params: z.object({
    companyId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.COMPANY_ID_INVALID
      })
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    status: z
      .enum(adminJobStatusValues, {
        message: UserMessages.JOB_UPDATE_STATUS_INVALID
      })
      .optional(),
    keyword: z.string().trim().min(1).max(100).optional()
  })
})

export const getAdminCompanyApplicationsValidator = z.object({
  params: z.object({
    companyId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.COMPANY_ID_INVALID
      })
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    status: z
      .enum(adminApplicationStatusValues, {
        message: UserMessages.APPLICATION_STATUS_TRANSITION_INVALID
      })
      .optional(),
    jobId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.JOB_ID_INVALID
      })
      .optional(),
    candidateId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.INVALID_DATA
      })
      .optional()
  })
})

export const updateAdminCompanyStatusValidator = z.object({
  params: z.object({
    companyId: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{24}$/, {
        message: UserMessages.COMPANY_ID_INVALID
      })
  }),
  body: z.object({
    verified: z.boolean({
      message: UserMessages.COMPANY_VERIFIED_STATUS_INVALID
    })
  })
})
