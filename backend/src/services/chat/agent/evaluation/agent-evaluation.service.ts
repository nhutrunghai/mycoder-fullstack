import { AgentPlanStatus } from '~/services/chat/agent/schemas/agent-plan.schema.js'
import { AgentToolName } from '~/services/chat/agent/agent-tool.js'

export type AgentEvaluationExpectation = {
  plan_status: AgentPlanStatus
  tools?: AgentToolName[]
  source_types?: string[]
  answer_required?: boolean
}

export type AgentEvaluationCase = {
  id: string
  category: 'job_search' | 'job_detail' | 'comparison' | 'resume' | 'policy' | 'clarification' | 'unsupported'
  message: string
  expectation: AgentEvaluationExpectation
}

export type AgentEvaluationObservation = {
  plan_status: AgentPlanStatus
  tools: AgentToolName[]
  source_types: string[]
  answer: string
  latency_ms: number
}

export type AgentEvaluationCaseResult = {
  id: string
  passed: boolean
  failures: string[]
  latency_ms: number
}

export type AgentEvaluationReport = {
  total: number
  passed: number
  failed: number
  pass_rate: number
  average_latency_ms: number
  results: AgentEvaluationCaseResult[]
}

export type AgentEvaluationRunner = (testCase: AgentEvaluationCase) => Promise<AgentEvaluationObservation>

function sameValues(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value) => expected.includes(value))
}

export class AgentEvaluationService {
  async evaluate(cases: readonly AgentEvaluationCase[], runner: AgentEvaluationRunner): Promise<AgentEvaluationReport> {
    const results: AgentEvaluationCaseResult[] = []

    for (const testCase of cases) {
      const observation = await runner(testCase)
      const failures: string[] = []
      const expected = testCase.expectation

      if (observation.plan_status !== expected.plan_status) {
        failures.push(`plan_status expected ${expected.plan_status}, received ${observation.plan_status}`)
      }

      if (expected.tools && !sameValues([...new Set(observation.tools)].sort(), [...new Set(expected.tools)].sort())) {
        failures.push(`tools expected ${expected.tools.join(',')}, received ${observation.tools.join(',')}`)
      }

      if (
        expected.source_types &&
        !expected.source_types.every((sourceType) => observation.source_types.includes(sourceType))
      ) {
        failures.push(`missing source types: ${expected.source_types.filter((type) => !observation.source_types.includes(type)).join(',')}`)
      }

      if (expected.answer_required && !observation.answer.trim()) {
        failures.push('answer is empty')
      }

      results.push({
        id: testCase.id,
        passed: failures.length === 0,
        failures,
        latency_ms: observation.latency_ms
      })
    }

    const passed = results.filter((result) => result.passed).length
    const totalLatency = results.reduce((sum, result) => sum + result.latency_ms, 0)

    return {
      total: results.length,
      passed,
      failed: results.length - passed,
      pass_rate: results.length ? passed / results.length : 0,
      average_latency_ms: results.length ? Math.round(totalLatency / results.length) : 0,
      results
    }
  }
}

const agentEvaluationService = new AgentEvaluationService()
export default agentEvaluationService
