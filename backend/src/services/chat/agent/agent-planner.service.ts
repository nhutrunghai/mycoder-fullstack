import env from '~/configs/env.config.js'
import { RagChatRuntimeConfig } from '~/services/admin/system-setting.service.js'
import llmService from '~/services/chat/ai/llm.service.js'
import {
  AgentPlan,
  agentPlanJsonSchema,
  agentPlanSchema
} from '~/services/chat/agent/schemas/agent-plan.schema.js'
import {
  getAgentToolDefinition,
  getAvailableAgentToolDefinitions
} from '~/services/chat/agent/tools/tool-registry.js'
import { buildAgentPlannerPrompt, AgentPlannerPromptContext } from '~/services/chat/prompts/agent-planner.prompt.js'
import { z } from 'zod'

const plannerContextSchema = z
  .object({
    session_hint: z.string().trim().max(500).optional(),
    selected_resume_id: z.string().trim().max(128).optional(),
    active_search_context: z
      .object({
        context_id: z.string().uuid(),
        label: z.string().trim().min(1).max(80),
        query: z.string().trim().min(1).max(200),
        filters: z.record(z.string(), z.unknown()),
        job_ids: z.array(z.string().regex(/^[a-fA-F0-9]{24}$/)).min(1).max(10)
      })
      .strict()
      .optional()
  })
  .strict()

export type AgentPlannerContext = z.infer<typeof plannerContextSchema>

export class AgentPlannerError extends Error {
  readonly code = 'AGENT_PLANNER_ERROR'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AgentPlannerError'
  }
}

function removeNullArguments(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }

  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== null))
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

function isClearModelKnowledgeRequest(message: string, context: AgentPlannerContext) {
  const normalizedMessage = normalizeText(message)
  const normalizedHistory = normalizeText(context.session_hint || '')
  const isExplicitKnowledgeQuestion =
    /\b(la gi|khai niem|ky nang|lo trinh|co hoi nghe nghiep|tim hieu|muc luong|luong trung binh)\b/.test(
      normalizedMessage
    )
  const isSalaryFollowUp =
    /^(trung binh|bao nhieu|muc luong|luong|.*trung binh.*|.*bao nhieu.*)$/.test(normalizedMessage) &&
    /\b(sale|ban hang|luong|thu nhap)\b/.test(normalizedHistory)

  return isExplicitKnowledgeQuestion || isSalaryFollowUp
}

function readyToolPlan(
  intent: AgentPlan['intent'],
  goal: string,
  tool: AgentPlan['steps'][number]['tool'],
  argumentsValue: Record<string, unknown>
): AgentPlan {
  return {
    status: 'ready',
    answer_mode: 'tool_grounded',
    intent,
    confidence: 1,
    needs_clarification: false,
    goal: goal.slice(0, 240),
    clarification_question: null,
    steps: [{ step_id: `deterministic-${tool}`, tool, arguments: argumentsValue }]
  }
}

function clarificationPlan(goal: string, question: string): AgentPlan {
  return {
    status: 'needs_clarification',
    answer_mode: 'clarification',
    intent: 'job_search',
    confidence: 1,
    needs_clarification: true,
    goal: goal.slice(0, 240),
    clarification_question: question.slice(0, 500),
    steps: []
  }
}

function modelKnowledgePlan(goal: string): AgentPlan {
  return {
    status: 'ready',
    answer_mode: 'model_knowledge',
    intent: 'general',
    confidence: 1,
    needs_clarification: false,
    goal: goal.slice(0, 240),
    clarification_question: null,
    steps: []
  }
}

