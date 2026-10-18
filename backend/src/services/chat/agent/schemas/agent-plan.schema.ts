import { z } from 'zod'
import { AGENT_TOOL_NAMES } from '~/services/chat/agent/agent-tool'

export type AgentPlanStatus = 'ready' | 'needs_clarification' | 'unsupported'
export const AGENT_ANSWER_MODES = ['tool_grounded', 'model_knowledge', 'clarification'] as const
export type AgentAnswerMode = (typeof AGENT_ANSWER_MODES)[number]
export const AGENT_PLAN_INTENTS = [
  'job_search',
  'job_details',
  'job_comparison',
  'resume',
  'policy',
  'general'
] as const

const plainArgumentsSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => !Array.isArray(value), { message: 'Arguments must be an object.' })

const plannerArgumentProperties = {
  query: { type: ['string', 'null'] },
  location: { type: ['string', 'null'] },
  job_type: { type: ['string', 'null'] },
  level: { type: ['string', 'null'] },
  category_id: { type: ['string', 'null'] },
  limit: { type: ['integer', 'null'], minimum: 1, maximum: 20 },
  job_ids: {
    type: ['array', 'null'],
    items: { type: 'string' },
    minItems: 1,
    maxItems: 10
  },
  job_id: { type: ['string', 'null'] },
  company_id: { type: ['string', 'null'] },
  resume_id: { type: ['string', 'null'] }
} as const

export const agentPlanStepSchema = z.object({
  step_id: z.string().trim().min(1).max(64),
  tool: z.enum(AGENT_TOOL_NAMES),
  arguments: plainArgumentsSchema
}).strict()

export const agentPlanSchema = z
  .object({
    status: z.enum(['ready', 'needs_clarification', 'unsupported']),
    answer_mode: z.enum(AGENT_ANSWER_MODES),
    intent: z.enum(AGENT_PLAN_INTENTS),
    confidence: z.number().min(0).max(1),
    needs_clarification: z.boolean(),
    goal: z.string().trim().min(1).max(240),
    clarification_question: z.string().trim().max(500).nullable(),
    steps: z.array(agentPlanStepSchema).max(4)
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (plan.status === 'ready') {
      if (plan.needs_clarification) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['needs_clarification'],
          message: 'Ready plans must not require clarification.'
        })
      }

      if (plan.answer_mode === 'clarification') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answer_mode'],
          message: 'Ready plans cannot use clarification answer mode.'
        })
      }

      if (plan.answer_mode === 'tool_grounded' && plan.steps.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps'],
          message: 'Tool-grounded ready plans require at least one step.'
        })
      }

      if (plan.answer_mode === 'model_knowledge' && plan.steps.length !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps'],
          message: 'Model-knowledge ready plans cannot include tool steps.'
        })
      }

      if (plan.clarification_question !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clarification_question'],
          message: 'Ready plans cannot include a clarification question.'
        })
      }
    }

    if (plan.status === 'needs_clarification') {
      if (plan.answer_mode !== 'clarification') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answer_mode'],
          message: 'Clarification plans must use clarification answer mode.'
        })
      }

      if (!plan.needs_clarification) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['needs_clarification'],
          message: 'Clarification plans must require clarification.'
        })
      }

      if (plan.steps.length !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps'],
          message: 'Clarification plans cannot include steps.'
        })
      }

      if (!plan.clarification_question) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clarification_question'],
          message: 'Clarification plans require a question.'
        })
      }
    }

    if (plan.status === 'unsupported') {
      if (plan.needs_clarification) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['needs_clarification'],
          message: 'Unsupported plans must not require clarification.'
        })
      }

      if (plan.steps.length !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps'],
          message: 'Unsupported plans cannot include steps.'
        })
      }

      if (plan.clarification_question !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clarification_question'],
          message: 'Unsupported plans cannot include a clarification question.'
        })
      }
    }

    const stepIds = new Set<string>()
    plan.steps.forEach((step, index) => {
      if (stepIds.has(step.step_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'step_id'],
          message: 'Step IDs must be unique.'
        })
      }

      stepIds.add(step.step_id)
    })
  })

export type AgentPlan = z.infer<typeof agentPlanSchema>

export const agentPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['ready', 'needs_clarification', 'unsupported']
    },
    answer_mode: {
      type: 'string',
      enum: AGENT_ANSWER_MODES
    },
    intent: {
      type: 'string',
      enum: AGENT_PLAN_INTENTS
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    needs_clarification: {
      type: 'boolean'
    },
    goal: {
      type: 'string',
      minLength: 1,
      maxLength: 240
    },
    clarification_question: {
      type: ['string', 'null'],
      maxLength: 500
    },
    steps: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          step_id: {
            type: 'string',
            minLength: 1,
            maxLength: 64
          },
          tool: {
            type: 'string',
            enum: AGENT_TOOL_NAMES
          },
          arguments: {
            type: 'object',
            additionalProperties: false,
            properties: plannerArgumentProperties,
            required: Object.keys(plannerArgumentProperties)
          }
        },
        required: ['step_id', 'tool', 'arguments']
      }
    }
  },
  required: [
    'status',
    'answer_mode',
    'intent',
    'confidence',
    'needs_clarification',
    'goal',
    'clarification_question',
    'steps'
  ]
} as const
