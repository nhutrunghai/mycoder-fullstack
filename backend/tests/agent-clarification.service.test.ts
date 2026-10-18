import { AgentClarificationService } from '../src/services/chat/agent/agent-clarification.service.js'
import { AgentPlan } from '../src/services/chat/agent/schemas/agent-plan.schema.js'

const service = new AgentClarificationService()

const basePlan: AgentPlan = {
  status: 'ready',
  answer_mode: 'tool_grounded',
  intent: 'job_search',
  confidence: 0.9,
  needs_clarification: false,
  goal: 'Tìm việc phù hợp',
  clarification_question: null,
  steps: [
    {
      step_id: 'search-jobs',
      tool: 'search_jobs',
      arguments: { query: 'Frontend' }
    }
  ]
}

describe('agent clarification service', () => {
  it.each([
    ['missing location', 'Bạn muốn tìm việc ở tỉnh hoặc thành phố nào?'],
    ['missing level', 'Bạn muốn tìm việc ở cấp độ nào?'],
    ['missing CV choice', 'Bạn có muốn dùng CV đã chọn để đối chiếu không?']
  ])('returns the plan-provided question for %s', (_caseName, question) => {
    const plan = {
      ...basePlan,
      status: 'needs_clarification',
      answer_mode: 'clarification',
      needs_clarification: true,
      clarification_question: question,
      steps: []
    } as AgentPlan

    expect(service.resolve(plan)).toEqual({
      status: 'clarification',
      question
    })
  })

  it('normalizes and bounds clarification text without exposing plan internals', () => {
    const question = `  ${'x'.repeat(500)}  `
    const result = service.resolve({
      ...basePlan,
      status: 'needs_clarification',
      answer_mode: 'clarification',
      needs_clarification: true,
      clarification_question: question,
      steps: []
    } as AgentPlan)

    expect(result.status).toBe('clarification')
    if (result.status === 'clarification') {
      expect(result.question).toBe('x'.repeat(500))
      expect(result.question).toHaveLength(500)
    }
    expect(JSON.stringify(result)).not.toContain('search-jobs')
    expect(JSON.stringify(result)).not.toContain('Frontend')

    expect(
      service.resolve({
        ...basePlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: 'x'.repeat(501),
        steps: []
      })
    ).toEqual({
      status: 'invalid_plan',
      message: 'Kế hoạch xử lý không hợp lệ.'
    })
  })

  it('returns a stable unsupported result without inventing a question', () => {
    expect(
      service.resolve({
        ...basePlan,
        status: 'unsupported',
        answer_mode: 'clarification',
        clarification_question: null,
        steps: []
      } as AgentPlan)
    ).toEqual({
      status: 'unsupported',
      message: 'Yêu cầu này hiện chưa được hỗ trợ.'
    })
  })

  it('returns ready without inspecting or executing plan steps', () => {
    expect(service.resolve(basePlan)).toEqual({ status: 'ready' })
  })

  it('returns a stable invalid-plan result for malformed plans', () => {
    expect(
      service.resolve({
        ...basePlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: '   ',
        steps: []
      })
    ).toEqual({
      status: 'invalid_plan',
      message: 'Kế hoạch xử lý không hợp lệ.'
    })

    expect(
      service.resolve({
        status: 'needs_clarification',
        needs_clarification: true,
        clarification_question: 'Không đầy đủ'
      })
    ).toEqual({
      status: 'invalid_plan',
      message: 'Kế hoạch xử lý không hợp lệ.'
    })
  })

  it('does not call external dependencies', () => {
    const plan = {
      ...basePlan,
      status: 'needs_clarification',
      answer_mode: 'clarification',
      needs_clarification: true,
      clarification_question: 'Bạn muốn tìm việc ở đâu?',
      steps: []
    } as AgentPlan

    expect(service.resolve(plan)).toEqual({
      status: 'clarification',
      question: 'Bạn muốn tìm việc ở đâu?'
    })
  })
})
