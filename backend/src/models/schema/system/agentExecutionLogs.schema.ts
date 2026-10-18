import { ObjectId } from 'mongodb'
import { AgentPlanStatus } from '~/services/chat/agent/schemas/agent-plan.schema.js'
import { AgentToolName } from '~/services/chat/agent/agent-tool.js'
import { AgentToolExecutorErrorCode } from '~/services/chat/agent/agent-tool-executor.service.js'

export type AgentExecutionStepLog = {
  step_id: string
  tool: AgentToolName
  status: 'completed' | 'failed'
  duration_ms: number
  error_code?: AgentToolExecutorErrorCode
}

export type AgentExecutionLogInput = {
  _id?: ObjectId
  user_id: ObjectId
  session_id?: ObjectId
  correlation_id?: string
  plan_status: AgentPlanStatus
  plan_intent: string
  plan_confidence: number
  needs_clarification: boolean
  execution_status: 'completed' | 'partial_failure' | 'not_executable' | 'failed'
  total_duration_ms: number
  steps: AgentExecutionStepLog[]
  source_ids: string[]
  created_at?: Date
}

export default class AgentExecutionLog {
  _id?: ObjectId
  user_id: ObjectId
  session_id?: ObjectId
  correlation_id?: string
  plan_status: AgentPlanStatus
  plan_intent: string
  plan_confidence: number
  needs_clarification: boolean
  execution_status: AgentExecutionLogInput['execution_status']
  total_duration_ms: number
  steps: AgentExecutionStepLog[]
  source_ids: string[]
  created_at: Date

  constructor(input: AgentExecutionLogInput) {
    this._id = input._id
    this.user_id = input.user_id
    this.session_id = input.session_id
    this.correlation_id = input.correlation_id
    this.plan_status = input.plan_status
    this.plan_intent = input.plan_intent
    this.plan_confidence = input.plan_confidence
    this.needs_clarification = input.needs_clarification
    this.execution_status = input.execution_status
    this.total_duration_ms = input.total_duration_ms
    this.steps = input.steps
    this.source_ids = input.source_ids
    this.created_at = input.created_at || new Date()
  }
}
