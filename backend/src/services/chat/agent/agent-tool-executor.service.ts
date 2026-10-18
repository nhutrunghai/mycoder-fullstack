import { AgentPlan, AgentPlanStatus } from '~/services/chat/agent/schemas/agent-plan.schema'
import { AgentToolName } from '~/services/chat/agent/agent-tool'
import {
  AgentToolGatewayError,
  AgentToolGatewayService,
  ValidatedAgentToolCall,
  default as agentToolGatewayService
} from '~/services/chat/agent/tools/tool-gateway.service'
import { AgentToolArguments } from '~/services/chat/agent/tools/tool-arguments.schema'
import agentJobToolsService, {
  AgentJobToolsService,
  AgentToolExecutionContext
} from '~/services/chat/agent/tools/job-tools.service'
import agentResumeToolsService, { AgentResumeToolsService } from '~/services/chat/agent/tools/resume-tools.service'
import agentPolicyToolsService, { AgentPolicyToolsService } from '~/services/chat/agent/tools/policy-tools.service'

const MAX_PLAN_STEPS = 4
const DEFAULT_TOOL_TIMEOUT_MS = 10_000
const DEFAULT_TOTAL_TIMEOUT_MS = 30_000

export type AgentToolExecutorErrorCode =
  | 'PLAN_NOT_EXECUTABLE'
  | 'INVALID_PLAN'
  | 'INVALID_GATEWAY_PLAN'
  | 'TOOL_TIMEOUT'
  | 'TOTAL_TIMEOUT'
  | 'TOOL_EXECUTION_FAILED'

export type AgentToolExecutionStepResult = {
  step_id: string
  tool: AgentToolName
  status: 'completed' | 'failed'
  data?: unknown
  sources?: unknown[]
  error_code?: AgentToolExecutorErrorCode
}

export type AgentToolExecutorResult = {
  status: 'completed' | 'partial_failure' | 'not_executable' | 'failed'
  plan_status: AgentPlanStatus
  steps: AgentToolExecutionStepResult[]
  error_code?: AgentToolExecutorErrorCode
}

type ControlledToolResult = {
  data: unknown
  sources: unknown[]
}

type AgentToolExecutorDependencies = {
  gateway?: Pick<AgentToolGatewayService, 'validatePlan'>
  jobTools?: Pick<
    AgentJobToolsService,
    'searchJobs' | 'countJobs' | 'compareJobs' | 'getJobDetail' | 'getJobDetails' | 'getCompanyDetail'
  >
  resumeTools?: Pick<AgentResumeToolsService, 'getSelectedResume' | 'searchResumeChunks' | 'matchResumeToJobs'>
  policyTools?: Pick<AgentPolicyToolsService, 'searchPolicyDocuments'>
  toolTimeoutMs?: number
  totalTimeoutMs?: number
}

class ToolTimeoutError extends Error {}

function clampTimeout(timeout: number | undefined, fallback: number): number {
  if (!Number.isFinite(timeout) || !timeout || timeout <= 0) {
    return fallback
  }

  return Math.floor(timeout)
}

function getGatewayErrorCode(error: unknown): AgentToolExecutorErrorCode {
  if (error instanceof AgentToolGatewayError) {
    return 'INVALID_GATEWAY_PLAN'
  }

  return 'INVALID_GATEWAY_PLAN'
}

export class AgentToolExecutorService {
  private readonly gateway: Pick<AgentToolGatewayService, 'validatePlan'>
  private readonly jobTools: Pick<
    AgentJobToolsService,
    'searchJobs' | 'countJobs' | 'compareJobs' | 'getJobDetail' | 'getJobDetails' | 'getCompanyDetail'
  >
  private readonly resumeTools: Pick<AgentResumeToolsService, 'getSelectedResume' | 'searchResumeChunks' | 'matchResumeToJobs'>
  private readonly policyTools: Pick<AgentPolicyToolsService, 'searchPolicyDocuments'>
  private readonly toolTimeoutMs: number
  private readonly totalTimeoutMs: number

  constructor(dependencies: AgentToolExecutorDependencies = {}) {
    this.gateway = dependencies.gateway ?? agentToolGatewayService
    this.jobTools = dependencies.jobTools ?? agentJobToolsService
    this.resumeTools = dependencies.resumeTools ?? agentResumeToolsService
    this.policyTools = dependencies.policyTools ?? agentPolicyToolsService
    this.toolTimeoutMs = clampTimeout(dependencies.toolTimeoutMs, DEFAULT_TOOL_TIMEOUT_MS)
    this.totalTimeoutMs = clampTimeout(dependencies.totalTimeoutMs, DEFAULT_TOTAL_TIMEOUT_MS)
  }

