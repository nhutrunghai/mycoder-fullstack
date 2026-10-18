import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import AgentExecutionLog, {
  AgentExecutionLogInput,
  AgentExecutionStepLog
} from '~/models/schema/system/agentExecutionLogs.schema.js'
import { AgentPlan } from './schemas/agent-plan.schema.js'
import { AgentToolExecutorResult } from './agent-tool-executor.service.js'

const MAX_STEPS = 4
const MAX_SOURCE_IDS = 100
const MAX_CORRELATION_ID_LENGTH = 128

export type CreateAgentAuditInput = {
  user_id: string
  session_id?: string
  correlation_id?: string
  plan: AgentPlan
  execution: AgentToolExecutorResult
  step_durations_ms?: Record<string, number>
  total_duration_ms: number
}

export class AgentAuditService {
  async create(input: CreateAgentAuditInput) {
    const userId = this.parseObjectId(input.user_id, 'user_id')
    const sessionId = input.session_id ? this.parseObjectId(input.session_id, 'session_id') : undefined
    const durations = input.step_durations_ms || {}
    const steps: AgentExecutionStepLog[] = input.execution.steps.slice(0, MAX_STEPS).map((step) => ({
      step_id: step.step_id.slice(0, 64),
      tool: step.tool,
      status: step.status,
      duration_ms: this.normalizeDuration(durations[step.step_id]),
      ...(step.status === 'failed' && step.error_code ? { error_code: step.error_code } : {})
    }))

    const sourceIds = this.collectSourceIds(input.execution)
    const logInput: AgentExecutionLogInput = {
      user_id: userId,
      session_id: sessionId,
      correlation_id: input.correlation_id?.trim().slice(0, MAX_CORRELATION_ID_LENGTH) || undefined,
      plan_status: input.plan.status,
      plan_intent: input.plan.intent,
      plan_confidence: input.plan.confidence,
      needs_clarification: input.plan.needs_clarification,
      execution_status: input.execution.status,
      total_duration_ms: this.normalizeDuration(input.total_duration_ms),
      steps,
      source_ids: sourceIds
    }

    const log = new AgentExecutionLog(logInput)
    const result = await databaseService.agentExecutionLogs.insertOne(log)
    return { _id: result.insertedId, ...log }
  }

  private collectSourceIds(execution: AgentToolExecutorResult) {
    const ids = new Set<string>()
    for (const step of execution.steps) {
      if (step.status !== 'completed' || !Array.isArray(step.sources)) continue
      for (const source of step.sources) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) continue
        const candidate = source as Record<string, unknown>
        if (typeof candidate.type !== 'string' || typeof candidate.id !== 'string') continue
        const type = candidate.type.trim().slice(0, 32)
        const id = candidate.id.trim().slice(0, 128)
        if (type && id) ids.add(`${type}:${id}`)
        if (ids.size >= MAX_SOURCE_IDS) return [...ids]
      }
    }
    return [...ids]
  }

  private parseObjectId(value: string, field: string) {
    if (!ObjectId.isValid(value)) throw new Error(`Invalid agent audit ${field}.`)
    return new ObjectId(value)
  }

  private normalizeDuration(value: number | undefined) {
    return Number.isFinite(value) && value && value > 0 ? Math.min(Math.floor(value), 86_400_000) : 0
  }
}

const agentAuditService = new AgentAuditService()
export default agentAuditService
