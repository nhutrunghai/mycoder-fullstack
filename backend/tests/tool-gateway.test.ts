import { AgentPlan } from '../src/services/chat/agent/schemas/agent-plan.schema.js'
import {
  AgentToolGatewayError,
  AgentToolGatewayService
} from '../src/services/chat/agent/tools/tool-gateway.service.js'
import { AGENT_TOOL_NAMES } from '../src/services/chat/agent/agent-tool.js'

const userId = '507f1f77bcf86cd799439011'
const jobId = '507f1f77bcf86cd799439012'
const companyId = '507f1f77bcf86cd799439013'
const resumeId = '507f1f77bcf86cd799439014'

const readyPlan = (steps: AgentPlan['steps']): AgentPlan => ({
  status: 'ready',
  answer_mode: 'tool_grounded',
  intent: 'general',
  confidence: 0.9,
  needs_clarification: false,
  goal: 'Thực hiện truy vấn dữ liệu đọc',
  clarification_question: null,
  steps
})

describe('agent tool gateway', () => {
  const gateway = new AgentToolGatewayService()

  it('accepts a valid search_jobs plan and returns parsed arguments with trusted user_id', () => {
    const calls = gateway.validatePlan(
      readyPlan([
        {
          step_id: 'search',
          tool: 'search_jobs',
          arguments: { query: '  Frontend  ', limit: 10 }
        }
      ]),
      { user_id: userId }
    )

    expect(calls).toEqual([
      {
        step_id: 'search',
        tool: 'search_jobs',
        arguments: { query: 'Frontend', limit: 10 },
        user_id: userId
      }
    ])
  })

  it('rejects an invalid user id with INVALID_CONTEXT', () => {
    expect(() =>
      gateway.validatePlan(
        readyPlan([{ step_id: 'search', tool: 'search_jobs', arguments: { query: 'Frontend' } }]),
        { user_id: 'invalid-user' }
      )
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONTEXT' }))
  })

  it.each(['needs_clarification', 'unsupported'] as const)(
    'rejects %s plans with PLAN_NOT_EXECUTABLE',
    (status) => {
      expect(() =>
        gateway.validatePlan(
          {
            status,
            answer_mode: 'clarification',
            intent: 'general',
            confidence: 0.9,
            needs_clarification: status === 'needs_clarification',
            goal: 'Không thực thi',
            clarification_question: status === 'needs_clarification' ? 'Bạn cần gì?' : null,
            steps: []
          } as AgentPlan,
          { user_id: userId }
        )
      ).toThrow(expect.objectContaining({ code: 'PLAN_NOT_EXECUTABLE' }))
    }
  )

  it('rejects unknown $where and collection arguments with INVALID_ARGUMENTS', () => {
    for (const argumentsValue of [
      { query: 'Frontend', $where: 'this.secret === true' },
      { query: 'Frontend', collection: 'users' }
    ]) {
      expect(() =>
        gateway.validatePlan(
          readyPlan([{ step_id: 'search', tool: 'search_jobs', arguments: argumentsValue }]),
          { user_id: userId }
        )
      ).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENTS' }))
    }
  })

  it('rejects invalid limits, ObjectIds, and empty search filters', () => {
    const invalidPlans: AgentPlan[] = [
      readyPlan([{ step_id: 'search', tool: 'search_jobs', arguments: { query: 'Frontend', limit: 21 } }]),
      readyPlan([{ step_id: 'job', tool: 'get_job_detail', arguments: { job_id: 'not-an-id' } }]),
      readyPlan([{ step_id: 'search', tool: 'search_jobs', arguments: {} }])
    ]

    for (const plan of invalidPlans) {
      expect(() => gateway.validatePlan(plan, { user_id: userId })).toThrow(
        expect.objectContaining({ code: 'INVALID_ARGUMENTS' })
      )
    }
  })

  it('rejects duplicate calls to the same tool with TOOL_CALL_LIMIT_EXCEEDED', () => {
    expect(() =>
      gateway.validatePlan(
        readyPlan([
          { step_id: 'first', tool: 'search_jobs', arguments: { query: 'Frontend' } },
          { step_id: 'second', tool: 'search_jobs', arguments: { query: 'Backend' } }
        ]),
        { user_id: userId }
      )
    ).toThrow(expect.objectContaining({ code: 'TOOL_CALL_LIMIT_EXCEEDED' }))
  })

  it('accepts optional resume_id but rejects candidate_id and user_id resume arguments', () => {
    expect(
      gateway.validatePlan(
        readyPlan([{ step_id: 'resume', tool: 'get_selected_resume', arguments: { resume_id: resumeId } }]),
        { user_id: userId }
      )[0].arguments
    ).toEqual({ resume_id: resumeId })

    for (const argumentsValue of [{ candidate_id: userId }, { user_id: userId }]) {
      expect(() =>
        gateway.validatePlan(
          readyPlan([{ step_id: 'resume', tool: 'get_selected_resume', arguments: argumentsValue }]),
          { user_id: userId }
        )
      ).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENTS' }))
    }
  })

  it('rejects whitespace-only optional job filters', () => {
    const whitespaceFilterPlans: AgentPlan[] = [
      readyPlan([{ step_id: 'query', tool: 'search_jobs', arguments: { query: '   ' } }]),
      readyPlan([{ step_id: 'location', tool: 'search_jobs', arguments: { location: '   ' } }]),
      readyPlan([
        {
          step_id: 'search-combined',
          tool: 'search_jobs',
          arguments: { query: '   ', location: '   ' }
        }
      ]),
      readyPlan([{ step_id: 'count-query', tool: 'count_jobs', arguments: { query: '   ' } }]),
      readyPlan([{ step_id: 'count-location', tool: 'count_jobs', arguments: { location: '   ' } }]),
      readyPlan([
        {
          step_id: 'combined',
          tool: 'count_jobs',
          arguments: { query: '   ', location: '   ' }
        }
      ]),
      readyPlan([{ step_id: 'match-query', tool: 'match_resume_to_jobs', arguments: { query: '   ' } }]),
      readyPlan([{ step_id: 'match-location', tool: 'match_resume_to_jobs', arguments: { location: '   ' } }])
    ]

    for (const plan of whitespaceFilterPlans) {
      expect(() => gateway.validatePlan(plan, { user_id: userId })).toThrow(
        expect.objectContaining({ code: 'INVALID_ARGUMENTS' })
      )
    }
  })

  it('accepts every registered read-only tool with valid minimal arguments', () => {
    const minimalArguments = {
      search_jobs: { query: 'Frontend' },
      count_jobs: { query: 'Frontend' },
      compare_jobs: { job_ids: [jobId, companyId] },
      get_job_detail: { job_id: jobId },
      get_job_details: { job_ids: [jobId] },
      get_company_detail: { company_id: companyId },
      get_selected_resume: {},
      search_resume_chunks: { query: 'JavaScript' },
      match_resume_to_jobs: {},
      search_policy_documents: { query: 'bảo hiểm' }
    } as const

    for (const tool of AGENT_TOOL_NAMES) {
      expect(
        gateway.validatePlan(
          readyPlan([{ step_id: tool, tool, arguments: minimalArguments[tool] }]),
          { user_id: userId }
        )[0].tool
      ).toBe(tool)
    }
  })
})
