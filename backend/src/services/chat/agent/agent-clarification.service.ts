import {
  AgentPlan,
  agentPlanSchema
} from '~/services/chat/agent/schemas/agent-plan.schema.js'

const MAX_CLARIFICATION_LENGTH = 500

export type AgentClarificationResult =
  | {
      status: 'clarification'
      question: string
    }
  | {
      status: 'unsupported'
      message: string
    }
  | {
      status: 'ready'
    }
  | {
      status: 'invalid_plan'
      message: string
    }

const INVALID_PLAN_MESSAGE = 'Kế hoạch xử lý không hợp lệ.'
const UNSUPPORTED_MESSAGE = 'Yêu cầu này hiện chưa được hỗ trợ.'

export class AgentClarificationService {
  resolve(plan: AgentPlan | unknown): AgentClarificationResult {
    const parsed = agentPlanSchema.safeParse(plan)
    if (!parsed.success) {
      return {
        status: 'invalid_plan',
        message: INVALID_PLAN_MESSAGE
      }
    }

    const validPlan = parsed.data

    if (validPlan.status === 'ready') {
      return { status: 'ready' }
    }

    if (validPlan.status === 'unsupported') {
      return {
        status: 'unsupported',
        message: UNSUPPORTED_MESSAGE
      }
    }

    const question = this.normalizeQuestion(validPlan.clarification_question)
    if (!question) {
      return {
        status: 'invalid_plan',
        message: INVALID_PLAN_MESSAGE
      }
    }

    return {
      status: 'clarification',
      question
    }
  }

  private normalizeQuestion(question: string | null) {
    if (!question) {
      return null
    }

    const normalized = question
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CLARIFICATION_LENGTH)
      .trim()

    return normalized || null
  }
}

const agentClarificationService = new AgentClarificationService()
export default agentClarificationService
