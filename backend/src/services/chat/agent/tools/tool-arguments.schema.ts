import { z } from 'zod'
import { JobLevel, JobType } from '~/constants/enums'
import { AgentToolName } from '~/services/chat/agent/agent-tool'

const jobTypeValues = Object.values(JobType) as [JobType, ...JobType[]]
const jobLevelValues = Object.values(JobLevel) as [JobLevel, ...JobLevel[]]

const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId.')
const querySchema = z.string().trim().min(1).max(200)
const locationSchema = z.string().trim().min(1).max(100)
const categoryIdSchema = objectIdSchema
const jobTypeSchema = z.enum(jobTypeValues)
const levelSchema = z.enum(jobLevelValues)

const jobFiltersShape = {
  query: querySchema.optional(),
  location: locationSchema.optional(),
  job_type: jobTypeSchema.optional(),
  level: levelSchema.optional(),
  category_id: categoryIdSchema.optional()
}

const requireJobFilter = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.superRefine((value, ctx) => {
    if (!Object.values(value).some((item) => item !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one job filter is required.'
      })
    }
  })

const searchJobsSchema = requireJobFilter(
  z
    .object({
      ...jobFiltersShape,
      limit: z.number().int().min(1).max(20).optional()
    })
    .strict()
)

const countJobsSchema = requireJobFilter(z.object(jobFiltersShape).strict())

const getJobDetailSchema = z
  .object({
    job_id: objectIdSchema
  })
  .strict()

const getJobDetailsSchema = z
  .object({
    job_ids: z
      .array(objectIdSchema)
      .min(1)
      .max(10)
      .refine((jobIds) => new Set(jobIds).size === jobIds.length, 'Job IDs must be unique.')
  })
  .strict()

const compareJobsSchema = z
  .object({
    job_ids: z
      .array(objectIdSchema)
      .min(2)
      .max(4)
      .refine((jobIds) => new Set(jobIds).size === jobIds.length, 'Job IDs must be unique.')
  })
  .strict()

const getCompanyDetailSchema = z
  .object({
    company_id: objectIdSchema
  })
  .strict()

const getSelectedResumeSchema = z
  .object({
    resume_id: objectIdSchema.optional()
  })
  .strict()

const searchResumeChunksSchema = z
  .object({
    query: z.string().trim().min(2).max(200),
    resume_id: objectIdSchema.optional(),
    limit: z.number().int().min(1).max(6).optional()
  })
  .strict()

const matchResumeToJobsSchema = z
  .object({
    resume_id: objectIdSchema.optional(),
    query: querySchema.optional(),
    location: locationSchema.optional(),
    job_type: jobTypeSchema.optional(),
    level: levelSchema.optional(),
    category_id: categoryIdSchema.optional(),
    limit: z.number().int().min(1).max(20).optional()
  })
  .strict()

const searchPolicyDocumentsSchema = z
  .object({
    query: z.string().trim().min(2).max(200),
    limit: z.number().int().min(1).max(10).optional()
  })
  .strict()

export const agentToolArgumentSchemas = {
  search_jobs: searchJobsSchema,
  count_jobs: countJobsSchema,
  compare_jobs: compareJobsSchema,
  get_job_detail: getJobDetailSchema,
  get_job_details: getJobDetailsSchema,
  get_company_detail: getCompanyDetailSchema,
  get_selected_resume: getSelectedResumeSchema,
  search_resume_chunks: searchResumeChunksSchema,
  match_resume_to_jobs: matchResumeToJobsSchema,
  search_policy_documents: searchPolicyDocumentsSchema
} satisfies Record<AgentToolName, z.ZodType>

export type AgentToolArguments = {
  [ToolName in AgentToolName]: z.infer<(typeof agentToolArgumentSchemas)[ToolName]>
}

export function parseAgentToolArguments<ToolName extends AgentToolName>(
  tool: ToolName,
  rawArguments: unknown
): AgentToolArguments[ToolName] {
  return agentToolArgumentSchemas[tool].parse(rawArguments) as AgentToolArguments[ToolName]
}
