const mockAudit = jest.fn()

jest.mock('../src/configs/logger.config.js', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    fatal: jest.fn()
  }
}))

jest.mock('../src/configs/env.config.js', () => ({
  __esModule: true,
  default: {
    LLM_PROVIDER: 'gemini',
    LLM_MODEL_INTENT: 'intent',
    LLM_MODEL_CHAT: 'chat',
    EMBEDDING_API_URL: 'http://localhost:8000',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_EMBEDDING_MODEL: 'embedding',
    RESUME_EMBEDDING_DIMS: 1536,
    GEMINI_API_TIMEOUT_MS: 1000,
    OPENAI_API_TIMEOUT_MS: 1000
  }
}))

jest.mock('../src/configs/database.config.js', () => ({
  __esModule: true,
  default: {
    systemSettings: {
      findOne: jest.fn()
    },
    agentExecutionLogs: {
      insertOne: jest.fn()
    }
  }
}))

import { AgentChatOrchestratorService } from '../src/services/chat/agent/agent-chat-orchestrator.service.js'

const config = {
  enabled: true,
  agentic_enabled: true,
  provider: 'gemini' as const,
  intent_model: 'intent',
  chat_model: 'chat',
  cv_visual_review_model: 'visual',
  job_search_top_k: 5,
  job_explanation_top_k: 5,
  cv_review_top_k: 5,
  answer_context_limit: 3,
  allow_cv_review: true,
  allow_job_qa: true,
  allow_policy_qa: true,
  allow_general_qa: true,
  maintenance_message: null
}

const session = {
  _id: '507f1f77bcf86cd799439012',
  turns: [{ role: 'user', content: 'Tìm việc frontend', created_at: new Date() }]
} as never

const readyPlan = {
  status: 'ready',
  intent: 'job_search',
  confidence: 0.9,
  needs_clarification: false,
  goal: 'Tìm việc frontend',
  clarification_question: null,
  steps: [{ step_id: 'search', tool: 'search_jobs', arguments: { query: 'frontend' } }]
} as never

describe('agent chat orchestrator service', () => {
  beforeEach(() => jest.clearAllMocks())

  it('runs planner, executor and synthesizer then returns legacy-compatible sources', async () => {
    const service = new AgentChatOrchestratorService({
      planner: { createPlan: jest.fn().mockResolvedValue(readyPlan) },
      clarification: { resolve: jest.fn().mockReturnValue({ status: 'ready' }) },
      executor: {
        executePlan: jest.fn().mockResolvedValue({
          status: 'completed',
          plan_status: 'ready',
          steps: [
            {
              step_id: 'search',
              tool: 'search_jobs',
              status: 'completed',
              data: { items: [] },
              sources: [{ type: 'job', id: '507f1f77bcf86cd799439013', title: 'Frontend' }]
            }
          ]
        })
      },
      synthesizer: {
        synthesize: jest.fn().mockResolvedValue({
          answer: 'Đã tìm thấy việc phù hợp.',
          sources: [{ source_id: 'job:507f1f77bcf86cd799439013', type: 'job', id: '507f1f77bcf86cd799439013', title: 'Frontend' }]
        })
      },
      audit: { create: mockAudit }
    })

    await expect(
      service.respond({
        message: 'Tìm việc frontend',
        user_id: '507f1f77bcf86cd799439011',
        session,
        config
      })
    ).resolves.toMatchObject({
      intent: 'job_search',
      answer: 'Đã tìm thấy việc phù hợp.',
      sources: [
        {
          type: 'job',
          job_id: '507f1f77bcf86cd799439013',
          title: 'Frontend',
          company: ''
        }
      ]
    })
    expect(mockAudit).toHaveBeenCalledTimes(1)
  })

  it('does not execute tools for a clarification plan', async () => {
    const plan = {
      ...readyPlan,
      status: 'needs_clarification',
      needs_clarification: true,
      clarification_question: 'Bạn muốn tìm việc ở đâu?',
      steps: []
    } as never
    const executePlan = jest.fn().mockResolvedValue({
      status: 'completed',
      plan_status: 'ready',
      steps: []
    })
    const service = new AgentChatOrchestratorService({
      planner: { createPlan: jest.fn().mockResolvedValue(plan) },
      clarification: { resolve: jest.fn().mockReturnValue({ status: 'clarification', question: 'Bạn muốn tìm việc ở đâu?' }) },
      executor: { executePlan },
      synthesizer: {
        synthesize: jest.fn().mockResolvedValue({ answer: 'Bạn muốn tìm việc ở đâu?', sources: [] })
      },
      audit: { create: mockAudit }
    })

    await service.respond({
      message: 'Tìm việc',
      user_id: '507f1f77bcf86cd799439011',
      session,
      config
    })

    expect(executePlan).not.toHaveBeenCalled()
    expect(mockAudit).toHaveBeenCalledTimes(1)
  })

  it('maps model-knowledge general answers to general_chat', async () => {
    const plan = {
      status: 'ready',
      answer_mode: 'model_knowledge',
      intent: 'general',
      confidence: 0.9,
      needs_clarification: false,
      goal: 'Explain a career topic',
      clarification_question: null,
      steps: []
    } as never
    const executePlan = jest.fn().mockResolvedValue({
      status: 'completed',
      plan_status: 'ready',
      steps: []
    })
    const service = new AgentChatOrchestratorService({
      planner: { createPlan: jest.fn().mockResolvedValue(plan) },
      clarification: { resolve: jest.fn().mockReturnValue({ status: 'ready' }) },
      executor: { executePlan },
      synthesizer: {
        synthesize: jest.fn().mockResolvedValue({ answer: 'General answer', sources: [] })
      },
      audit: { create: mockAudit }
    })

    await expect(
      service.respond({
        message: 'What is sales?',
        user_id: '507f1f77bcf86cd799439011',
        session,
        config
      })
    ).resolves.toMatchObject({
      intent: 'general_chat',
      answer: 'General answer',
      sources: []
    })
    expect(executePlan).toHaveBeenCalledTimes(1)
  })

  it('propagates planner errors so the chat service can use legacy fallback', async () => {
    const service = new AgentChatOrchestratorService({
      planner: { createPlan: jest.fn().mockRejectedValue(new Error('provider unavailable')) }
    })

    await expect(
      service.respond({
        message: 'Tìm việc frontend',
        user_id: '507f1f77bcf86cd799439011',
        session,
        config
      })
    ).rejects.toThrow('provider unavailable')
    expect(mockAudit).not.toHaveBeenCalled()
  })
})
