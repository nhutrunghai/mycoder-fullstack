import { z } from 'zod'
import UserMessages from '~/constants/messages/index.js'

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, {
    message: UserMessages.INVALID_DATA
  })

export const getAdminAuditLogsValidator = z.object({
  query: z.object({
    keyword: z.string().trim().max(100).optional(),
    adminId: objectIdSchema.optional(),
    admin_id: objectIdSchema.optional(),
    action: z.string().trim().min(1).max(100).optional(),
    targetType: z.string().trim().min(1).max(100).optional(),
    target_type: z.string().trim().min(1).max(100).optional(),
    targetId: z.string().trim().min(1).max(100).optional(),
    target_id: z.string().trim().min(1).max(100).optional(),
    success: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    fromDate: z.iso.datetime().optional(),
    toDate: z.iso.datetime().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})
