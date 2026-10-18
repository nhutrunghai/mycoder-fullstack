import { AgentEvaluationService } from '../src/services/chat/agent/evaluation/agent-evaluation.service.js'

describe('agent evaluation service', () => {
  it('calculates tool, source, answer and latency metrics from an evaluation corpus', async () => {
    const service = new AgentEvaluationService()
    const report = await service.evaluate(
      [
        {
          id: 'job-search',
          category: 'job_search',
          message: 'Tìm việc frontend',
          expectation: {
            plan_status: 'ready',
            tools: ['search_jobs'],
            source_types: ['job'],
            answer_required: true
          }
        },
        {
          id: 'clarify',
          category: 'clarification',
          message: 'Tìm việc',
          expectation: { plan_status: 'needs_clarification', answer_required: true }
        }
      ],
      async (testCase) =>
        testCase.id === 'job-search'
          ? {
              plan_status: 'ready',
              tools: ['search_jobs'],
              source_types: ['job'],
              answer: 'Có việc phù hợp.',
              latency_ms: 120
            }
          : {
              plan_status: 'needs_clarification',
              tools: [],
              source_types: [],
              answer: 'Bạn muốn làm ở đâu?',
              latency_ms: 80
            }
    )

    expect(report).toMatchObject({
      total: 2,
      passed: 2,
      failed: 0,
      pass_rate: 1,
      average_latency_ms: 100
    })
  })

  it('reports a failed tool selection without hiding the failed case', async () => {
    const service = new AgentEvaluationService()
    const report = await service.evaluate(
      [
        {
          id: 'policy',
          category: 'policy',
          message: 'Chính sách bảo hiểm',
          expectation: { plan_status: 'ready', tools: ['search_policy_documents'] }
        }
      ],
      async () => ({
        plan_status: 'ready',
        tools: ['search_jobs'],
        source_types: [],
        answer: 'Không liên quan',
        latency_ms: 50
      })
    )

    expect(report.failed).toBe(1)
    expect(report.results[0].failures[0]).toContain('tools expected search_policy_documents')
  })
})
