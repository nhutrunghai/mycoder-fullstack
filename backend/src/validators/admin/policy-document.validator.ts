import { z } from 'zod'

const objectId = z.string().trim().regex(/^[a-fA-F0-9]{24}$/, {
  message: 'ID tài liệu chính sách không hợp lệ'
})

const status = z.enum(['active', 'archived'], {
  message: 'Trạng thái tài liệu không hợp lệ'
})

const sourceUrl = z
  .url({ message: 'Đường dẫn nguồn không hợp lệ' })
  .max(2048, { message: 'Đường dẫn nguồn quá dài' })
  .optional()

const version = z.string().trim().max(100, { message: 'Phiên bản quá dài' }).optional()

export const getAdminPolicyDocumentsValidator = z.object({
  query: z.object({
    keyword: z.string().trim().min(1).max(100).optional(),
    status: status.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
  })
})

export const adminPolicyDocumentIdValidator = z.object({
  params: z.object({ documentId: objectId })
})

export const createAdminPolicyDocumentValidator = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(1).max(500000),
    source_url: sourceUrl,
    version,
    status: status.optional().default('active')
  })
})

export const updateAdminPolicyDocumentValidator = z.object({
  params: z.object({ documentId: objectId }),
  body: z
    .object({
      title: z.string().trim().min(2).max(200).optional(),
      content: z.string().trim().min(1).max(500000).optional(),
      source_url: sourceUrl,
      version,
      status
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Cần có ít nhất một trường để cập nhật'
    })
})
