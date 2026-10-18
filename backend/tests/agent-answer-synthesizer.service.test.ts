const generateJson = jest.fn()
const generateText = jest.fn()

jest.mock('../src/configs/env.config.js', () => ({
  __esModule: true,
  default: {
    LLM_PROVIDER: 'gemini',
    LLM_MODEL_CHAT: 'gemini-2.5-flash'
  }
}))

jest.mock('../src/services/chat/ai/llm.service.js', () => ({
  __esModule: true,
  default: { generateJson, generateText }
}))

import { AgentAnswerSynthesizerService } from '../src/services/chat/agent/agent-answer-synthesizer.service.js'

const validPlan = {
  status: 'ready',
  answer_mode: 'tool_grounded',
  intent: 'job_search',
  confidence: 0.9,
  needs_clarification: false,
  goal: 'Tìm việc Frontend',
  clarification_question: null,
  steps: [{ step_id: 'search', tool: 'search_jobs', arguments: { query: 'Frontend' } }]
} as const

describe('agent answer synthesizer service', () => {
  const service = new AgentAnswerSynthesizerService()

  beforeEach(() => {
    generateJson.mockReset()
    generateText.mockReset()
  })

  it('returns the clarification question directly without calling the LLM', async () => {
    const result = await service.synthesize(
      'Tìm việc cho tôi',
      {
        ...validPlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: 'Bạn muốn tìm việc ở khu vực nào?',
        steps: []
      } as never,
      { status: 'not_executable', plan_status: 'needs_clarification', steps: [] }
    )

    expect(result).toEqual({
      answer: 'Bạn muốn tìm việc ở khu vực nào?',
      sources: []
    })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('answers general knowledge without tools and carries the conversation context into the model prompt', async () => {
    generateText.mockResolvedValueOnce('Sale là hoạt động tư vấn và thuyết phục khách hàng mua sản phẩm hoặc dịch vụ.')

    const result = await service.synthesize(
      'khái niệm',
      {
        ...validPlan,
        intent: 'general',
        answer_mode: 'model_knowledge',
        goal: 'Giải thích khái niệm ngành sale',
        steps: []
      } as never,
      { status: 'completed', plan_status: 'ready', steps: [] },
      undefined,
      'user: ngành sale là gì?'
    )

    expect(result).toEqual({
      answer: 'Sale là hoạt động tư vấn và thuyết phục khách hàng mua sản phẩm hoặc dịch vụ.',
      sources: []
    })
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('ngành sale là gì?')
      })
    )
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('returns a stable unavailable response without LLM when no successful data exists', async () => {
    const result = await service.synthesize(
      'Tìm việc Frontend',
      validPlan as never,
      {
        status: 'failed',
        plan_status: 'ready',
        steps: [{ step_id: 'search', tool: 'search_jobs', status: 'failed', error_code: 'TOOL_TIMEOUT' }]
      }
    )

    expect(result.sources).toEqual([])
    expect(result.answer).toContain('chưa có đủ dữ liệu')
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('synthesizes successful data and filters duplicate or fabricated source ids', async () => {
    generateJson.mockResolvedValueOnce({
      answer: 'Có một việc Frontend phù hợp.',
      source_ids: ['job:job-1', 'fake:source', 'job:job-1']
    })

    const result = await service.synthesize(
      'Tìm việc Frontend',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'search',
            tool: 'search_jobs',
            status: 'completed',
            data: { items: [{ job_id: 'job-1', title: 'Frontend Engineer' }] },
            sources: [
              { type: 'job', id: 'job-1', title: 'Frontend Engineer' },
              { type: 'job', id: 'job-1', title: 'Frontend Engineer' }
            ]
          }
        ]
      }
    )

    expect(generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        schema: expect.objectContaining({
          required: ['answer', 'source_ids']
        })
      })
    )
    expect(generateJson.mock.calls[0][0].prompt).toContain('Tìm việc Frontend')
    expect(result).toEqual({
      answer: 'Có một việc Frontend phù hợp.',
      sources: [{ source_id: 'job:job-1', type: 'job', id: 'job-1', title: 'Frontend Engineer' }]
    })
  })

  it('keeps available sources when the model returns no valid source id', async () => {
    generateJson.mockResolvedValueOnce({
      answer: 'Đây là thông tin chi tiết của công việc.',
      source_ids: []
    })

    const result = await service.synthesize(
      'Giải thích công việc này',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'detail',
            tool: 'get_job_details',
            status: 'completed',
            data: { items: [{ job_id: 'job-1', title: 'Frontend Engineer' }] },
            sources: [{ type: 'job', id: 'job-1', title: 'Frontend Engineer' }]
          }
        ]
      }
    )

    expect(result.sources).toEqual([{ source_id: 'job:job-1', type: 'job', id: 'job-1', title: 'Frontend Engineer' }])
  })

  it('builds a grounded detail answer without letting the LLM select another job', async () => {
    const result = await service.synthesize(
      'Giải thích job đầu tiên trong danh sách mới',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'detail',
            tool: 'get_job_detail',
            status: 'completed',
            data: {
              job_id: 'job-1',
              title: 'Azure DevOps Engineer',
              location: 'Ha Noi',
              level: 'middle',
              job_type: 'remote',
              salary: { min: 20000000, max: 30000000, currency: 'VND' },
              skills: ['Azure', 'AKS'],
              description: 'Build cloud infrastructure.',
              requirements: 'Azure experience.',
              company: { company_name: 'Acme' }
            },
            sources: [{ type: 'job', id: 'job-1', title: 'Azure DevOps Engineer' }]
          }
        ]
      }
    )

    expect(result.answer).toContain('Azure DevOps Engineer')
    expect(result.answer).not.toContain('AWS DevOps Engineer')
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('chooses the lower-level job for a beginner comparison from grounded data', async () => {
    const result = await service.synthesize(
      'Trong hai job đó, job nào phù hợp hơn cho người mới bắt đầu?',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'compare',
            tool: 'compare_jobs',
            status: 'completed',
            data: {
              items: [
                { job_id: 'job-1', title: 'Frontend Intern', level: 'intern', skills: [] },
                { job_id: 'job-2', title: 'Frontend Senior', level: 'senior', skills: [] }
              ]
            },
            sources: [
              { type: 'job', id: 'job-1', title: 'Frontend Intern' },
              { type: 'job', id: 'job-2', title: 'Frontend Senior' }
            ]
          }
        ]
      }
    )

    expect(result.answer).toContain('Frontend Intern')
    expect(result.answer.split('\n')[0]).toContain('Frontend Intern')
    expect(result.answer).toContain('phù hợp hơn cho người mới bắt đầu')
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('puts a Vietnamese beginner recommendation before the compared job list', async () => {
    const result = await service.synthesize(
      'Trong hai job \u0111\u00f3, job n\u00e0o ph\u00f9 h\u1ee3p h\u01a1n cho ng\u01b0\u1eddi m\u1edbi b\u1eaft \u0111\u1ea7u?',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'compare',
            tool: 'compare_jobs',
            status: 'completed',
            data: {
              items: [
                { job_id: 'job-1', title: 'Frontend Intern', level: 'intern', skills: [] },
                { job_id: 'job-2', title: 'Frontend Lead', level: 'lead', skills: [] }
              ]
            },
            sources: []
          }
        ]
      }
    )

    expect(result.answer.split('\n')[0]).toContain('Frontend Intern')
    expect(result.answer.indexOf('Frontend Intern')).toBeLessThan(result.answer.indexOf('1. **Frontend Intern**'))
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('does not recommend senior roles as suitable for beginners', async () => {
    const result = await service.synthesize(
      'Which job is better for a fresher?',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'compare',
            tool: 'compare_jobs',
            status: 'completed',
            data: {
              items: [
                { job_id: 'job-1', title: 'Frontend Lead', level: 'lead', skills: [] },
                { job_id: 'job-2', title: 'Frontend Manager', level: 'manager', skills: [] }
              ]
            },
            sources: []
          }
        ]
      }
    )

    expect(result.answer).toContain('kh\u00f4ng ph\u00f9 h\u1ee3p')
    expect(result.answer).toContain('Intern')
    expect(result.answer).not.toContain('Frontend Lead** ph\u00f9 h\u1ee3p h\u01a1n')
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('returns an explicit state when a selected CV or policy corpus is not ready', async () => {
    const resumeResult = await service.synthesize(
      'Đánh giá CV của tôi',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'resume',
            tool: 'search_resume_chunks',
            status: 'completed',
            data: { status: 'not_ready', message: 'CV đang được xử lý.', chunks: [] },
            sources: [{ type: 'resume', id: 'resume-1', title: 'My CV' }]
          }
        ]
      }
    )

    const policyResult = await service.synthesize(
      'Chính sách bảo hiểm là gì?',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'policy',
            tool: 'search_policy_documents',
            status: 'completed',
            data: { items: [], limit: 5 },
            sources: []
          }
        ]
      }
    )

    expect(resumeResult.answer).toContain('CV đang được xử lý')
    expect(policyResult.answer).toContain('chưa có tài liệu chính sách')
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('omits failed step errors from the prompt while retaining successful data', async () => {
    generateJson.mockResolvedValueOnce({
      answer: 'Đã tìm thấy thông tin có thể sử dụng.',
      source_ids: []
    })

    await service.synthesize(
      'Tìm việc Frontend',
      validPlan as never,
      {
        status: 'partial_failure',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'search',
            tool: 'search_jobs',
            status: 'completed',
            data: { items: [{ title: 'Frontend Engineer' }] },
            sources: [{ type: 'job', id: 'job-1', title: 'Frontend Engineer' }]
          },
          {
            step_id: 'policy',
            tool: 'search_policy_documents',
            status: 'failed',
            error_code: 'TOOL_EXECUTION_FAILED'
          }
        ]
      }
    )

    const prompt = generateJson.mock.calls[0][0].prompt
    expect(prompt).toContain('Frontend Engineer')
    expect(prompt).not.toContain('TOOL_EXECUTION_FAILED')
    expect(prompt).not.toContain('"policy"')
  })

  it('returns a deterministic fallback with safe successful sources when the LLM fails', async () => {
    generateJson.mockRejectedValueOnce(new Error('provider unavailable'))

    const result = await service.synthesize(
      'Tìm việc Frontend',
      validPlan as never,
      {
        status: 'completed',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'search',
            tool: 'search_jobs',
            status: 'completed',
            data: { items: [] },
            sources: [{ type: 'job', id: 'job-1', title: 'Frontend Engineer' }]
          }
        ]
      }
    )

    expect(result.answer).toContain('chưa thể tổng hợp')
    expect(result.sources).toEqual([
      { source_id: 'job:job-1', type: 'job', id: 'job-1', title: 'Frontend Engineer' }
    ])
    expect(result.answer).not.toContain('provider unavailable')
  })
})
