import { randomUUID } from 'node:crypto'
import logger from '~/configs/logger.config.js'
import { ChatIntent } from '~/constants/chat-intent.js'
import { RagChatRuntimeConfig } from '~/services/admin/system-setting.service.js'
import agentAnswerSynthesizerService, {
  AgentAnswerSource,
  AgentAnswerSynthesizerService
} from '~/services/chat/agent/agent-answer-synthesizer.service.js'
import agentAuditService, { AgentAuditService } from '~/services/chat/agent/agent-audit.service.js'
import agentClarificationService, { AgentClarificationService } from '~/services/chat/agent/agent-clarification.service.js'
import agentPlannerService, { AgentPlannerService } from '~/services/chat/agent/agent-planner.service.js'
import agentToolExecutorService, {
  AgentToolExecutorResult,
  AgentToolExecutorService
} from '~/services/chat/agent/agent-tool-executor.service.js'
import { AgentPlan } from '~/services/chat/agent/schemas/agent-plan.schema.js'
import { parseAgentToolArguments } from '~/services/chat/agent/tools/tool-arguments.schema.js'
import searchContextService from '~/services/chat/context/search-context.service.js'
import { ChatSource, ChatSessionDocument, SearchContext } from '~/services/chat/types/chat.type.js'

type AgentChatInput = {
  message: string
  user_id: string
  session: ChatSessionDocument
  resume_id?: string
  config: RagChatRuntimeConfig
}

export type AgentChatResult = {
  intent: ChatIntent
  answer: string
  sources: ChatSource[]
  search_contexts?: SearchContext[]
}

type AgentChatDependencies = {
  planner?: Pick<AgentPlannerService, 'createPlan'>
  clarification?: Pick<AgentClarificationService, 'resolve'>
  executor?: Pick<AgentToolExecutorService, 'executePlan'>
  synthesizer?: Pick<AgentAnswerSynthesizerService, 'synthesize'>
  audit?: Pick<AgentAuditService, 'create'>
}

function toChatIntent(plan: AgentPlan): ChatIntent {
  switch (plan.intent) {
    case 'job_details':
    case 'job_comparison':
      return 'job_explanation'
    case 'resume':
      return 'cv_review'
    case 'policy':
      return 'policy_qa'
    case 'job_search':
      return 'job_search'
    case 'general':
      return 'general_chat'
    default:
      return 'unsupported'
  }
}

function toChatSources(sources: AgentAnswerSource[]): ChatSource[] {
  const normalized = new Map<string, ChatSource>()

  for (const source of sources) {
    if (source.type === 'job') {
      normalized.set(source.source_id, {
        type: 'job',
        job_id: source.id,
        title: source.title || 'Tin tuy\u1ec3n d\u1ee5ng',
        company: ''
      })
    }

    if (source.type === 'resume') {
      normalized.set(source.source_id, {
        type: 'resume',
        resume_id: source.id,
        title: source.title || 'CV \u0111\u00e3 ch\u1ecdn',
        chunk_index: 0
      })
    }
  }

  return [...normalized.values()]
}

function buildSessionHint(session: ChatSessionDocument) {
  return session.turns
    .slice(-6)
    .map((turn) => `${turn.role}: ${turn.content.replace(/\s+/g, ' ').trim().slice(0, 160)}`)
    .join('\n')
    .slice(0, 500)
}

function getActiveSearchContext(session: ChatSessionDocument) {
  const activeContext = searchContextService.list(session.search_contexts, 'active')[0]
  if (!activeContext || activeContext.job_ids.length === 0) {
    return undefined
  }

  return {
    context_id: activeContext.context_id,
    label: activeContext.label,
    query: activeContext.query,
    filters: activeContext.filters,
    job_ids: activeContext.job_ids.slice(0, 10)
  }
}

function notExecutable(plan: AgentPlan): AgentToolExecutorResult {
  return {
    status: 'not_executable',
    plan_status: plan.status,
    steps: []
  }
}

function toSearchContexts(plan: AgentPlan, execution: AgentToolExecutorResult, session: ChatSessionDocument): SearchContext[] | undefined {
  const searchStep = plan.steps.find((step) => step.tool === 'search_jobs')
  const completedStep = execution.steps.find(
    (step) => step.status === 'completed' && step.tool === 'search_jobs' && step.data && typeof step.data === 'object'
  )

  if (!searchStep || !completedStep) {
    return undefined
  }

  const parsed = parseAgentToolArguments('search_jobs', searchStep.arguments)
  const data = completedStep.data as { items?: Array<{ job_id?: unknown }> }
  const jobIds = (data.items || [])
    .map((item) => (typeof item.job_id === 'string' ? item.job_id : ''))
    .filter(Boolean)

  const query = (parsed.query || plan.goal).slice(0, 200)
  const { query: _query, limit: _limit, ...filters } = parsed
  return searchContextService.create(session.search_contexts, {
    label: `T\u00ecm vi\u1ec7c: ${query}`.slice(0, 80),
    query,
    filters,
    job_ids: jobIds
  }).contexts
}

export class AgentChatOrchestratorService {
  private readonly planner: Pick<AgentPlannerService, 'createPlan'>
  private readonly clarification: Pick<AgentClarificationService, 'resolve'>
  private readonly executor: Pick<AgentToolExecutorService, 'executePlan'>
  private readonly synthesizer: Pick<AgentAnswerSynthesizerService, 'synthesize'>
  private readonly audit: Pick<AgentAuditService, 'create'>

  constructor(dependencies: AgentChatDependencies = {}) {
    this.planner = dependencies.planner ?? agentPlannerService
    this.clarification = dependencies.clarification ?? agentClarificationService
    this.executor = dependencies.executor ?? agentToolExecutorService
    this.synthesizer = dependencies.synthesizer ?? agentAnswerSynthesizerService
    this.audit = dependencies.audit ?? agentAuditService
  }

  async respond(input: AgentChatInput): Promise<AgentChatResult> {
    const startedAt = Date.now()
    const correlationId = randomUUID()
    const plan = await this.planner.createPlan(
      input.message,
      {
        session_hint: buildSessionHint(input.session),
        selected_resume_id: input.resume_id,
        active_search_context: getActiveSearchContext(input.session)
      },
      input.config
    )
    const clarification = this.clarification.resolve(plan)
    const execution =
      clarification.status === 'ready'
        ? await this.executor.executePlan(plan, { user_id: input.user_id })
        : notExecutable(plan)
    const result = await this.synthesizer.synthesize(input.message, plan, execution, input.config, buildSessionHint(input.session))
    const searchContexts = toSearchContexts(plan, execution, input.session)

    await this.writeAudit({
      user_id: input.user_id,
      session_id: String(input.session._id),
      correlation_id: correlationId,
      plan,
      execution,
      total_duration_ms: Date.now() - startedAt
    })

    return {
      intent: toChatIntent(plan),
      answer: result.answer,
      sources: toChatSources(result.sources),
      ...(searchContexts ? { search_contexts: searchContexts } : {})
    }
  }

  private async writeAudit(input: Parameters<AgentAuditService['create']>[0]) {
    try {
      await this.audit.create(input)
    } catch (error) {
      logger.warn({ err: error, correlation_id: input.correlation_id }, 'Agent execution audit write failed')
    }
  }
}

const agentChatOrchestratorService = new AgentChatOrchestratorService()
export default agentChatOrchestratorService
