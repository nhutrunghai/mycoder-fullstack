import { AGENT_TOOL_NAMES, AgentToolAccess, AgentToolName } from '~/services/chat/agent/agent-tool'
import { RagChatRuntimeConfig } from '~/services/admin/system-setting.service.js'

export interface AgentToolDefinition {
  name: AgentToolName
  access: AgentToolAccess
  description: string
  max_calls_per_plan: number
}

export const agentToolDefinitions = [
  {
    name: 'search_jobs',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để tìm việc làm.',
    max_calls_per_plan: 1
  },
  {
    name: 'count_jobs',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để đếm việc làm.',
    max_calls_per_plan: 1
  },
  {
    name: 'compare_jobs',
    access: 'read',
    description: 'Chỉ đọc dữ liệu công khai để so sánh các việc làm đã chọn.',
    max_calls_per_plan: 1
  },
  {
    name: 'get_job_detail',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để xem chi tiết việc làm.',
    max_calls_per_plan: 1
  },
  {
    name: 'get_job_details',
    access: 'read',
    description: 'Chỉ đọc dữ liệu công khai để xem chi tiết nhiều việc làm trong danh sách tìm kiếm gần nhất.',
    max_calls_per_plan: 1
  },
  {
    name: 'get_company_detail',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để xem thông tin doanh nghiệp.',
    max_calls_per_plan: 1
  },
  {
    name: 'get_selected_resume',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để xem CV đã chọn.',
    max_calls_per_plan: 1
  },
  {
    name: 'search_resume_chunks',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để tìm nội dung trong CV.',
    max_calls_per_plan: 1
  },
  {
    name: 'match_resume_to_jobs',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để đối chiếu CV với việc làm.',
    max_calls_per_plan: 1
  },
  {
    name: 'search_policy_documents',
    access: 'read',
    description: 'Chỉ đọc dữ liệu hệ thống để tìm tài liệu chính sách.',
    max_calls_per_plan: 1
  }
] as const satisfies readonly AgentToolDefinition[]

function validateAgentToolRegistry() {
  if (agentToolDefinitions.length !== AGENT_TOOL_NAMES.length) {
    throw new Error('Agent tool registry has omissions or duplicates.')
  }

  const registeredNames = new Set(agentToolDefinitions.map((definition) => definition.name))
  if (registeredNames.size !== agentToolDefinitions.length) {
    throw new Error('Agent tool registry has duplicate names.')
  }

  for (const toolName of AGENT_TOOL_NAMES) {
    if (!registeredNames.has(toolName)) {
      throw new Error(`Agent tool registry is missing ${toolName}.`)
    }
  }

  for (const definition of agentToolDefinitions) {
    if (definition.access !== 'read') {
      throw new Error(`Agent tool ${definition.name} must be read-only.`)
    }

    if (definition.max_calls_per_plan !== 1) {
      throw new Error(`Agent tool ${definition.name} must allow one call per plan.`)
    }
  }
}

validateAgentToolRegistry()

export function getAgentToolDefinition(name: AgentToolName): AgentToolDefinition {
  const definition = agentToolDefinitions.find((item) => item.name === name)
  if (!definition) {
    throw new Error(`Agent tool ${name} is not registered.`)
  }

  return definition
}

export function isRegisteredAgentTool(toolName: string): toolName is AgentToolName {
  return AGENT_TOOL_NAMES.some((name) => name === toolName)
}

export function getAvailableAgentToolDefinitions(config?: Pick<RagChatRuntimeConfig, 'allow_job_qa' | 'allow_cv_review' | 'allow_policy_qa'>) {
  if (!config) {
    return agentToolDefinitions
  }

  return agentToolDefinitions.filter((definition) => {
    if (definition.name === 'search_policy_documents') {
      return config.allow_policy_qa !== false
    }

    if (
      definition.name === 'get_selected_resume' ||
      definition.name === 'search_resume_chunks' ||
      definition.name === 'match_resume_to_jobs'
    ) {
      return config.allow_cv_review !== false
    }

    return config.allow_job_qa !== false
  })
}
