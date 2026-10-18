import { z } from 'zod'
import env from '~/configs/env.config.js'
import { RagChatRuntimeConfig } from '~/services/admin/system-setting.service.js'
import llmService from '~/services/chat/ai/llm.service.js'
import { AgentToolExecutorResult } from '~/services/chat/agent/agent-tool-executor.service.js'
import { AgentPlan } from '~/services/chat/agent/schemas/agent-plan.schema.js'
import {
  AgentAnswerPromptSource,
  AgentAnswerPromptStep,
  buildAgentAnswerSynthesizerPrompt,
  buildModelKnowledgeAnswerPrompt
} from '~/services/chat/prompts/agent-answer-synthesizer.prompt.js'

const DEFAULT_CONTEXT_CHARACTERS = 12_000
const MAX_CONTEXT_CHARACTERS = 24_000

const answerSchema = z
  .object({
    answer: z.string().trim().min(1).max(4_000),
    source_ids: z.array(z.string().trim().min(1)).max(40)
  })
  .strict()

export const agentAnswerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: {
      type: 'string',
      minLength: 1,
      maxLength: 4_000
    },
    source_ids: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'string',
        minLength: 1
      }
    }
  },
  required: ['answer', 'source_ids']
} as const

export type AgentAnswerSource = AgentAnswerPromptSource

export type AgentAnswerSynthesizerResult = {
  answer: string
  sources: AgentAnswerSource[]
}

export type AgentAnswerSynthesizerConfig = Pick<RagChatRuntimeConfig, 'provider' | 'chat_model' | 'answer_context_limit'>

type LlmGenerator = Pick<typeof llmService, 'generateJson' | 'generateText'>

function toSafeSource(source: unknown): AgentAnswerSource | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null
  }

  const candidate = source as Record<string, unknown>
  const type = typeof candidate.type === 'string' ? candidate.type.trim() : ''
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : undefined

  if (!type || !id) {
    return null
  }

  return {
    source_id: `${type}:${id}`,
    type,
    id,
    ...(title ? { title } : {})
  }
}

function deduplicateSources(sources: unknown[]): AgentAnswerSource[] {
  const sourceMap = new Map<string, AgentAnswerSource>()

  for (const source of sources) {
    const safeSource = toSafeSource(source)
    if (safeSource && !sourceMap.has(safeSource.source_id)) {
      sourceMap.set(safeSource.source_id, safeSource)
    }
  }

  return [...sourceMap.values()]
}

function getContextCharacterLimit(config?: AgentAnswerSynthesizerConfig) {
  const configuredLimit = config?.answer_context_limit
  if (!Number.isFinite(configuredLimit) || !configuredLimit || configuredLimit <= 0) {
    return DEFAULT_CONTEXT_CHARACTERS
  }

  return Math.min(Math.floor(configuredLimit * 4_000), MAX_CONTEXT_CHARACTERS)
}

function getCompletedToolData(steps: AgentAnswerPromptStep[], toolName: string) {
  return steps.find((step) => step.tool === toolName)?.data
}

