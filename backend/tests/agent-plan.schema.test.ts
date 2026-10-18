import { agentPlanSchema } from '../src/services/chat/agent/schemas/agent-plan.schema.js'

describe('agent plan schema', () => {
  const validReadyPlan = {
    status: 'ready',
    answer_mode: 'tool_grounded',
    intent: 'job_search',
    confidence: 0.92,
    needs_clarification: false,
    goal: 'Find Frontend jobs',
    clarification_question: null,
    steps: [
      {
        step_id: 'search-jobs',
        tool: 'search_jobs',
        arguments: { query: 'Frontend' }
      }
    ]
  }

  it('accepts a valid ready plan with non-authoritative intent metadata', () => {
    expect(agentPlanSchema.safeParse(validReadyPlan).success).toBe(true)
  })

  it('rejects a tool-grounded ready plan with zero steps or clarification state', () => {
    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        steps: []
      }).success
    ).toBe(false)

    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        needs_clarification: true
      }).success
    ).toBe(false)
  })

  it('accepts a model-knowledge ready plan with no tool steps', () => {
    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        intent: 'general',
        answer_mode: 'model_knowledge',
        goal: 'Giải thích ngành sale',
        steps: []
      }).success
    ).toBe(true)
  })

  it('rejects model-knowledge plans that attempt to call a tool', () => {
    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        answer_mode: 'model_knowledge'
      }).success
    ).toBe(false)
  })

  it('accepts clarification and unsupported plans only with their synchronized fields', () => {
    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: 'Which location do you prefer?',
        steps: []
      }).success
    ).toBe(true)

    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        status: 'unsupported',
        answer_mode: 'clarification',
        needs_clarification: false,
        clarification_question: null,
        steps: []
      }).success
    ).toBe(true)
  })

  it('rejects invalid clarification state combinations', () => {
    const invalidPlans = [
      {
        ...validReadyPlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: false,
        clarification_question: 'Which location do you prefer?',
        steps: []
      },
      {
        ...validReadyPlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: null,
        steps: []
      },
      {
        ...validReadyPlan,
        status: 'needs_clarification',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: 'Which location do you prefer?'
      },
      {
        ...validReadyPlan,
        status: 'unsupported',
        answer_mode: 'clarification',
        needs_clarification: true,
        clarification_question: null,
        steps: []
      },
      {
        ...validReadyPlan,
        status: 'unsupported',
        answer_mode: 'clarification',
        needs_clarification: false,
        clarification_question: 'Unexpected question',
        steps: []
      }
    ]

    for (const plan of invalidPlans) {
      expect(agentPlanSchema.safeParse(plan).success).toBe(false)
    }
  })

  it('rejects unknown tools, duplicate steps, and non-object arguments', () => {
    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        steps: [{ ...validReadyPlan.steps[0], tool: 'delete_jobs' }]
      }).success
    ).toBe(false)

    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        steps: [validReadyPlan.steps[0], { ...validReadyPlan.steps[0] }]
      }).success
    ).toBe(false)

    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        steps: [{ ...validReadyPlan.steps[0], arguments: ['Frontend'] }]
      }).success
    ).toBe(false)
  })

  it('rejects invalid confidence, old fixed intents, and unknown top-level fields', () => {
    for (const confidence of [-0.01, 1.01]) {
      expect(
        agentPlanSchema.safeParse({
          ...validReadyPlan,
          confidence
        }).success
      ).toBe(false)
    }

    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        intent: 'cv_review'
      }).success
    ).toBe(false)

    expect(
      agentPlanSchema.safeParse({
        ...validReadyPlan,
        backend_route: 'job_search'
      }).success
    ).toBe(false)
  })
})
