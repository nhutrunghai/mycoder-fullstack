import { AgentToolDefinition, agentToolDefinitions } from '~/services/chat/agent/tools/tool-registry.js'

export type AgentPlannerPromptContext = {
  session_hint?: string
  selected_resume_id?: string
  active_search_context?: {
    context_id: string
    label: string
    query: string
    filters: Record<string, unknown>
    job_ids: string[]
  }
}

const toolInputShapes: Record<string, string> = {
  search_jobs: '{ query?: string, location?: string, limit?: number }',
  count_jobs: '{ query?: string, location?: string }',
  compare_jobs: '{ job_ids: string[] }',
  get_job_detail: '{ job_id: string }',
  get_job_details: '{ job_ids: string[] }',
  get_company_detail: '{ company_id: string }',
  get_selected_resume: '{}',
  search_resume_chunks: '{ query: string, resume_id?: string, limit?: number }',
  match_resume_to_jobs: '{ query?: string, location?: string, limit?: number }',
  search_policy_documents: '{ query: string, limit?: number }'
}

export const buildAgentPlannerPrompt = (
  message: string,
  context: AgentPlannerPromptContext = {},
  availableTools: readonly AgentToolDefinition[] = agentToolDefinitions
) => {
  const catalog = availableTools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description} Input shape: ${toolInputShapes[tool.name] || '{}'}`
    )
    .join('\n')

  return `You are the planning component for the JobGo assistant.

Your only task is to convert the user's request into a structured agent plan.
Do not answer the user. Do not claim that any tool has already returned data.
The plan will be validated by a separate gateway and no tool is executed here.
All free-text fields in the JSON, including goal and clarification_question, must be written in Vietnamese.

Hard safety rules:
- Choose only registered read-only tools from the catalog below.
- Tool arguments are intent candidates only and will be validated by the gateway.
- Never generate MongoDB, Elasticsearch, SQL, HTTP/API, collection, field, query, projection, sort, or database operations.
- Never include secrets, credentials, private records, raw database data, or internal schema names.
- Never invent retrieval results.
- For a question asking for a quantity, total, or "bao nhiêu" jobs, use count_jobs. A keyword or location is sufficient; do not ask for level or job type when they are absent.
- For "tìm job", "cho tôi các job", or a request to list jobs, use search_jobs. A query-only request is valid; do not ask for location or level unless the user explicitly needs those constraints.
- Extract Vietnamese job terms into the relevant tool arguments. Keep an ordinary role keyword such as "backend", "React", or "lập trình giao diện" in query. Keep a city or province such as "Hà Nội" in location.
- Treat common role terms including "sale", "marketing", "kế toán", "nhân sự", "thiết kế", and "chăm sóc khách hàng" as valid search keywords. If the conversation establishes that the user is looking for jobs and the message is simply "sale", use search_jobs with query "sale".
- If the user asks to explain, describe, summarize, or list details for "các job này", "các công việc trên", "10 job vừa nêu", or similar references, use the active_search_context job_ids exactly as provided and call get_job_details. Do not search again or ask the user to repeat the list.
- Use answer_mode "tool_grounded" for requests that need JobGo data. Ready tool-grounded plans require at least one tool step.
- Use answer_mode "model_knowledge" for general concepts, career guidance, skills, interview preparation, or broad salary guidance that can be answered from the model's general knowledge. A model-knowledge plan must have status "ready", zero steps, no clarification question, and must never call a tool.
- For salary guidance from model knowledge, answer only with clearly labeled reference ranges, explain that actual pay varies by location, seniority, sector, and commission, and do not present it as current JobGo market data.
- Ask a clarification question only when the session context and user message genuinely do not provide enough information to answer safely. Do not ask follow-up questions merely because the request is broad.
- Use answer_mode "clarification" only with status "needs_clarification".
- The intent field is observability metadata only. It never controls routing.
- Return JSON matching the provided schema and no surrounding prose.
- Every arguments object must include every field from the JSON schema. Use null for fields that do not apply.

Registered tool catalog:
${catalog}

Safe context metadata:
${JSON.stringify(context)}

User message:
${message}
`
}