type JobDetail = {
  job_id: string
  title: string
  description?: string
  requirements?: string
  benefits?: string
  salary?: unknown
  location?: string
  job_type?: string
  level?: string
  skills?: string[]
  company?: {
    company_name?: string
    address?: string
    website?: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function compactText(value: unknown, limit: number) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(limit - 3, 1)).trim()}...`
}

function toJobDetail(value: unknown): JobDetail | null {
  if (!isRecord(value) || typeof value.job_id !== 'string' || typeof value.title !== 'string') {
    return null
  }

  const company = isRecord(value.company)
    ? {
        company_name: typeof value.company.company_name === 'string' ? value.company.company_name : undefined,
        address: typeof value.company.address === 'string' ? value.company.address : undefined,
        website: typeof value.company.website === 'string' ? value.company.website : undefined
      }
    : undefined

  return {
    job_id: value.job_id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : undefined,
    requirements: typeof value.requirements === 'string' ? value.requirements : undefined,
    benefits: typeof value.benefits === 'string' ? value.benefits : undefined,
    salary: value.salary,
    location: typeof value.location === 'string' ? value.location : undefined,
    job_type: typeof value.job_type === 'string' ? value.job_type : undefined,
    level: typeof value.level === 'string' ? value.level : undefined,
    skills: Array.isArray(value.skills) ? value.skills.filter((item): item is string => typeof item === 'string') : [],
    company
  }
}

function getDetailedJobs(steps: AgentAnswerPromptStep[]): { tool: string; jobs: JobDetail[] } | null {
  for (const step of steps) {
    if (step.tool === 'get_job_detail') {
      const detail = toJobDetail(step.data)
      if (detail) {
        return { tool: step.tool, jobs: [detail] }
      }
    }

    if (step.tool === 'get_job_details' || step.tool === 'compare_jobs') {
      const data = isRecord(step.data) && Array.isArray(step.data.items) ? step.data.items : []
      const jobs = data.map(toJobDetail).filter((job): job is JobDetail => Boolean(job))
      if (jobs.length > 0) {
        return { tool: step.tool, jobs }
      }
    }
  }

  return null
}

function formatSalary(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (!isRecord(value)) {
    return ''
  }

  if (value.is_negotiable === true) {
    return 'Th\u1ecfa thu\u1eadn'
  }

  const min = typeof value.min === 'number' ? value.min.toLocaleString('vi-VN') : ''
  const max = typeof value.max === 'number' ? value.max.toLocaleString('vi-VN') : ''
  const currency = typeof value.currency === 'string' ? value.currency : 'VND'

  if (min && max) {
    return `${min} - ${max} ${currency}`
  }

  return min ? `T\u1eeb ${min} ${currency}` : max ? `\u0110\u1ebfn ${max} ${currency}` : ''
}

function formatJobSummary(job: JobDetail, index: number, detailed: boolean) {
  const metadata = [
    job.company?.company_name ? `C\u00f4ng ty: ${job.company.company_name}` : '',
    job.location ? `\u0110\u1ecba \u0111i\u1ec3m: ${job.location}` : '',
    job.level ? `C\u1ea5p \u0111\u1ed9: ${job.level}` : '',
    job.job_type ? `Lo\u1ea1i h\u00ecnh: ${job.job_type}` : '',
    formatSalary(job.salary) ? `L\u01b0\u01a1ng: ${formatSalary(job.salary)}` : '',
    job.skills?.length ? `K\u1ef9 n\u0103ng: ${job.skills.join(', ')}` : ''
  ].filter(Boolean)

  const sections = [`${index}. **${job.title}**`, ...metadata.map((item) => `- ${item}`)]
  if (detailed) {
    const description = compactText(job.description, 260)
    const requirements = compactText(job.requirements, 240)
    const benefits = compactText(job.benefits, 180)
    if (description) sections.push(`- M\u00f4 t\u1ea3: ${description}`)
    if (requirements) sections.push(`- Y\u00eau c\u1ea7u: ${requirements}`)
    if (benefits) sections.push(`- Quy\u1ec1n l\u1ee3i: ${benefits}`)
  }

  return sections.join('\n')
}

function jobLevelRank(level: string | undefined) {
  const ranks: Record<string, number> = {
    intern: 1,
    fresher: 2,
    junior: 3,
    middle: 4,
    senior: 5,
    lead: 6,
    manager: 7
  }

  return ranks[(level || '').toLowerCase()] || Number.MAX_SAFE_INTEGER
}

const BEGINNER_MAX_JOB_LEVEL_RANK = 3

function isBeginnerQuestion(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')

  return /(nguoi moi|moi bat dau|fresher|junior|intern)/.test(normalized)
}

function buildGroundedJobAnswer(message: string, steps: AgentAnswerPromptStep[]) {
  const detailedJobs = getDetailedJobs(steps)
  if (!detailedJobs) {
    return null
  }

  const isComparison = detailedJobs.tool === 'compare_jobs'
  const detailed = !isComparison
  const heading = isComparison
    ? 'So s\u00e1nh d\u1ef1a tr\u00ean d\u1eef li\u1ec7u c\u1ee7a c\u00e1c job \u0111\u00e3 ch\u1ecdn:'
    : detailedJobs.jobs.length === 1
      ? 'Th\u00f4ng tin chi ti\u1ebft c\u1ee7a job:'
      : `Th\u00f4ng tin chi ti\u1ebft c\u1ee7a ${detailedJobs.jobs.length} job trong danh s\u00e1ch:`
  const sections: string[] = []

  if (isBeginnerQuestion(message) && detailedJobs.jobs.length > 1) {
    const sorted = [...detailedJobs.jobs].sort((left, right) => jobLevelRank(left.level) - jobLevelRank(right.level))
    const best = sorted[0]
    const next = sorted[1]

    if (best && jobLevelRank(best.level) !== Number.MAX_SAFE_INTEGER) {
      const comparison =
        jobLevelRank(best.level) <= BEGINNER_MAX_JOB_LEVEL_RANK
          ? next && jobLevelRank(next.level) !== jobLevelRank(best.level)
            ? `D\u1ef1a tr\u00ean c\u1ea5p \u0111\u1ed9 c\u00f4ng vi\u1ec7c, **${best.title}** ph\u00f9 h\u1ee3p h\u01a1n cho ng\u01b0\u1eddi m\u1edbi b\u1eaft \u0111\u1ea7u v\u00ec \u0111\u01b0\u1ee3c g\u1eafn level \`${best.level}\`, th\u1ea5p h\u01a1n \`${next.level}\` c\u1ee7a ${next.title}.`
            : `C\u00e1c job c\u00f3 c\u1ea5p \u0111\u1ed9 t\u01b0\u01a1ng \u0111\u01b0\u01a1ng. B\u1ea1n n\u00ean \u01b0u ti\u00ean \u0111\u1ecdc y\u00eau c\u1ea7u k\u1ef9 n\u0103ng \u0111\u1ec3 ch\u1ecdn job ph\u00f9 h\u1ee3p h\u01a1n.`
          : `Hai job n\u00e0y \u0111\u1ec1u kh\u00f4ng ph\u00f9 h\u1ee3p v\u1edbi ng\u01b0\u1eddi m\u1edbi b\u1eaft \u0111\u1ea7u v\u00ec c\u1ea5p \u0111\u1ed9 th\u1ea5p nh\u1ea5t l\u00e0 \`${best.level}\`. Trong hai l\u1ef1a ch\u1ecdn, **${best.title}** \u00edt senior h\u01a1n nh\u01b0ng b\u1ea1n v\u1eabn n\u00ean t\u00ecm job Intern, Fresher ho\u1eb7c Junior.`
      sections.push(comparison)
    }
  }

  sections.push(heading)
  sections.push(...detailedJobs.jobs.map((job, index) => formatJobSummary(job, index + 1, detailed)))

  return sections.join('\n\n').slice(0, 6_000)
}

