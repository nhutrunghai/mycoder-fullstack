export const CHAT_INTENTS = [
  'job_search',
  'job_explanation',
  'cv_review',
  'cv_job_match',
  'cv_match_previous_jobs',
  'policy_qa',
  'general_chat',
  'unsupported'
] as const

export type ChatIntent = (typeof CHAT_INTENTS)[number]
