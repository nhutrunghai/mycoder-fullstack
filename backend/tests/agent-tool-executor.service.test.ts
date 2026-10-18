import { AgentPlan } from '../src/services/chat/agent/schemas/agent-plan.schema.js'

jest.mock('../src/services/chat/agent/tools/tool-gateway.service.js', () => ({
  __esModule: true,
  AgentToolGatewayService: class AgentToolGatewayService {},
  AgentToolGatewayError: class AgentToolGatewayError extends Error {
    code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
  default: {
    validatePlan: jest.fn()
  }
}))

jest.mock('../src/services/chat/agent/tools/job-tools.service.js', () => ({
  __esModule: true,
  AgentJobToolsService: class AgentJobToolsService {},
  default: {}
}))

jest.mock('../src/services/chat/agent/tools/resume-tools.service.js', () => ({
  __esModule: true,
  AgentResumeToolsService: class AgentResumeToolsService {},
  default: {}
}))

jest.mock('../src/services/chat/agent/tools/policy-tools.service.js', () => ({
  __esModule: true,
  AgentPolicyToolsService: class AgentPolicyToolsService {},
  default: {}
}))

import { AgentToolGatewayError } from '../src/services/chat/agent/tools/tool-gateway.service.js'
import { AgentToolExecutorService } from '../src/services/chat/agent/agent-tool-executor.service.js'

const userId = '507f1f77bcf86cd799439011'
const jobId = '507f1f77bcf86cd799439012'
const companyId = '507f1f77bcf86cd799439013'

const toolArguments = {
  search_jobs: { query: 'Frontend' },
  count_jobs: { query: 'Frontend' },
  compare_jobs: { job_ids: [jobId, companyId] },
  get_job_detail: { job_id: jobId },
  get_company_detail: { company_id: companyId },
  get_selected_resume: {},
  search_resume_chunks: { query: 'React' },
  match_resume_to_jobs: {},
  search_policy_documents: { query: 'bao hiem' }
} as const

const readyPlan = (tools: Array<keyof typeof toolArguments>): AgentPlan =>
  ({
    status: 'ready',
    intent: 'general',
    confidence: 0.9,
    needs_clarification: false,
    goal: 'Read approved data',
    clarification_question: null,
    steps: tools.map((tool, index) => ({
      step_id: `step-${index + 1}`,
      tool,
      arguments: toolArguments[tool]
    }))
  }) as AgentPlan

const completedResult = (tool: string) => ({
  tool,
  data: { value: tool },
  sources: [{ type: 'test', id: tool }]
})

function createDependencies() {
  const gateway = {
    validatePlan: jest.fn((plan: AgentPlan, context: { user_id: string }) =>
      plan.steps.map((step) => ({
        ...step,
        user_id: context.user_id
      }))
    )
  }
  const jobTools = {
    searchJobs: jest.fn().mockResolvedValue(completedResult('search_jobs')),
    countJobs: jest.fn().mockResolvedValue(completedResult('count_jobs')),
    compareJobs: jest.fn().mockResolvedValue(completedResult('compare_jobs')),
    getJobDetail: jest.fn().mockResolvedValue(completedResult('get_job_detail')),
    getCompanyDetail: jest.fn().mockResolvedValue(completedResult('get_company_detail'))
  }
  const resumeTools = {
    getSelectedResume: jest.fn().mockResolvedValue(completedResult('get_selected_resume')),
    searchResumeChunks: jest.fn().mockResolvedValue(completedResult('search_resume_chunks')),
    matchResumeToJobs: jest.fn().mockResolvedValue(completedResult('match_resume_to_jobs'))
  }
  const policyTools = {
    searchPolicyDocuments: jest.fn().mockResolvedValue(completedResult('search_policy_documents'))
  }

  return { gateway, jobTools, resumeTools, policyTools }
}

describe('agent tool executor service', () => {
  it('validates first, preserves declared order, and dispatches controlled job tools with the trusted context', async () => {
    const dependencies = createDependencies()
    const invocationOrder: string[] = []
    dependencies.jobTools.searchJobs.mockImplementation(async (_args, context) => {
      invocationOrder.push(`search:${context.user_id}`)
      return completedResult('search_jobs')
    })
    dependencies.jobTools.getJobDetail.mockImplementation(async (_args, context) => {
      invocationOrder.push(`detail:${context.user_id}`)
      return completedResult('get_job_detail')
    })
    const service = new AgentToolExecutorService(dependencies)

    const result = await service.executePlan(readyPlan(['search_jobs', 'get_job_detail']), { user_id: userId })

    expect(invocationOrder).toEqual([`search:${userId}`, `detail:${userId}`])
    expect(dependencies.gateway.validatePlan.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.jobTools.searchJobs.mock.invocationCallOrder[0]
    )
    expect(result).toEqual({
      status: 'completed',
      plan_status: 'ready',
      steps: [
        {
          step_id: 'step-1',
          tool: 'search_jobs',
          status: 'completed',
          data: { value: 'search_jobs' },
          sources: [{ type: 'test', id: 'search_jobs' }]
        },
        {
          step_id: 'step-2',
          tool: 'get_job_detail',
          status: 'completed',
          data: { value: 'get_job_detail' },
          sources: [{ type: 'test', id: 'get_job_detail' }]
        }
      ]
    })
    expect(dependencies.jobTools.searchJobs).toHaveBeenCalledWith({ query: 'Frontend' }, { user_id: userId })
  })

  it.each([
    'search_jobs',
    'count_jobs',
    'compare_jobs',
    'get_job_detail',
    'get_company_detail',
    'get_selected_resume',
    'search_resume_chunks',
    'match_resume_to_jobs',
    'search_policy_documents'
  ] as const)('dispatches the controlled service for %s', async (tool) => {
    const dependencies = createDependencies()
    const service = new AgentToolExecutorService(dependencies)

    await service.executePlan(readyPlan([tool]), { user_id: userId })

    const target =
      tool === 'search_jobs'
        ? dependencies.jobTools.searchJobs
        : tool === 'count_jobs'
          ? dependencies.jobTools.countJobs
          : tool === 'compare_jobs'
            ? dependencies.jobTools.compareJobs
            : tool === 'get_job_detail'
              ? dependencies.jobTools.getJobDetail
              : tool === 'get_company_detail'
                ? dependencies.jobTools.getCompanyDetail
                : tool === 'get_selected_resume'
                  ? dependencies.resumeTools.getSelectedResume
                  : tool === 'search_resume_chunks'
                    ? dependencies.resumeTools.searchResumeChunks
                    : tool === 'match_resume_to_jobs'
                      ? dependencies.resumeTools.matchResumeToJobs
                      : dependencies.policyTools.searchPolicyDocuments

    expect(target).toHaveBeenCalledWith(toolArguments[tool], { user_id: userId })
  })

  it('returns a stable timeout envelope and continues with later steps', async () => {
    const dependencies = createDependencies()
    dependencies.jobTools.searchJobs.mockImplementation(() => new Promise(() => undefined))
    const service = new AgentToolExecutorService({
      ...dependencies,
      toolTimeoutMs: 10,
      totalTimeoutMs: 100
    })

    const result = await service.executePlan(readyPlan(['search_jobs', 'count_jobs']), { user_id: userId })

    expect(result.status).toBe('partial_failure')
    expect(result.steps).toEqual([
      {
        step_id: 'step-1',
        tool: 'search_jobs',
        status: 'failed',
        error_code: 'TOOL_TIMEOUT'
      },
      {
        step_id: 'step-2',
        tool: 'count_jobs',
        status: 'completed',
        data: { value: 'count_jobs' },
        sources: [{ type: 'test', id: 'count_jobs' }]
      }
    ])
  })

  it('marks the pending steps with TOTAL_TIMEOUT when the plan deadline is exhausted', async () => {
    const dependencies = createDependencies()
    dependencies.jobTools.searchJobs.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(completedResult('search_jobs')), 30))
    )
    const service = new AgentToolExecutorService({
      ...dependencies,
      toolTimeoutMs: 100,
      totalTimeoutMs: 10
    })

    const result = await service.executePlan(readyPlan(['search_jobs', 'count_jobs']), { user_id: userId })

    expect(result).toEqual({
      status: 'partial_failure',
      plan_status: 'ready',
      steps: [
        {
          step_id: 'step-1',
          tool: 'search_jobs',
          status: 'failed',
          error_code: 'TOOL_TIMEOUT'
        },
        {
          step_id: 'step-2',
          tool: 'count_jobs',
          status: 'failed',
          error_code: 'TOTAL_TIMEOUT'
        }
      ]
    })
    expect(dependencies.jobTools.countJobs).not.toHaveBeenCalled()
  })

  it('returns a stable failure envelope without internal error details', async () => {
    const dependencies = createDependencies()
    dependencies.jobTools.searchJobs.mockRejectedValue(new Error('database password leaked\nat internal.ts:12'))
    const service = new AgentToolExecutorService(dependencies)

    const result = await service.executePlan(readyPlan(['search_jobs']), { user_id: userId })

    expect(result).toEqual({
      status: 'partial_failure',
      plan_status: 'ready',
      steps: [
        {
          step_id: 'step-1',
          tool: 'search_jobs',
          status: 'failed',
          error_code: 'TOOL_EXECUTION_FAILED'
        }
      ]
    })
    expect(JSON.stringify(result)).not.toContain('database password')
    expect(JSON.stringify(result)).not.toContain('internal.ts')
  })

  it.each(['needs_clarification', 'unsupported'] as const)(
    'does not validate or execute a %s plan',
    async (status) => {
      const dependencies = createDependencies()
      const service = new AgentToolExecutorService(dependencies)
      const plan = {
        ...readyPlan([]),
        status,
        needs_clarification: status === 'needs_clarification',
        clarification_question: status === 'needs_clarification' ? 'What location?' : null
      } as AgentPlan

      await expect(service.executePlan(plan, { user_id: userId })).resolves.toEqual({
        status: 'not_executable',
        plan_status: status,
        steps: [],
        error_code: 'PLAN_NOT_EXECUTABLE'
      })
      expect(dependencies.gateway.validatePlan).not.toHaveBeenCalled()
    }
  )

  it('maps invalid gateway plans and independently rejects plans over the max step count', async () => {
    const dependencies = createDependencies()
    dependencies.gateway.validatePlan.mockImplementationOnce(() => {
      throw new AgentToolGatewayError('INVALID_ARGUMENTS', 'raw internal gateway error')
    })
    const service = new AgentToolExecutorService(dependencies)

    await expect(service.executePlan(readyPlan(['search_jobs']), { user_id: userId })).resolves.toEqual({
      status: 'failed',
      plan_status: 'ready',
      steps: [],
      error_code: 'INVALID_GATEWAY_PLAN'
    })

    const maxDependencies = createDependencies()
    const maxService = new AgentToolExecutorService(maxDependencies)
    const tooManySteps = readyPlan(['search_jobs', 'count_jobs', 'compare_jobs', 'get_job_detail'])
    tooManySteps.steps.push({
      step_id: 'step-5',
      tool: 'get_company_detail',
      arguments: toolArguments.get_company_detail
    })

    await expect(maxService.executePlan(tooManySteps, { user_id: userId })).resolves.toEqual({
      status: 'failed',
      plan_status: 'ready',
      steps: [],
      error_code: 'INVALID_PLAN'
    })
    expect(maxDependencies.gateway.validatePlan).toHaveBeenCalled()
    expect(maxDependencies.jobTools.searchJobs).not.toHaveBeenCalled()
  })
})