function buildDeterministicToolAnswer(message: string, steps: AgentAnswerPromptStep[]) {
  const countData = getCompletedToolData(steps, 'count_jobs')
  if (countData && typeof countData === 'object' && !Array.isArray(countData)) {
    const total = (countData as { total?: unknown }).total
    if (typeof total === 'number' && Number.isFinite(total)) {
      return `Hiện có ${total} công việc phù hợp với yêu cầu của bạn.`
    }
  }

  const searchData = getCompletedToolData(steps, 'search_jobs')
  if (searchData && typeof searchData === 'object' && !Array.isArray(searchData)) {
    const total = (searchData as { total?: unknown }).total
    if (total === 0) {
      return 'Hiện chưa tìm thấy công việc phù hợp với yêu cầu của bạn.'
    }
  }

  const policyData = getCompletedToolData(steps, 'search_policy_documents')
  if (isRecord(policyData) && Array.isArray(policyData.items) && policyData.items.length === 0) {
    return 'Hi\u1ec7n ch\u01b0a c\u00f3 t\u00e0i li\u1ec7u ch\u00ednh s\u00e1ch ph\u00f9 h\u1ee3p \u0111\u01b0\u1ee3c n\u1ea1p v\u00e0o h\u1ec7 th\u1ed1ng \u0111\u1ec3 tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi n\u00e0y.'
  }

  const resumeData = getCompletedToolData(steps, 'search_resume_chunks')
  if (isRecord(resumeData) && (resumeData.status === 'not_ready' || resumeData.status === 'failed')) {
    return typeof resumeData.message === 'string'
      ? resumeData.message
      : 'CV ch\u01b0a s\u1eb5n s\u00e0ng \u0111\u1ec3 ph\u00e2n t\u00edch. Vui l\u00f2ng ki\u1ec3m tra tr\u1ea1ng th\u00e1i x\u1eed l\u00fd CV.'
  }

  const matchData = getCompletedToolData(steps, 'match_resume_to_jobs')
  if (isRecord(matchData) && Array.isArray(matchData.jobs) && matchData.jobs.length === 0) {
    return 'T\u00f4i ch\u01b0a t\u00ecm th\u1ea5y job ph\u00f9 h\u1ee3p d\u1ef1a tr\u00ean CV \u0111\u00e3 ch\u1ecdn. B\u1ea1n c\u00f3 th\u1ec3 b\u1ed5 sung v\u1ecb tr\u00ed, \u0111\u1ecba \u0111i\u1ec3m ho\u1eb7c c\u1ea5p \u0111\u1ed9 mong mu\u1ed1n.'
  }

  return null
}

