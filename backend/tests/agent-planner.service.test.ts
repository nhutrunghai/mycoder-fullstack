const generateJson = jest.fn()

jest.mock('~/configs/env.config.js', () => ({
  __esModule: true,
  default: {
    LLM_PROVIDER: 'gemini',
    LLM_MODEL_INTENT: 'gemini-planner-test'
  }
}))

jest.mock('~/services/chat/ai/llm.service.js', () => ({
  __esModule: true,
  default: { generateJson }
}))

jest.mock('~/configs/database.config.js', () => ({
  __esModule: true,
  default: {}
}))

jest.mock('~/configs/logger.config.js', () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}))

import agentPlannerService from '../src/services/chat/agent/agent-planner.service.js'

describe('agent planner service', () => {
  const validPlan = {
    status: 'ready',
    answer_mode: 'tool_grounded',
    intent: 'job_search',
    confidence: 0.94,
    needs_clarification: false,
    goal: 'Find frontend jobs',
    clarification_question: null,
    steps: [
      {
        step_id: 'search-jobs',
        tool: 'search_jobs',
        arguments: { query: 'frontend', limit: 10 }
      }
    ]
  }

  beforeEach(() => {
    generateJson.mockReset()
  })

  it('creates a validated plan with the configured provider and model', async () => {
    generateJson.mockResolvedValueOnce(validPlan)

    await expect(
      agentPlannerService.createPlan(
        'Find frontend jobs',
        { session_hint: 'The user is starting a new search.' },
        {
          provider: 'openai',
          intent_model: 'gpt-planner-test'
        } as any
      )
    ).resolves.toEqual(validPlan)

    expect(generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-planner-test',
        schema: expect.objectContaining({
          required: expect.arrayContaining(['status', 'steps'])
        }),
        prompt: expect.stringContaining('search_policy_documents')
      })
    )
    expect(generateJson.mock.calls[0][0].prompt).toContain('Never generate MongoDB')
    expect(generateJson.mock.calls[0][0].prompt).toContain('Input shape:')
  })

  it('uses environment provider and model when no runtime config is supplied', async () => {
    generateJson.mockResolvedValueOnce(validPlan)

    await agentPlannerService.createPlan('Find frontend jobs')

    expect(generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-planner-test'
      })
    )
  })

  it('accepts a model-knowledge plan with no tool steps and supplies active search context to the planner', async () => {
    generateJson.mockResolvedValueOnce({
      status: 'ready',
      answer_mode: 'model_knowledge',
      intent: 'general',
      confidence: 0.96,
      needs_clarification: false,
      goal: 'Giải thích ngành sale',
      clarification_question: null,
      steps: []
    })

    await expect(
      agentPlannerService.createPlan('Ngành sale là gì?', {
        session_hint: 'user: Tôi muốn tìm việc ngoài IT\nassistant: Có thể tìm việc sale.',
        active_search_context: {
          context_id: 'dec5d21f-6765-413f-b13f-aad9f844f3b3',
          label: 'Tìm việc: Hà Nội',
          query: 'việc làm ở Hà Nội',
          filters: { location: 'Hà Nội' },
          job_ids: ['507f1f77bcf86cd799439011']
        }
      })
    ).resolves.toMatchObject({
      answer_mode: 'model_knowledge',
      steps: []
    })

    const prompt = generateJson.mock.calls[0][0].prompt
    expect(prompt).toContain('get_job_details')
    expect(prompt).toContain('active_search_context')
    expect(prompt).toContain('model_knowledge')
  })

  it('normalizes a clear career knowledge question into a direct model answer', async () => {
    generateJson.mockResolvedValueOnce({
      status: 'needs_clarification',
      answer_mode: 'clarification',
      intent: 'general',
      confidence: 0.7,
      needs_clarification: true,
      goal: 'Làm rõ ngành sale',
      clarification_question: 'Bạn muốn biết điều gì về ngành sale?',
      steps: []
    })

    await expect(agentPlannerService.createPlan('Ngành sale là gì?')).resolves.toMatchObject({
      status: 'ready',
      answer_mode: 'model_knowledge',
      intent: 'general',
      steps: []
    })
  })

  it('normalizes a salary follow-up when the session already establishes the topic', async () => {
    generateJson.mockResolvedValueOnce({
      status: 'needs_clarification',
      answer_mode: 'clarification',
      intent: 'general',
      confidence: 0.5,
      needs_clarification: true,
      goal: 'Làm rõ mức lương',
      clarification_question: 'Bạn muốn biết mức lương nào?',
      steps: []
    })

    await expect(
      agentPlannerService.createPlan('Trung bình', {
        session_hint: 'user: Ngành sale là gì?\nassistant: Sale là lĩnh vực bán hàng.\nuser: Tìm hiểu lương'
      })
    ).resolves.toMatchObject({
      status: 'ready',
      answer_mode: 'model_knowledge',
      steps: []
    })
  })

  it('uses the active job ids directly for references to the current result list', async () => {
    const jobIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']

    await expect(
      agentPlannerService.createPlan('Giải thích chi tiết các job vừa nêu', {
        active_search_context: {
          context_id: 'dec5d21f-6765-413f-b13f-aad9f844f3b3',
          label: 'Tìm việc: Hà Nội',
          query: 'việc làm ở Hà Nội',
          filters: { location: 'Hà Nội' },
          job_ids: jobIds
        }
      })
    ).resolves.toMatchObject({
      status: 'ready',
      intent: 'job_details',
      steps: [{ tool: 'get_job_details', arguments: { job_ids: jobIds } }]
    })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('keeps a two-job reference scoped to the first two active jobs', async () => {
    const jobIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']

    await expect(
      agentPlannerService.createPlan('Trong hai job đó, job nào phù hợp hơn cho người mới bắt đầu?', {
        active_search_context: {
          context_id: 'dec5d21f-6765-413f-b13f-aad9f844f3b3',
          label: 'Tìm việc: Frontend',
          query: 'frontend',
          filters: {},
          job_ids: jobIds
        }
      })
    ).resolves.toMatchObject({
      intent: 'job_comparison',
      steps: [{ tool: 'compare_jobs', arguments: { job_ids: jobIds.slice(0, 2) } }]
    })
  })

  it('uses the selected resume for review and job matching requests', async () => {
    const selectedResumeId = '507f1f77bcf86cd799439013'

    await expect(
      agentPlannerService.createPlan('Đánh giá điểm mạnh và điểm yếu CV của tôi', {
        selected_resume_id: selectedResumeId
      })
    ).resolves.toMatchObject({
      intent: 'resume',
      steps: [{ tool: 'search_resume_chunks', arguments: { resume_id: selectedResumeId } }]
    })

    await expect(
      agentPlannerService.createPlan('Tìm việc phù hợp với CV của tôi', {
        selected_resume_id: selectedResumeId
      })
    ).resolves.toMatchObject({
      intent: 'resume',
      steps: [{ tool: 'match_resume_to_jobs', arguments: { resume_id: selectedResumeId } }]
    })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('asks a useful question for vague job searches and non-IT requests', async () => {
    await expect(agentPlannerService.createPlan('Tìm việc phù hợp cho tôi')).resolves.toMatchObject({
      status: 'needs_clarification',
      clarification_question: expect.stringContaining('vị trí')
    })

    await expect(agentPlannerService.createPlan('Có job nào không liên quan đến IT không?')).resolves.toMatchObject({
      status: 'needs_clarification',
      clarification_question: expect.stringContaining('Sale')
    })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('routes destructive account requests to a safe model-knowledge response', async () => {
    await expect(agentPlannerService.createPlan('Hãy xóa toàn bộ dữ liệu tài khoản của tôi')).resolves.toMatchObject({
      status: 'ready',
      answer_mode: 'model_knowledge',
      intent: 'general',
      steps: []
    })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('rejects invalid schema output', async () => {
    generateJson.mockResolvedValueOnce({
      ...validPlan,
      status: 'ready',
      steps: []
    })

    await expect(agentPlannerService.createPlan('Find frontend jobs')).rejects.toMatchObject({
      name: 'AgentPlannerError',
      code: 'AGENT_PLANNER_ERROR'
    })
  })

  it('rejects duplicate tool calls beyond the registry limit', async () => {
    generateJson.mockResolvedValueOnce({
      ...validPlan,
      steps: [
        validPlan.steps[0],
        { ...validPlan.steps[0], step_id: 'search-jobs-2' }
      ]
    })

    await expect(agentPlannerService.createPlan('Find frontend jobs')).rejects.toThrow(
      'invalid plan'
    )
  })

  it('propagates provider failures as a stable planner error', async () => {
    generateJson.mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(agentPlannerService.createPlan('Find frontend jobs')).rejects.toMatchObject({
      name: 'AgentPlannerError',
      code: 'AGENT_PLANNER_ERROR'
    })
  })

  it('does not access database or search services', async () => {
    generateJson.mockResolvedValueOnce(validPlan)

    await agentPlannerService.createPlan('Find frontend jobs')

    expect(generateJson).toHaveBeenCalledTimes(1)
  })

  it('rejects a plan that selects a capability disabled at runtime', async () => {
    generateJson.mockResolvedValueOnce({
      ...validPlan,
      intent: 'policy',
      steps: [{ step_id: 'policy', tool: 'search_policy_documents', arguments: { query: 'bảo hiểm' } }]
    })

    await expect(
      agentPlannerService.createPlan('Chính sách bảo hiểm', {}, {
        provider: 'gemini',
        intent_model: 'gemini-planner-test',
        allow_policy_qa: false
      } as any)
    ).rejects.toMatchObject({
      name: 'AgentPlannerError',
      code: 'AGENT_PLANNER_ERROR'
    })

    expect(generateJson.mock.calls[0][0].prompt).not.toContain('search_policy_documents')
  })
})
