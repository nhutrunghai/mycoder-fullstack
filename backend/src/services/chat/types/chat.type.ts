import { ObjectId } from 'mongodb'
import { ChatIntent } from '~/constants/chat-intent'
import { JobLevel, JobType, ResumeStatus } from '~/constants/enums'

export type JobChatSource = {
  type: 'job'
  job_id: string
  title: string
  company: string
}

export type ResumeChatSource = {
  type: 'resume'
  resume_id: string
  title: string
  chunk_index: number
}

export type ChatSource = JobChatSource | ResumeChatSource

export type ChatIntentResult = {
  intent: ChatIntent
  confidence: number
}

export type ChatAnswerResult = {
  answer: string
  sources: ChatSource[]
}

export type ChatSessionTurnRole = 'user' | 'assistant'

export type ChatSessionTurn = {
  role: ChatSessionTurnRole
  content: string
  created_at: Date
  sources?: ChatSource[]
}

export type SearchContextStatus = 'active' | 'superseded' | 'expired'

export type SearchContextFilters = {
  location?: string
  job_type?: JobType
  level?: JobLevel
  category_id?: string
}

export type SearchContext = {
  context_id: string
  label: string
  query: string
  filters: SearchContextFilters
  job_ids: string[]
  created_at: Date
  updated_at: Date
  status: SearchContextStatus
}

export type ChatSessionDocument = {
  _id?: ObjectId
  user_id?: ObjectId
  title?: string
  turns: ChatSessionTurn[]
  last_intent?: ChatIntent
  last_retrieved_job_ids: string[]
  search_contexts?: SearchContext[]
  created_at: Date
  updated_at: Date
}

export type ChatSessionSummary = {
  session_id: string
  title: string
  last_message: string
  last_intent?: ChatIntent
  created_at: Date
  updated_at: Date
}

export type ChatSessionDetail = ChatSessionSummary & {
  turns: ChatSessionTurn[]
}

export type RetrievedChatJob = {
  job_id: string
  title: string
  company: string
  location: string
  level: string
  job_type: string
  salary?: {
    min?: number
    max?: number
    currency: string
    is_negotiable?: boolean
  }
  skills: string[]
  description: string
  requirements: string
  benefits: string
}

export type RetrievedResumeChunk = {
  resume_id: string
  candidate_id: string
  chunk_id: string
  chunk_index: number
  status: ResumeStatus
  is_default: boolean
  title: string
  text: string
  section?: string
  score: number
}