export class AgentAnswerSynthesizerService {
  constructor(private readonly llm: LlmGenerator = llmService) {}

  async synthesize(
    message: string,
    plan: AgentPlan,
    executorResult: AgentToolExecutorResult,
    config?: AgentAnswerSynthesizerConfig,
    conversationContext?: string
  ): Promise<AgentAnswerSynthesizerResult> {
    if (plan.status === 'needs_clarification') {
      return {
        answer: plan.clarification_question || 'Bạn có thể cung cấp thêm thông tin để tôi hỗ trợ chính xác hơn không?',
        sources: []
      }
    }

    if (plan.status === 'ready' && plan.answer_mode === 'model_knowledge') {
      try {
        const answer = (await this.llm.generateText({
          provider: config?.provider || env.LLM_PROVIDER,
          model: config?.chat_model || env.LLM_MODEL_CHAT,
          prompt: buildModelKnowledgeAnswerPrompt({
            message,
            conversation_context: conversationContext
          })
        }))
          .trim()
          .slice(0, 4_000)

        if (!answer) {
          throw new Error('The model returned an empty answer.')
        }

        return { answer, sources: [] }
      } catch {
        return {
          answer: 'Tôi chưa thể trả lời đầy đủ yêu cầu này ở thời điểm hiện tại. Vui lòng thử diễn đạt lại câu hỏi.',
          sources: []
        }
      }
    }

    const successfulSteps = this.collectSuccessfulSteps(executorResult)
    const sources = deduplicateSources(successfulSteps.flatMap((step) => step.sources))

    if (
      plan.status !== 'ready' ||
      executorResult.status === 'not_executable' ||
      executorResult.status === 'failed' ||
      successfulSteps.length === 0
    ) {
      return {
        answer: 'Hiện tôi chưa có đủ dữ liệu đáng tin cậy để trả lời yêu cầu này. Vui lòng thử lại hoặc cung cấp thêm thông tin.',
        sources: []
      }
    }

    const deterministicAnswer = buildDeterministicToolAnswer(message, successfulSteps)
    if (deterministicAnswer) {
      return {
        answer: deterministicAnswer,
        sources
      }
    }

    const groundedJobAnswer = buildGroundedJobAnswer(message, successfulSteps)
    if (groundedJobAnswer) {
      return {
        answer: groundedJobAnswer,
        sources
      }
    }

    try {
      const raw = await this.llm.generateJson<unknown>({
        provider: config?.provider || env.LLM_PROVIDER,
        model: config?.chat_model || env.LLM_MODEL_CHAT,
        prompt: buildAgentAnswerSynthesizerPrompt({
          message: message.trim(),
          steps: successfulSteps,
          sources,
          max_context_characters: getContextCharacterLimit(config)
        }),
        schema: agentAnswerJsonSchema
      })
      const answer = answerSchema.parse(raw)

      return {
        answer: answer.answer,
        sources: this.selectSources(answer.source_ids, sources)
      }
    } catch {
      return {
        answer: 'Tôi chưa thể tổng hợp câu trả lời đáng tin cậy từ dữ liệu hiện có. Vui lòng thử lại hoặc cung cấp thêm thông tin.',
        sources
      }
    }
  }

  private collectSuccessfulSteps(executorResult: AgentToolExecutorResult): AgentAnswerPromptStep[] {
    return executorResult.steps
      .filter((step) => step.status === 'completed' && step.data !== undefined && step.data !== null)
      .map((step) => ({
        step_id: step.step_id,
        tool: step.tool,
        data: step.data,
        sources: deduplicateSources(step.sources || [])
      }))
  }

  private selectSources(sourceIds: string[], availableSources: AgentAnswerSource[]) {
    const availableById = new Map(availableSources.map((source) => [source.source_id, source]))
    const selected = new Map<string, AgentAnswerSource>()

    for (const sourceId of sourceIds) {
      const source = availableById.get(sourceId)
      if (source && !selected.has(source.source_id)) {
        selected.set(source.source_id, source)
      }
    }

    return selected.size > 0 ? [...selected.values()] : availableSources
  }
}

const agentAnswerSynthesizerService = new AgentAnswerSynthesizerService()
export default agentAnswerSynthesizerService