  async executePlan(plan: AgentPlan, context: AgentToolExecutionContext): Promise<AgentToolExecutorResult> {
    if (plan.status !== 'ready') {
      return {
        status: 'not_executable',
        plan_status: plan.status,
        steps: [],
        error_code: 'PLAN_NOT_EXECUTABLE'
      }
    }

    if (plan.answer_mode === 'model_knowledge') {
      return {
        status: 'completed',
        plan_status: plan.status,
        steps: []
      }
    }

    let calls: ValidatedAgentToolCall[]
    try {
      calls = this.gateway.validatePlan(plan, context)
    } catch (error) {
      return {
        status: 'failed',
        plan_status: plan.status,
        steps: [],
        error_code: getGatewayErrorCode(error)
      }
    }

    if (calls.length === 0 || calls.length > MAX_PLAN_STEPS) {
      return {
        status: 'failed',
        plan_status: plan.status,
        steps: [],
        error_code: 'INVALID_PLAN'
      }
    }

    const deadline = Date.now() + this.totalTimeoutMs
    const steps: AgentToolExecutionStepResult[] = []

    for (let index = 0; index < calls.length; index += 1) {
      const call = calls[index]
      const remainingMs = deadline - Date.now()

      if (remainingMs <= 0) {
        steps.push(...calls.slice(index).map((pendingCall) => this.toFailedStep(pendingCall, 'TOTAL_TIMEOUT')))
        break
      }

      const timeoutMs = Math.min(this.toolTimeoutMs, remainingMs)

      try {
        const result = await this.withTimeout(this.dispatch(call, context), timeoutMs)
        steps.push({
          step_id: call.step_id,
          tool: call.tool,
          status: 'completed',
          data: result.data,
          sources: result.sources
        })
      } catch (error) {
        steps.push(this.toFailedStep(call, error instanceof ToolTimeoutError ? 'TOOL_TIMEOUT' : 'TOOL_EXECUTION_FAILED'))
      }
    }

    const hasFailures = steps.some((step) => step.status === 'failed')
    return {
      status: hasFailures ? 'partial_failure' : 'completed',
      plan_status: plan.status,
      steps
    }
  }

  private async dispatch(call: ValidatedAgentToolCall, context: AgentToolExecutionContext): Promise<ControlledToolResult> {
    const trustedContext: AgentToolExecutionContext = { user_id: context.user_id }

    switch (call.tool) {
      case 'search_jobs':
        return this.jobTools.searchJobs(call.arguments as AgentToolArguments['search_jobs'], trustedContext)
      case 'count_jobs':
        return this.jobTools.countJobs(call.arguments as AgentToolArguments['count_jobs'], trustedContext)
      case 'compare_jobs':
        return this.jobTools.compareJobs(call.arguments as AgentToolArguments['compare_jobs'], trustedContext)
      case 'get_job_detail':
        return this.jobTools.getJobDetail(call.arguments as AgentToolArguments['get_job_detail'], trustedContext)
      case 'get_job_details':
        return this.jobTools.getJobDetails(call.arguments as AgentToolArguments['get_job_details'], trustedContext)
      case 'get_company_detail':
        return this.jobTools.getCompanyDetail(call.arguments as AgentToolArguments['get_company_detail'], trustedContext)
      case 'get_selected_resume':
        return this.resumeTools.getSelectedResume(call.arguments as AgentToolArguments['get_selected_resume'], trustedContext)
      case 'search_resume_chunks':
        return this.resumeTools.searchResumeChunks(call.arguments as AgentToolArguments['search_resume_chunks'], trustedContext)
      case 'match_resume_to_jobs':
        return this.resumeTools.matchResumeToJobs(call.arguments as AgentToolArguments['match_resume_to_jobs'], trustedContext)
      case 'search_policy_documents':
        return this.policyTools.searchPolicyDocuments(
          call.arguments as AgentToolArguments['search_policy_documents'],
          trustedContext
        )
    }
  }

  private toFailedStep(call: ValidatedAgentToolCall, errorCode: AgentToolExecutorErrorCode): AgentToolExecutionStepResult {
    return {
      step_id: call.step_id,
      tool: call.tool,
      status: 'failed',
      error_code: errorCode
    }
  }

  private withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ToolTimeoutError()), timeoutMs)
    })

    return Promise.race([operation, timeout]).finally(() => {
      if (timer) {
        clearTimeout(timer)
      }
    })
  }
}

const agentToolExecutorService = new AgentToolExecutorService()
export default agentToolExecutorService
