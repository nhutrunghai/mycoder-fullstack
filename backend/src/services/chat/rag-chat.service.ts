import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import logger from '~/configs/logger.config.js'
import { ChatIntent } from '~/constants/chat-intent'
import ErrorCode from '~/constants/error-code'
import UserMessages from '~/constants/messages/index'
import { AppError } from '~/errors/app-error'
import { ChatAnswerResult, RetrievedChatJob, RetrievedResumeChunk } from '~/services/chat/types/chat.type'
import llmService from '~/services/chat/ai/llm.service'
import resumeService from '~/services/client/resume.service'
import contextAssemblyService from './context/context-assembly.service'
import cvVisualReviewService from './review/cv-visual-review.service'
import intentRouterService from './intent/intent-router.service'
import resumeChatRetrievalService from './retrieval/resume-retrieval.service'
import { buildCvReviewAnswerPrompt } from './prompts/cv-review-answer.prompt'
import { buildCvJobMatchJsonAnswerPrompt } from './prompts/cv-job-match-answer.prompt'
import jobChatRetrievalService from './retrieval/job-retrieval.service'
import { buildJobChatAnswerPrompt, buildJobChatJsonAnswerPrompt } from './prompts/job-chat-answer.prompt'
import sessionService from './session.service'
import adminSystemSettingService, { RagChatRuntimeConfig } from '~/services/admin/system-setting.service'

type JobChatJsonAnswer = {
  answer: string
  selected_job_ids: string[]
}

type ChatParams = {
  message: string
  session_id?: string
  resume_id?: string
  user_id: string
}

class RagChatService {
  async chat({ message, session_id, resume_id, user_id }: ChatParams) {
    const normalizedMessage = message.trim()
    const config = await adminSystemSettingService.getRagChatConfig()

    if (!config.enabled) {
      return {
        session_id,
        intent: 'unsupported' as ChatIntent,
        answer: config.maintenance_message || 'Chatbot đang tạm bảo trì. Vui lòng thử lại sau.',
        sources: []
      }
    }

    let sessionObjectId: ObjectId | undefined
    let currentSessionId = session_id

    try {
      const session = await sessionService.loadOrCreateSession(session_id, user_id, normalizedMessage)
      sessionObjectId = session._id as ObjectId
      currentSessionId = sessionService.getSessionId(session)

      await sessionService.appendMessage(sessionObjectId, 'user', normalizedMessage)

      const intentResult = await intentRouterService.detectIntent(normalizedMessage, config)

      if (this.isIntentDisabled(intentResult.intent, config)) {
        const answer = this.buildFallbackAnswer(intentResult.intent)
        await sessionService.appendMessage(sessionObjectId, 'assistant', answer)
        await sessionService.saveState(sessionObjectId, {
          lastIntent: intentResult.intent,
          jobIds: []
        })

        return {
          session_id: currentSessionId,
          intent: intentResult.intent,
          answer,
          sources: []
        }
      }

      if (intentResult.intent === 'cv_review') {
        const response = await this.buildCvReviewAnswer({
          message: normalizedMessage,
          resumeId: resume_id,
          userId: user_id,
          config
        })

        await sessionService.appendMessage(sessionObjectId, 'assistant', response.answer, response.sources)
        await sessionService.saveState(sessionObjectId, {
          lastIntent: intentResult.intent,
          jobIds: []
        })

        return {
          session_id: currentSessionId,
          intent: intentResult.intent,
          answer: response.answer,
          sources: response.sources
        }
      }

      if (intentResult.intent === 'cv_job_match' || intentResult.intent === 'cv_match_previous_jobs') {
        const response = await this.buildCvJobMatchAnswer({
          intent: intentResult.intent,
          message: normalizedMessage,
          resumeId: resume_id,
          userId: user_id,
          lastJobIds: session.last_retrieved_job_ids || [],
          config
        })

        const jobIds = response.sources.filter((source) => source.type === 'job').map((source) => source.job_id)

        await sessionService.appendMessage(sessionObjectId, 'assistant', response.answer, response.sources)
        await sessionService.saveState(sessionObjectId, {
          lastIntent: intentResult.intent,
          jobIds
        })

        return {
          session_id: currentSessionId,
          intent: intentResult.intent,
          answer: response.answer,
          sources: response.sources
        }
      }

      const jobs = await this.retrieveJobsByIntent(
        intentResult.intent,
        normalizedMessage,
        session.last_retrieved_job_ids || [],
        config
      )
      const response = await this.buildAnswer(intentResult.intent, normalizedMessage, jobs, config)

      await sessionService.appendMessage(sessionObjectId, 'assistant', response.answer, response.sources)
      await sessionService.saveState(sessionObjectId, {
        lastIntent: intentResult.intent,
        jobIds: jobs.map((job) => job.job_id)
      })

      return {
        session_id: currentSessionId,
        intent: intentResult.intent,
        answer: response.answer,
        sources: response.sources
      }
    } catch (error) {
      logger.error({ err: error, user_id, message: normalizedMessage }, 'RAG Chat Service execution failed')

      const fallbackAnswer =
        config.maintenance_message ||
        'Trợ lý AI đang tạm thời gián đoạn kết nối hoặc đang được bảo trì. Vui lòng thử lại sau ít phút nhé!'

      if (sessionObjectId) {
        try {
          await sessionService.appendMessage(sessionObjectId, 'assistant', fallbackAnswer, [])
        } catch {
          // ignore session append failure
        }
      }

      return {
        session_id: currentSessionId,
        intent: 'general_chat' as ChatIntent,
        answer: fallbackAnswer,
        sources: []
      }
    }
  }

