import { AGENT_TOOL_NAMES } from '../src/services/chat/agent/agent-tool.js'
import {
  agentToolDefinitions,
  getAgentToolDefinition,
  isRegisteredAgentTool
} from '../src/services/chat/agent/tools/tool-registry.js'

describe('agent tool registry', () => {
  it('has every registered tool in tuple order and read-only access', () => {
    expect(agentToolDefinitions.map((definition) => definition.name)).toEqual(AGENT_TOOL_NAMES)
    expect(agentToolDefinitions.every((definition) => definition.access === 'read')).toBe(true)
  })

  it('allows one call per plan for every tool', () => {
    expect(agentToolDefinitions.every((definition) => definition.max_calls_per_plan === 1)).toBe(true)
  })

  it('looks up known tools and rejects unknown tool names', () => {
    expect(getAgentToolDefinition('search_jobs')).toEqual(
      expect.objectContaining({
        name: 'search_jobs',
        access: 'read'
      })
    )
    expect(isRegisteredAgentTool('search_jobs')).toBe(true)
    expect(isRegisteredAgentTool('delete_jobs')).toBe(false)
  })
})