function buildDeterministicPlan(message: string, context: AgentPlannerContext): AgentPlan | null {
  const normalized = normalizeText(message)
  const activeJobIds = context.active_search_context?.job_ids || []
  const hasResume = Boolean(context.selected_resume_id)
  const mentionsResume = /\b(cv|resume|ho so|diem manh|diem yeu|kinh nghiem trong cv)\b/.test(normalized)
  const asksForMatchingJobs = /(tim|goi y|de xuat).*(job|viec lam).*(phu hop).*(cv|resume|ho so)/.test(normalized)

  if (/(xoa|xoa bo|xoa het|xoa toan bo).*(du lieu|tai khoan|ho so)/.test(normalized)) {
    return modelKnowledgePlan('Giải thích giới hạn thao tác xóa dữ liệu tài khoản')
  }

  if (mentionsResume && hasResume) {
    if (asksForMatchingJobs || /(tim viec|goi y job|job phu hop)/.test(normalized)) {
      return readyToolPlan('resume', 'Tìm việc phù hợp dựa trên CV đã chọn', 'match_resume_to_jobs', {
        resume_id: context.selected_resume_id
      })
    }

    if (/(danh gia|phan tich|diem manh|diem yeu|review)/.test(normalized)) {
      return readyToolPlan('resume', 'Phân tích CV đã chọn', 'search_resume_chunks', {
        query: message.slice(0, 200),
        resume_id: context.selected_resume_id,
        limit: 6
      })
    }
  }

  if (
    /(tim viec phu hop cho toi|tim job phu hop cho toi|tim viec phu hop voi toi)/.test(normalized) &&
    !hasResume &&
    activeJobIds.length === 0
  ) {
    return clarificationPlan(
      'Xác định tiêu chí tìm việc phù hợp',
      'Bạn muốn tìm vị trí nào, ở khu vực nào và theo cấp độ kinh nghiệm nào? Ví dụ: Frontend tại Hà Nội cho người mới.'
    )
  }

  const refersToActiveJobs =
    activeJobIds.length > 0 &&
    /(vua neu|vua tim|trong so do|cac job nay|cac cong viec nay|hai job do|2 job dau|job dau tien|danh sach moi|danh sach nay)/.test(
      normalized
    )

  if (refersToActiveJobs) {
    const firstJobId = activeJobIds[0]
    const firstTwoJobIds = activeJobIds.slice(0, 2)
    const explicitlyReferencesTwoJobs = /(trong hai job do|trong 2 job do|hai job do|2 job do)/.test(normalized)

    if (
      (explicitlyReferencesTwoJobs || /(so sanh|khac nhau|uu diem|nhan xet).*(hai|2|job dau)/.test(normalized)) &&
      firstTwoJobIds.length >= 2
    ) {
      return readyToolPlan('job_comparison', 'So sánh hai job đầu tiên trong danh sách hiện tại', 'compare_jobs', {
        job_ids: firstTwoJobIds
      })
    }

    if (/(trong hai job do|trong 2 job do|hai job do|2 job do)/.test(normalized) && firstTwoJobIds.length >= 2) {
      return readyToolPlan('job_comparison', 'Đánh giá hai job đang được tham chiếu', 'compare_jobs', {
        job_ids: firstTwoJobIds
      })
    }

    if (/(cong ty).*(job|cong viec).*(dau tien|nay|do)/.test(normalized) && firstJobId) {
      return readyToolPlan('job_details', 'Xem công ty của job đầu tiên trong danh sách hiện tại', 'get_job_detail', {
        job_id: firstJobId
      })
    }

    if (/(job dau tien|cong viec dau tien)/.test(normalized) && firstJobId) {
      return readyToolPlan('job_details', 'Xem chi tiết job đầu tiên trong danh sách hiện tại', 'get_job_detail', {
        job_id: firstJobId
      })
    }

    if (/(phu hop|nguoi moi|fresher|junior|intern|giai thich|chi tiet|mo ta|yeu cau|cac job)/.test(normalized)) {
      return readyToolPlan('job_details', 'Đọc dữ liệu chi tiết các job trong danh sách hiện tại', 'get_job_details', {
        job_ids: activeJobIds.slice(0, 10)
      })
    }
  }

  if (/(khong lien quan den it|ngoai it|khong phai it)/.test(normalized)) {
    return clarificationPlan(
      'Tìm việc ngoài lĩnh vực công nghệ thông tin',
      'Hiện hệ thống chủ yếu có việc công nghệ thông tin. Bạn muốn tìm lĩnh vực Sale, Marketing, Nhân sự, Kế toán hay Chăm sóc khách hàng?'
    )
  }

  return null
}

export class AgentPlannerService {
  async createPlan(
    message: string,
    context: AgentPlannerContext = {},
    config?: RagChatRuntimeConfig
  ): Promise<AgentPlan> {
    const normalizedMessage = message.trim()
    if (!normalizedMessage) {
      throw new AgentPlannerError('Agent planner message must not be empty.')
    }

    let safeContext: AgentPlannerPromptContext
    try {
      safeContext = plannerContextSchema.parse(context)
    } catch (error) {
      throw new AgentPlannerError('Agent planner context is invalid.', { cause: error })
    }

    const provider = config?.provider || env.LLM_PROVIDER
    const model = config?.intent_model || env.LLM_MODEL_INTENT
    const availableTools = getAvailableAgentToolDefinitions(config)

    const deterministicPlan = buildDeterministicPlan(normalizedMessage, safeContext)
    if (deterministicPlan) {
      this.validateCrossFieldInvariants(deterministicPlan, new Set(availableTools.map((tool) => tool.name)))
      return deterministicPlan
    }

    let raw: unknown
    try {
      raw = await llmService.generateJson<unknown>({
        provider,
        model,
        prompt: buildAgentPlannerPrompt(normalizedMessage, safeContext, availableTools),
        schema: agentPlanJsonSchema
      })
    } catch (error) {
      throw new AgentPlannerError('Agent planner provider request failed.', { cause: error })
    }

    try {
      const parsedPlan = agentPlanSchema.parse(raw)
      const plan: AgentPlan = {
        ...parsedPlan,
        steps: parsedPlan.steps.map((step) => ({
          ...step,
          arguments: removeNullArguments(step.arguments) as Record<string, unknown>
        }))
      }
      const normalizedPlan = isClearModelKnowledgeRequest(normalizedMessage, safeContext)
        ? {
            status: 'ready' as const,
            answer_mode: 'model_knowledge' as const,
            intent: 'general' as const,
            confidence: Math.max(plan.confidence, 0.8),
            needs_clarification: false,
            goal: plan.goal,
            clarification_question: null,
            steps: []
          }
        : plan

      this.validateCrossFieldInvariants(normalizedPlan, new Set(availableTools.map((tool) => tool.name)))
      return normalizedPlan
    } catch (error) {
      throw new AgentPlannerError('Agent planner returned an invalid plan.', { cause: error })
    }
  }

  private validateCrossFieldInvariants(plan: AgentPlan, availableTools: ReadonlySet<string>) {
    if (plan.status !== 'ready') {
      return
    }

    const callsByTool = new Map<string, number>()
    for (const step of plan.steps) {
      if (!availableTools.has(step.tool)) {
        throw new Error(`Tool ${step.tool} is disabled by runtime configuration.`)
      }

      const definition = getAgentToolDefinition(step.tool)
      const calls = (callsByTool.get(step.tool) || 0) + 1
      callsByTool.set(step.tool, calls)

      if (calls > definition.max_calls_per_plan) {
        throw new Error(`Tool ${step.tool} exceeds its planner call limit.`)
      }
    }
  }
}

const agentPlannerService = new AgentPlannerService()
export default agentPlannerService