  private getRequestedJobLimit(message: string) {
    const normalized = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')

    const explicitMatch = normalized.match(/(?:cho\s*(?:toi|minh)\s*)?(\d{1,2})\s*(?:job|jobs|cong\s*viec|viec\s*lam)/i)
    const trailingMatch = normalized.match(
      /(?:job|jobs|cong\s*viec|viec\s*lam)\s*(?:backend|frontend|fullstack|java|python|node|react|tester|qa|devops)?\s*(\d{1,2})/i
    )
    const requested = Number(explicitMatch?.[1] || trailingMatch?.[1] || 0)

    if (!Number.isFinite(requested) || requested <= 0) {
      return null
    }

    return Math.min(Math.max(Math.floor(requested), 1), 20)
  }

  private getJobRetrievalLimit(message: string, defaultLimit: number) {
    return this.getRequestedJobLimit(message) || defaultLimit
  }

  private getAnswerContextLimit(message: string, jobsCount: number, config: RagChatRuntimeConfig) {
    const requestedLimit = this.getRequestedJobLimit(message)
    const configuredLimit = Math.max(config.answer_context_limit, 1)
    const limit = requestedLimit || configuredLimit

    return Math.min(limit, jobsCount, 20)
  }

  private async buildCvReviewAnswer({
    message,
    resumeId,
    userId,
    config
  }: {
    message: string
    resumeId?: string
    userId?: string
    config: RagChatRuntimeConfig
  }): Promise<ChatAnswerResult> {
    if (!userId) {
      throw new AppError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: UserMessages.ACCESS_TOKEN_NOT_FOUND,
        errorCode: ErrorCode.UNAUTHORIZED
      })
    }

    const resume = await resumeService.getResumeForChat(userId, resumeId)
    let chunks: RetrievedResumeChunk[] = []

    try {
      chunks = await resumeChatRetrievalService.retrieveForCvReview(message, resume, config.cv_review_top_k)
    } catch (error) {
      logger.error({ err: error, resume_id: resume._id ? String(resume._id) : null }, 'CV review text retrieval failed')
    }

    const visualReviewResult = await cvVisualReviewService.reviewResumePdf({
      message,
      resume
    })

    if (chunks.length === 0 && !visualReviewResult.summary) {
      const fallbackReasons: string[] = ['Tôi chưa lấy được text CV từ Elasticsearch']

      if (!resume.cv_url) {
        fallbackReasons.push('CV này không có `cv_url` để phân tích PDF')
      } else if (visualReviewResult.error) {
        fallbackReasons.push(`phân tích bố cục PDF chưa thực hiện được: ${visualReviewResult.error}`)
      }

      return {
        answer: `Hiện tôi chưa có đủ dữ liệu để đánh giá CV này. ${fallbackReasons.join(
          ', '
        )}. Hãy kiểm tra lại file CV hoặc chạy lại pipeline ingest để có cả text chunks và dữ liệu PDF hợp lệ.`,
        sources: [this.buildSingleResumeSource(resume)]
      }
    }

    const answer = await llmService.generateText({
      provider: config.provider,
      model: config.chat_model,
      prompt: buildCvReviewAnswerPrompt({
        message,
        chunks,
        visualReviewSummary: visualReviewResult.summary
      })
    })

    return {
      answer,
      sources: chunks.length > 0 ? this.buildResumeSources(chunks) : [this.buildSingleResumeSource(resume)]
    }
  }

  private buildResumeSources(chunks: RetrievedResumeChunk[]) {
    const sourcesMap = new Map<string, ChatAnswerResult['sources'][number]>()

    for (const chunk of chunks) {
      const key = `${chunk.resume_id}:${chunk.chunk_index}`
      if (!sourcesMap.has(key)) {
        sourcesMap.set(key, {
          type: 'resume',
          resume_id: chunk.resume_id,
          title: chunk.title,
          chunk_index: chunk.chunk_index
        })
      }
    }

    return Array.from(sourcesMap.values())
  }

  private buildSingleResumeSource(resume: Awaited<ReturnType<typeof resumeService.getResumeForChat>>) {
    return {
      type: 'resume' as const,
      resume_id: String(resume._id),
      title: resume.title,
      chunk_index: 0
    }
  }

  private async buildCvJobMatchAnswer({
    intent,
    message,
    resumeId,
    userId,
    lastJobIds,
    config
  }: {
    intent: Extract<ChatIntent, 'cv_job_match' | 'cv_match_previous_jobs'>
    message: string
    resumeId?: string
    userId?: string
    lastJobIds: string[]
    config: RagChatRuntimeConfig
  }): Promise<ChatAnswerResult> {
    if (!userId) {
      throw new AppError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: UserMessages.ACCESS_TOKEN_NOT_FOUND,
        errorCode: ErrorCode.UNAUTHORIZED
      })
    }

    const resume = await resumeService.getResumeForChat(userId, resumeId)
    let chunks: RetrievedResumeChunk[] = []

    try {
      chunks = await resumeChatRetrievalService.retrieveForCvReview(message, resume, config.cv_review_top_k)
    } catch (error) {
      logger.error(
        { err: error, resume_id: resume._id ? String(resume._id) : null },
        'CV job match resume retrieval failed'
      )
    }

    if (chunks.length === 0) {
      return {
        answer:
          'Hiện tôi chưa lấy được dữ liệu text từ CV này để so khớp với job. Bạn hãy kiểm tra CV đã được ingest embedding hoặc chọn một CV khác.',
        sources: [this.buildSingleResumeSource(resume)]
      }
    }

    const jobs =
      intent === 'cv_match_previous_jobs'
        ? await jobChatRetrievalService.retrieveForExplanation(
            message,
            lastJobIds,
            this.getJobRetrievalLimit(message, config.job_explanation_top_k)
          )
        : await jobChatRetrievalService.retrieveForJobSearch(
            this.buildResumeJobSearchQuery(chunks),
            this.getJobRetrievalLimit(message, config.job_search_top_k)
          )

    if (intent === 'cv_match_previous_jobs' && jobs.length === 0) {
      return {
        answer:
          'Tôi chưa thấy danh sách job nào trước đó trong cuộc trò chuyện này để so khớp với CV. Bạn hãy tìm job trước, ví dụ: "tìm job backend", rồi hỏi lại job nào phù hợp với CV.',
        sources: this.buildResumeSources(chunks)
      }
    }

    if (jobs.length === 0) {
      return {
        answer:
          'Hiện tôi chưa tìm thấy job phù hợp để so khớp với CV này. Bạn có thể thử nêu rõ vị trí mong muốn, level hoặc địa điểm.',
        sources: this.buildResumeSources(chunks)
      }
    }

    const contextJobs = jobs.slice(0, this.getAnswerContextLimit(message, jobs.length, config))

    try {
      const jsonAnswer = await llmService.generateJson<JobChatJsonAnswer>({
        provider: config.provider,
        model: config.chat_model,
        prompt: buildCvJobMatchJsonAnswerPrompt({
          message,
          chunks,
          jobs: contextJobs,
          matchMode: intent === 'cv_match_previous_jobs' ? 'previous_jobs' : 'search_all_jobs'
        }),
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            selected_job_ids: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['answer', 'selected_job_ids'],
          additionalProperties: false
        }
      })

      const selectedJobIds = new Set(
        jsonAnswer.selected_job_ids.filter((jobId) => contextJobs.some((job) => job.job_id === jobId))
      )
      const selectedJobs = contextJobs.filter((job) => selectedJobIds.has(job.job_id))
      const answerMatchedJobs = selectedJobs.length
        ? selectedJobs
        : this.matchJobsMentionedInAnswer(jsonAnswer.answer, contextJobs)

      return {
        answer: jsonAnswer.answer,
        sources: [
          ...contextAssemblyService.buildSources(answerMatchedJobs, answerMatchedJobs.length),
          ...this.buildResumeSources(chunks)
        ]
      }
    } catch (error) {
      logger.warn({ err: error }, 'CV job match structured answer failed; using fallback')
    }

    return {
      answer:
        'Tôi đã tìm được một số job có thể so khớp với CV, nhưng chưa tạo được phần giải thích chi tiết. Bạn có thể hỏi lại ngắn hơn hoặc thử chọn CV khác.',
      sources: [
        ...contextAssemblyService.buildSources(contextJobs, contextJobs.length),
        ...this.buildResumeSources(chunks)
      ]
    }
  }

  private buildResumeJobSearchQuery(chunks: RetrievedResumeChunk[]) {
    return chunks
      .map((chunk) => chunk.text)
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000)
  }

  private async retrieveJobsByIntent(
    intent: ChatIntent,
    message: string,
    lastJobIds: string[],
    config: RagChatRuntimeConfig
  ) {
    switch (intent) {
      case 'job_search':
        return jobChatRetrievalService.retrieveForJobSearch(
          message,
          this.getJobRetrievalLimit(message, config.job_search_top_k)
        )
      case 'job_explanation':
        return jobChatRetrievalService.retrieveForExplanation(
          message,
          lastJobIds,
          this.getJobRetrievalLimit(message, config.job_explanation_top_k)
        )
      default:
        return []
    }
  }

  private async buildAnswer(
    intent: ChatIntent,
    message: string,
    jobs: RetrievedChatJob[],
    config: RagChatRuntimeConfig
  ): Promise<ChatAnswerResult> {
    if (intent === 'policy_qa' || intent === 'unsupported') {
      return {
        answer: await this.buildFreeformAnswer(intent, message, config),
        sources: []
      }
    }

    if (jobs.length === 0) {
      return {
        answer:
          'Hiện tôi chưa tìm thấy job phù hợp với câu hỏi này. Bạn có thể thử nêu rõ hơn về kỹ năng, level hoặc địa điểm.',
        sources: []
      }
    }

    const contextJobs = jobs.slice(0, this.getAnswerContextLimit(message, jobs.length, config))

    try {
      const jsonAnswer = await llmService.generateJson<JobChatJsonAnswer>({
        provider: config.provider,
        model: config.chat_model,
        prompt: buildJobChatJsonAnswerPrompt({
          message,
          jobs: contextJobs
        }),
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            selected_job_ids: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['answer', 'selected_job_ids'],
          additionalProperties: false
        }
      })

      const selectedJobIds = new Set(
        jsonAnswer.selected_job_ids.filter((jobId) => contextJobs.some((job) => job.job_id === jobId))
      )
      const selectedJobs = contextJobs.filter((job) => selectedJobIds.has(job.job_id))
      const answerMatchedJobs = selectedJobs.length
        ? selectedJobs
        : this.matchJobsMentionedInAnswer(jsonAnswer.answer, contextJobs)
      const sourceJobs = intent === 'job_search' ? contextJobs : answerMatchedJobs

      return {
        answer: jsonAnswer.answer,
        sources: contextAssemblyService.buildSources(sourceJobs, sourceJobs.length)
      }
    } catch (error) {
      logger.warn({ err: error }, 'Job chat structured answer failed; using fallback')
    }

    const answer = await llmService.generateText({
      provider: config.provider,
      model: config.chat_model,
      prompt: buildJobChatAnswerPrompt({
        message,
        jobs: contextJobs
      })
    })

    const answerMatchedJobs = this.matchJobsMentionedInAnswer(answer, contextJobs)
    const sourceJobs = intent === 'job_search' ? contextJobs : answerMatchedJobs

    return {
      answer,
      sources: contextAssemblyService.buildSources(sourceJobs, sourceJobs.length)
    }
  }

  private matchJobsMentionedInAnswer(answer: string, jobs: RetrievedChatJob[]) {
    const normalizedAnswer = answer.toLowerCase()
    return jobs.filter(
      (job) => normalizedAnswer.includes(job.job_id.toLowerCase()) || normalizedAnswer.includes(job.title.toLowerCase())
    )
  }

  private isIntentDisabled(intent: ChatIntent, config: RagChatRuntimeConfig) {
    if (intent === 'cv_review') return !config.allow_cv_review
    if (
      intent === 'job_search' ||
      intent === 'job_explanation' ||
      intent === 'cv_job_match' ||
      intent === 'cv_match_previous_jobs'
    )
      return !config.allow_job_qa
    if (intent === 'policy_qa') return !config.allow_policy_qa
    if (intent === 'unsupported') return !config.allow_general_qa
    return false
  }

  private async buildFreeformAnswer(intent: ChatIntent, message: string, config: RagChatRuntimeConfig) {
    const scope = intent === 'policy_qa' ? 'câu hỏi chính sách/quy định' : 'câu hỏi ngoài phạm vi tuyển dụng'

    try {
      return await llmService.generateText({
        provider: config.provider,
        model: config.chat_model,
        prompt: `Bạn là trợ lý JobGo. Hãy trả lời ngắn gọn, rõ ràng bằng tiếng Việt cho ${scope}. Nếu không chắc chắn, hãy nói rõ giới hạn thông tin.

Câu hỏi của user:
${message}`
      })
    } catch (error) {
      logger.warn({ err: error, intent }, 'Freeform chat answer failed')
      return this.buildFallbackAnswer(intent)
    }
  }

  private buildFallbackAnswer(intent: ChatIntent) {
    switch (intent) {
      case 'cv_review':
        return 'Tính năng đánh giá CV sẽ được hỗ trợ ở bước sau. Hiện tại chatbot này đang hỗ trợ tư vấn job trên JobGo. Bạn có thể hỏi về tìm job, độ phù hợp hoặc so sánh các job.'
      case 'policy_qa':
        return 'Tính năng hỏi đáp về luật, quy định và tài liệu kiến thức sẽ được hỗ trợ sau khi dữ liệu được tải lên hệ thống. Hiện tại chatbot này đang hỗ trợ tư vấn job trên JobGo. Bạn có thể hỏi về tìm job, độ phù hợp hoặc so sánh các job.'
      case 'unsupported':
      default:
        return 'Hiện tại chatbot này đang hỗ trợ tư vấn job trên JobGo. Bạn có thể hỏi về tìm job, độ phù hợp hoặc so sánh các job.'
    }
  }
}

const ragChatService = new RagChatService()
export default ragChatService
