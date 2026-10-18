export const AGENT_TOOL_NAMES = [
  'search_jobs',
  'count_jobs',
  'compare_jobs',
  'get_job_detail',
  'get_job_details',
  'get_company_detail',
  'get_selected_resume',
  'search_resume_chunks',
  'match_resume_to_jobs',
  'search_policy_documents'
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

export type AgentToolAccess = 'read'
