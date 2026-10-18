const mockInsertOne = jest.fn()

jest.mock('../src/configs/database.config.js', () => ({
  __esModule: true,
  default: {
    agentExecutionLogs: {
      insertOne: mockInsertOne
    }
  }
}))

import { ObjectId } from 'mongodb'
import { AgentAuditService } from '../src/services/chat/agent/agent-audit.service.js'

const userId = '507f1f77bcf86cd799439011'
const sessionId = '507f1f77bcf86cd799439012'

describe('agent audit service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInsertOne.mockResolvedValue({ insertedId: new ObjectId() })
  })

  it('persists only bounded execution metadata and source IDs', async () => {
    const service = new AgentAuditService()
    const result = await service.create({
      user_id: userId,
      session_id: sessionId,
      correlation_id: `  ${'x'.repeat(300)}  `,
      plan: {
        status: 'ready',
        intent: 'resume',
        confidence: 0.8,
        needs_clarification: false,
        goal: 'Review CV',
        clarification_question: null,
        steps: [{ step_id: 'review', tool: 'search_resume_chunks', arguments: { query: 'secret' } }]
      },
      execution: {
        status: 'partial_failure',
        plan_status: 'ready',
        steps: [
          {
            step_id: 'review',
            tool: 'search_resume_chunks',
            status: 'completed',
            data: { text: 'private CV content', cv_url: 'https://private.example/cv.pdf' },
            sources: [
              { type: 'resume', id: 'resume-1', title: 'Private CV' },
              { type: 'resume', id: 'resume-1', title: 'Private CV' },
              { type: 'job', id: 'job-1', title: 'Job' }
            ]
          },
          {
            step_id: 'failed',
            tool: 'search_jobs',
            status: 'failed',
            error_code: 'TOOL_EXECUTION_FAILED'
          }
        ]
      },
      step_durations_ms: { review: 42 },
      total_duration_ms: 99
    })

    const saved = mockInsertOne.mock.calls[0][0]
    expect(result).toHaveProperty('_id')
    expect(saved).toMatchObject({
      user_id: new ObjectId(userId),
      session_id: new ObjectId(sessionId),
      plan_intent: 'resume',
      execution_status: 'partial_failure',
      total_duration_ms: 99,
      source_ids: ['resume:resume-1', 'job:job-1']
    })
    expect(saved.correlation_id).toHaveLength(128)
    expect(JSON.stringify(saved)).not.toContain('private CV content')
    expect(JSON.stringify(saved)).not.toContain('private.example')
    expect(JSON.stringify(saved)).not.toContain('secret')
    expect(saved.steps[1]).toMatchObject({
      status: 'failed',
      error_code: 'TOOL_EXECUTION_FAILED'
    })
  })

  it('rejects invalid trusted identifiers and propagates database errors', async () => {
    const service = new AgentAuditService()
    await expect(
      service.create({
        user_id: 'not-an-object-id',
        plan: {} as never,
        execution: {} as never,
        total_duration_ms: 1
      })
    ).rejects.toThrow('Invalid agent audit user_id.')

    mockInsertOne.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(
      service.create({
        user_id: userId,
        plan: {
          status: 'unsupported',
          intent: 'general',
          confidence: 0,
          needs_clarification: false,
          goal: 'Unsupported',
          clarification_question: null,
          steps: []
        },
        execution: { status: 'not_executable', plan_status: 'unsupported', steps: [] },
        total_duration_ms: 0
      })
    ).rejects.toThrow('database unavailable')
  })
})
