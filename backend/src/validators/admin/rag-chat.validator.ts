import { z } from 'zod'

export const updateAdminRagChatConfigValidator = z.object({
  body: z
    .object({
      enabled: z.boolean().optional(),
      provider: z.enum(['gemini', 'openai']).optional(),
      intent_model: z.string().trim().min(1).max(100).optional(),
      chat_model: z.string().trim().min(1).max(100).optional(),
      cv_visual_review_model: z.string().trim().min(1).max(100).optional(),
      job_search_top_k: z.coerce.number().int().min(1).max(20).optional(),
      job_explanation_top_k: z.coerce.number().int().min(1).max(20).optional(),
      cv_review_top_k: z.coerce.number().int().min(1).max(20).optional(),
      answer_context_limit: z.coerce.number().int().min(1).max(10).optional(),
      allow_cv_review: z.boolean().optional(),
      allow_job_qa: z.boolean().optional(),
      allow_policy_qa: z.boolean().optional(),
      allow_general_qa: z.boolean().optional(),
      maintenance_message: z.string().trim().min(1).max(500).nullable().optional()
    })
    .refine((value) => Object.keys(value).length > 0)
})

export const rotateAdminRagChatSecretsValidator = z.object({
  body: z
    .object({
      openai_api_key: z.string().trim().min(10).max(500).optional(),
      gemini_api_key: z.string().trim().min(10).max(500).optional()
    })
    .refine((value) => Object.keys(value).length > 0)
})

export const testAdminRagChatConnectionValidator = z.object({
  body: z
    .object({
      provider: z.enum(['gemini', 'openai']).optional()
    })
    .default({})
})
