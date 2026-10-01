import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import UserAvatar from '../components/UserAvatar.jsx'
import PublicHeader from '../components/layout/PublicHeader.jsx'
import useCurrentUser from '../hooks/useCurrentUser.js'
import { useFavoriteStore } from '../stores/useFavoriteStore.js'
import { toSafeExternalUrl, toSafeResourceUrl } from '../utils/safeUrl.js'
import {
  deleteChatSession,
  loadChatSessionDetail,
  loadChatSessions,
  loadJobDetail,
  loadUserResumeDetail,
  loadUserUploadedCvs,
  sendChatMessage,
} from '../data/apiClient.js'


const CHAT_SOURCE_CACHE_KEY = 'ai_agent_chat_sources_cache'
const CHAT_SOURCE_CACHE_VERSION = 1
const CHAT_SOURCE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CHAT_SOURCE_CACHE_MAX_ENTRIES = 50

const QUICK_CHAT_PROMPTS = [
  {
    icon: 'work',
    title: 'Tìm job hợp CV',
    description: 'Gợi ý các job phù hợp nhất dựa trên CV đã tải lên MYCODER.',
    prompt: 'Tìm job phù hợp với CV của tôi',
  },
  {
    icon: 'code',
    title: 'Job theo kỹ năng',
    description: 'Tìm việc theo Node.js, React, Java, Python hoặc kỹ năng bạn nhập.',
    prompt: 'Tìm cho tôi các job Node.js TypeScript',
  },
  {
    icon: 'compare_arrows',
    title: 'So sánh job',
    description: 'Sau khi tìm job, hỏi AI so sánh mức phù hợp giữa các tin.',
    prompt: 'So sánh các job vừa tìm được và nói job nào phù hợp hơn',
  },
  {
    icon: 'description',
    title: 'Đánh giá CV',
    description: 'Nếu đã upload CV, AI có thể nhận xét điểm mạnh/yếu và job phù hợp.',
    prompt: 'Đánh giá CV của tôi và gợi ý các job phù hợp',
  },
]

function getMessageSourceCacheKey(sessionId, content) {
  const input = `${String(sessionId || '').trim()}::${String(content || '').trim()}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `source_${(hash >>> 0).toString(36)}`
}

function readChatSourceCache() {
  try {
    window.localStorage.removeItem(CHAT_SOURCE_CACHE_KEY)
    const raw = window.sessionStorage.getItem(CHAT_SOURCE_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed?.version !== CHAT_SOURCE_CACHE_VERSION || !parsed.entries || typeof parsed.entries !== 'object') return {}

    const now = Date.now()
    return Object.fromEntries(
      Object.entries(parsed.entries).filter(([, entry]) => (
        Array.isArray(entry?.sources) && Number(entry.expiresAt) > now
      )),
    )
  } catch {
    return {}
  }
}

function writeChatSourceCache(cache) {
  try {
    const entries = Object.entries(cache)
      .sort(([, left], [, right]) => Number(right?.createdAt || 0) - Number(left?.createdAt || 0))
      .slice(0, CHAT_SOURCE_CACHE_MAX_ENTRIES)
    window.sessionStorage.setItem(CHAT_SOURCE_CACHE_KEY, JSON.stringify({
      version: CHAT_SOURCE_CACHE_VERSION,
      entries: Object.fromEntries(entries),
    }))
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}

function saveChatSourcesToCache(sessionId, content, sources = []) {
  if (!sessionId || !content || !Array.isArray(sources) || !sources.length) return
  const cache = readChatSourceCache()
  cache[getMessageSourceCacheKey(sessionId, content)] = {
    sources: sources.slice(0, 20),
    createdAt: Date.now(),
    expiresAt: Date.now() + CHAT_SOURCE_CACHE_TTL_MS,
  }
  writeChatSourceCache(cache)
}

function getCachedChatSources(sessionId, content) {
  const cached = readChatSourceCache()[getMessageSourceCacheKey(sessionId, content)]
  return Array.isArray(cached?.sources) ? cached.sources : []
}

function createLocalId(prefix = 'chat') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildWelcomeMessage() {
  return {
    id: 'welcome',
    role: 'assistant',
    content:
      'Xin chào, tôi có thể giúp bạn tìm job IT phù hợp, giải thích các tin tuyển dụng vừa tìm được hoặc đánh giá CV đã tải lên MYCODER.',
    createdAt: new Date().toISOString(),
    sources: [],
  }
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function getIntentLabel(intent) {
  const labels = {
    job_search: 'Tìm job',
    job_explanation: 'Giải thích job',
    cv_review: 'Đánh giá CV',
    policy_qa: 'Hỏi đáp',
    unsupported: 'Ngoài phạm vi',
  }
  return labels[intent] || ''
}

function getChatJobId(job = {}) {
  return String(job.job_id || job.jobId || job._id || job.id || job.detail?._id || job.detail?.id || '').trim()
}

function formatChatSalary(salary) {
  if (typeof salary === 'string') return salary
  if (!salary || typeof salary !== 'object') return ''

  const unit = salary.currency || 'VND'
  const min = typeof salary.min === 'number' ? salary.min.toLocaleString('vi-VN') : ''
  const max = typeof salary.max === 'number' ? salary.max.toLocaleString('vi-VN') : ''

  if (min && max) return `${min} - ${max} ${unit}`
  if (min) return `Từ ${min} ${unit}`
  if (max) return `Đến ${max} ${unit}`
  return salary.is_negotiable ? 'Thỏa thuận' : ''
}

function normalizeChatJobSource(job = {}) {
  const detail = job.detail || job.job || job
  const jobId = getChatJobId(job) || getChatJobId(detail)
  if (!jobId) return null

  const company = detail.company || job.company || {}
  const companyName =
    typeof company === 'string'
      ? company
      : company.company_name || company.name || detail.company_name || job.company_name || ''

  return {
    ...job,
    type: 'job',
    job_id: jobId,
    title: detail.title || job.title || '',
    company: companyName,
    detail: {
      ...detail,
      id: getChatJobId(detail) || jobId,
      title: detail.title || job.title || '',
      company: companyName,
      avatar: detail.avatar || detail.logo || company.logo || '',
      salary: formatChatSalary(detail.salary || job.salary) || detail.salary || job.salary || '',
      location: detail.location || company.address || job.location || '',
      postedAt: detail.postedAt || detail.published_at || detail.created_at || '',
      requirements: detail.requirements || job.requirements || detail.description || job.description || '',
      summary: detail.summary || detail.description || job.description || '',
      tags: Array.isArray(detail.tags) ? detail.tags : [...(detail.skills || []), ...(detail.category || [])].filter(Boolean),
      companyInfo: typeof company === 'object' ? company : {},
    },
  }
}

function getChatResponseSources(response = {}) {
  const sourceItems = Array.isArray(response.sources) ? response.sources : []
  const jobItems = [
    ...(Array.isArray(response.jobs) ? response.jobs : []),
    ...(Array.isArray(response.job_results) ? response.job_results : []),
    ...(Array.isArray(response.recommendations) ? response.recommendations : []),
    ...(Array.isArray(response.data?.jobs) ? response.data.jobs : []),
    ...(Array.isArray(response.data?.items) ? response.data.items : []),
  ]

  const normalizedJobSources = [...sourceItems, ...jobItems]
    .map((source) => (source?.type === 'job' || getChatJobId(source) || source?.job ? normalizeChatJobSource(source) : source))
    .filter(Boolean)

  const seenJobIds = new Set()
  return normalizedJobSources.filter((source) => {
    if (source.type !== 'job') return true
    const jobId = getChatJobId(source)
    if (!jobId || seenJobIds.has(jobId)) return false
    seenJobIds.add(jobId)
    return true
  })
}

async function enrichChatSources(sources = []) {
  return Promise.all(
    sources.map(async (source) => {
      if (source?.type === 'job' && getChatJobId(source)) {
        try {
          const detail = await loadJobDetail(getChatJobId(source))
          return { ...source, detail }
        } catch {
          return source
        }
      }

      if (source?.type === 'resume' && source.resume_id) {
        try {
          const detail = await loadUserResumeDetail(source.resume_id)
          return { ...source, detail }
        } catch {
          return source
        }
      }

      return source
    })
  )
}

function JobSourceCard({ source, isFavorite, onToggleFavorite }) {
  const detail = source.detail || {}
  const jobId = getChatJobId(source) || getChatJobId(detail)
  const title = detail.title || source.title || 'Tin tuyển dụng'
  const company = detail.company || source.company || 'Đang cập nhật'
  const location = detail.location || 'Đang cập nhật'
  const salary = detail.salary || 'Thỏa thuận'
  const requirement = Array.isArray(detail.requirements)
    ? detail.requirements[0]
    : detail.requirements || detail.summary || 'Đang cập nhật yêu cầu'
  const tags = Array.isArray(detail.tags) ? detail.tags.slice(0, 3) : []
  const avatar = detail.avatar || detail.companyInfo?.logo || ''

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_14px_28px_-24px_rgba(37,99,235,0.65)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar src={avatar} name={company} className="h-10 w-10 border border-slate-100" textClassName="text-xs" />
          <div className="min-w-0">
            <h4 className="truncate text-[14px] font-bold text-slate-900">{company}</h4>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
              <span>{detail.postedAt || 'Đang cập nhật'}</span>
              <span>•</span>
              <span className="material-symbols-outlined !text-[12px]">location_on</span>
              <span className="truncate">{location}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(jobId)}
          className={`${isFavorite ? 'text-red-500' : 'text-slate-300'} transition hover:text-red-500`}
          aria-label="Lưu việc"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}>
            favorite
          </span>
        </button>
      </div>

      <Link to={`/job-detail/${jobId}`} className="block text-[16px] font-black leading-snug text-slate-950 transition hover:text-[#0b7cff]">
        {title}
      </Link>

      <div className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-[#28a745]">
        <span className="material-symbols-outlined !text-[16px]">payments</span>
        {salary}
      </div>

      <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-700">Yêu cầu:</span> {requirement}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
              {tag}
            </span>
          ))}
        </div>
        <Link to={`/job-detail/${jobId}`} className="shrink-0 rounded-lg bg-[#007bff] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-blue-700">
          Xem chi tiết
        </Link>
      </div>
    </article>
  )
}

function ResumeSourceButton({ source, onPreviewResume }) {
  const detail = source.detail || {}
  const title = detail.title || source.title || 'CV đã tải lên'
  const canPreview = Boolean(detail.cvUrl)

  return (
    <button
      type="button"
      onClick={() => canPreview && onPreviewResume(detail)}
      disabled={!canPreview}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:border-cyan-200 hover:bg-cyan-100 disabled:cursor-default disabled:hover:border-cyan-100 disabled:hover:bg-cyan-50"
      title={canPreview ? 'Xem preview CV' : 'CV này chưa có URL preview'}
    >
      <span className="material-symbols-outlined text-[15px]">description</span>
      <span className="truncate">{title}</span>
      {detail.fileType && <span className="rounded-full bg-white/70 px-1.5 text-[10px] text-cyan-600">{detail.fileType}</span>}
    </button>
  )
}

function dedupeResumeSources(sources = []) {
  const sourceMap = new Map()

  sources.forEach((source, index) => {
    const key = source.resume_id || source.detail?.id || source.detail?._id || `resume-${index}`
    if (!sourceMap.has(key)) {
      sourceMap.set(key, source)
    }
  })

  return Array.from(sourceMap.values())
}

function SourceList({ sources = [], onPreviewResume, favoriteIds, onToggleFavorite }) {
  if (!sources.length) return null
  const jobSources = sources.filter((source) => source.type === 'job')
  const resumeSources = dedupeResumeSources(sources.filter((source) => source.type !== 'job'))

  return (
    <div className="mt-4 space-y-3">
      {jobSources.length > 0 && (
        <div className="grid max-w-[920px] grid-cols-1 gap-3 xl:grid-cols-2">
          {jobSources.map((source, index) => (
            <JobSourceCard
              key={`${source.type}-${getChatJobId(source) || index}`}
              source={source}
              isFavorite={favoriteIds.has(getChatJobId(source))}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      {resumeSources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resumeSources.map((source, index) => (
            <ResumeSourceButton
              key={`${source.type}-${source.resume_id || source.detail?.id || index}`}
              source={source}
              onPreviewResume={onPreviewResume}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MarkdownMessage({ content, isUser, isError }) {
  if (isUser || isError) {
    return (
      <p className={`mt-1 whitespace-pre-wrap text-[14px] leading-7 ${isError ? 'font-semibold text-rose-600' : 'text-slate-800'}`}>
        {content}
      </p>
    )
  }

  return (
    <div className="mt-1 overflow-hidden text-[14px] leading-7 text-slate-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-4 text-[22px] font-black tracking-tight text-slate-950 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 text-[19px] font-extrabold tracking-tight text-slate-950 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 text-[17px] font-extrabold text-slate-900 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-3 text-[15px] font-bold text-slate-900 first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
          strong: ({ children }) => <strong className="font-extrabold text-slate-950">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
          ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-slate-400">{children}</ul>,
          ol: ({ children }) => <ol className="mt-2 list-decimal space-y-2 pl-5 marker:font-bold marker:text-slate-500">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => <blockquote className="mt-3 border-l-4 border-cyan-200 bg-cyan-50/60 px-4 py-2 text-slate-700">{children}</blockquote>,
          code: ({ inline, children }) =>
            inline ? (
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-semibold text-slate-700">{children}</code>
            ) : (
              <code className="block overflow-x-auto rounded-xl bg-slate-950/95 px-4 py-3 text-[13px] leading-6 text-slate-100">{children}</code>
            ),
          pre: ({ children }) => <pre className="mt-3 overflow-x-auto">{children}</pre>,
          a: ({ href, children }) => (
            toSafeExternalUrl(href) ? (
              <a href={toSafeExternalUrl(href)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#2489d2] underline decoration-blue-200 underline-offset-2">
                {children}
              </a>
            ) : <span>{children}</span>
          ),
          hr: () => <hr className="my-4 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function MessageItem({ message, profileName, profileAvatar, onCopy, onPreviewResume, favoriteIds, onToggleFavorite }) {
  const isUser = message.role === 'user'
  const intentLabel = getIntentLabel(message.intent)

  return (
    <article className={isUser ? 'pl-0' : ''}>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {isUser ? (
            <UserAvatar src={profileAvatar} name={profileName} className="h-8 w-8" textClassName="text-[11px]" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7fbfd] text-[#20c3d0]">
              <span className="material-symbols-outlined text-[18px]">neurology</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold italic text-[#2489d2]">{isUser ? profileName : 'CHAT A.I+'}</p>
              {intentLabel && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  {intentLabel}
                </span>
              )}
              <span className="text-[11px] text-slate-400">{formatTime(message.createdAt)}</span>
            </div>
            <MarkdownMessage content={message.content} isUser={isUser} isError={message.isError} />
            {!isUser && (
              <SourceList
                sources={message.sources}
                onPreviewResume={onPreviewResume}
                favoriteIds={favoriteIds}
                onToggleFavorite={onToggleFavorite}
              />
            )}
          </div>
        </div>

        {!isUser && (
          <button
            type="button"
            onClick={() => onCopy(message.content)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Sao chép câu trả lời"
          >
            <span className="material-symbols-outlined text-[17px]">content_copy</span>
          </button>
        )}
      </div>
    </article>
  )
}


function EmptyChatHero({ onPromptClick, disabled }) {
  return (
    <div className="flex min-h-[calc(100vh-270px)] items-center justify-center px-2 py-10">
      <div className="w-full max-w-4xl text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[32px] bg-[linear-gradient(135deg,#e7fbfd,#eef4ff)] text-[#20c3d0] shadow-[0_22px_60px_-30px_rgba(36,137,210,0.8)] ring-1 ring-cyan-100">
          <span className="material-symbols-outlined text-[52px]">neurology</span>
        </div>
        <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-[#2489d2]">CHAT A.I+</p>
        <h2 className="mt-2 text-[34px] font-black tracking-tight text-slate-950 md:text-[46px]">Tôi có thể giúp gì cho bạn?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-slate-500">
          Hỏi về job IT, tìm việc theo kỹ năng, so sánh tin tuyển dụng hoặc nhờ đánh giá CV đã tải lên MYCODER.
        </p>

        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          {QUICK_CHAT_PROMPTS.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => onPromptClick(item.prompt)}
              disabled={disabled}
              className="group rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-[0_18px_42px_-34px_rgba(36,137,210,0.75)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_54px_-34px_rgba(36,137,210,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#2489d2] transition group-hover:bg-[#2489d2] group-hover:text-white">
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-500">{item.description}</p>
                  <p className="mt-3 text-[12px] font-semibold text-[#2b59ff]">{item.prompt}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CvPreviewModal({ resume, onClose }) {
  if (!resume) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.7)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">{resume.title || 'Preview CV'}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-400">{resume.fileType || 'CV'}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={toSafeResourceUrl(resume.cvUrl) || undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Mở tab mới
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
        <iframe
          title={resume.title || 'CV preview'}
          src={toSafeResourceUrl(resume.cvUrl) || undefined}
          sandbox="allow-same-origin allow-downloads"
          className="min-h-0 flex-1 border-0 bg-slate-50"
        />
      </div>
    </div>
  )
}

export default function AIAgent() {
  const navigate = useNavigate()
  const session = useCurrentUser()
  const { isAuthenticated, profileName, profileAvatar } = session
  const favoriteIds = useFavoriteStore((state) => state.favoriteIds)
  const toggleFavoriteInStore = useFavoriteStore((state) => state.toggle)

  const [prompt, setPrompt] = useState('')
  const [conversations, setConversations] = useState([])
  const [, setActiveConversationId] = useState('')
  const [activeSessionId, setActiveSessionId] = useState('')
  const [messages, setMessages] = useState([buildWelcomeMessage()])
  const [resumeOptions, setResumeOptions] = useState([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendingStartedAt, setSendingStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [previewResume, setPreviewResume] = useState(null)
  const [chatError, setChatError] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState('')

  useEffect(() => {
    let active = true

    if (!isAuthenticated) {
      setResumeOptions([])
      setSelectedResumeId('')
      setConversations([])
      setActiveConversationId('')
      setActiveSessionId('')
      setMessages([buildWelcomeMessage()])
      return () => {
        active = false
      }
    }

    loadUserUploadedCvs().then((items) => {
      if (!active) return
      const activeItems = items.filter((item) => item.id && item.status !== 'deleted')
      setResumeOptions(activeItems)
      setSelectedResumeId((current) => current || activeItems.find((item) => item.isDefault)?.id || activeItems[0]?.id || '')
    })

    return () => {
      active = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    let active = true

    if (!isAuthenticated) {
      return () => {
        active = false
      }
    }

    setIsLoadingSessions(true)
    loadChatSessions()
      .then((items) => {
        if (!active) return
        setConversations(items)

        if (!items.length) {
          setActiveConversationId('')
          setActiveSessionId('')
          setMessages([buildWelcomeMessage()])
          return
        }

        const firstSessionId = items[0].sessionId || items[0].id
        setActiveConversationId(firstSessionId)
        setActiveSessionId(firstSessionId)
      })
      .catch((error) => {
        if (!active) return
        setConversations([])
        setChatError(error?.message || 'Không thể tải danh sách session chat.')
      })
      .finally(() => {
        if (active) setIsLoadingSessions(false)
      })

    return () => {
      active = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    let active = true

    if (!isAuthenticated || !activeSessionId) {
      return () => {
        active = false
      }
    }

    setIsLoadingConversation(true)
    loadChatSessionDetail(activeSessionId)
      .then(async (session) => {
        if (!active) return
        const enrichedMessages = await Promise.all(
          (session.messages || []).map(async (message) => {
            if (message.role !== 'assistant') {
              return message
            }

            const messageSources = Array.isArray(message.sources) && message.sources.length
              ? message.sources
              : getCachedChatSources(activeSessionId, message.content)

            if (!messageSources.length) {
              return message
            }

            return {
              ...message,
              sources: await enrichChatSources(messageSources),
            }
          }),
        )

        if (!active) return
        setMessages(enrichedMessages.length ? enrichedMessages : [buildWelcomeMessage()])
      })
      .catch((error) => {
        if (!active) return
        setChatError(error?.message || 'Không thể tải nội dung session chat.')
        setMessages([buildWelcomeMessage()])
      })
      .finally(() => {
        if (active) setIsLoadingConversation(false)
      })

    return () => {
      active = false
    }
  }, [activeSessionId, isAuthenticated])

  useEffect(() => {
    if (!isSending || !sendingStartedAt) {
      setElapsedSeconds(0)
      return undefined
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sendingStartedAt) / 1000)))
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(timer)
  }, [isSending, sendingStartedAt])

  const activeResumeTitle = useMemo(
    () => resumeOptions.find((item) => item.id === selectedResumeId)?.title || '',
    [resumeOptions, selectedResumeId]
  )

  const syncConversationSummary = (sessionId, userText, assistantText = '') => {
    if (!sessionId) return

    setConversations((current) => {
      const existing = current.find((item) => item.sessionId === sessionId || item.id === sessionId)
      const fallbackTitle = String(userText || '').trim() || 'Cuộc trò chuyện mới'
      const nextItem = {
        id: sessionId,
        sessionId,
        title: existing?.title || (fallbackTitle.length > 80 ? `${fallbackTitle.slice(0, 77)}...` : fallbackTitle),
        lastMessage: assistantText || userText || existing?.lastMessage || '',
        intent: existing?.intent || '',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      return [nextItem, ...current.filter((item) => item.sessionId !== sessionId && item.id !== sessionId)]
    })
  }

  const handleNewChat = () => {
    setPrompt('')
    setChatError('')
    setActiveConversationId('')
    setActiveSessionId('')
    setMessages([buildWelcomeMessage()])
  }

  const handleSelectConversation = (conversation) => {
    setPrompt('')
    setChatError('')
    const sessionId = conversation.sessionId || conversation.id || ''
    setActiveConversationId(sessionId)
    setActiveSessionId(sessionId)
    setMobileHistoryOpen(false)
  }

  const handleClearConversations = () => {
    handleNewChat()
  }

  const handleDeleteConversation = async (conversation, event) => {
    event.stopPropagation()

    const sessionId = conversation.sessionId || conversation.id || ''
    if (!sessionId || deletingSessionId) return

    setDeletingSessionId(sessionId)
    setChatError('')

    try {
      await deleteChatSession(sessionId)
      const remaining = conversations.filter((item) => (item.sessionId || item.id) !== sessionId)
      setConversations(remaining)

      if (activeSessionId === sessionId) {
        const nextSession = remaining[0]
        if (nextSession) {
          const nextSessionId = nextSession.sessionId || nextSession.id || ''
          setActiveConversationId(nextSessionId)
          setActiveSessionId(nextSessionId)
        } else {
          handleNewChat()
        }
      }
    } catch (error) {
      setChatError(error?.message || 'Không thể xóa session chat.')
    } finally {
      setDeletingSessionId('')
    }
  }

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // Clipboard can be unavailable in some browser contexts.
    }
  }

  const handleToggleFavorite = (jobId) => {
    if (!jobId) return

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/ai-agent', search: '' } } })
      return
    }

    void toggleFavoriteInStore(jobId).catch((error) => {
      console.error('Failed to update favorite job', error)
    })
  }

  const handleSend = async (presetPrompt) => {
    const text = String(presetPrompt || prompt).trim()
    if (isSending) return
    if (!isAuthenticated) {
      setChatError('Bạn cần đăng nhập để sử dụng AI Agent.')
      navigate('/login', { state: { from: { pathname: '/ai-agent', search: '' } } })
      return
    }
    if (text.length < 2) {
      setChatError('Vui lòng nhập nội dung tối thiểu 2 ký tự.')
      return
    }

    const userMessage = {
      id: createLocalId('user'),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    const optimisticMessages = [...messages.filter((message) => message.id !== 'welcome'), userMessage]
    setMessages(optimisticMessages)
    setPrompt('')
    setChatError('')
    setIsSending(true)
    setSendingStartedAt(Date.now())

    try {
      const response = await sendChatMessage({
        message: text,
        sessionId: activeSessionId,
        resumeId: selectedResumeId || undefined,
      })
      const enrichedSources = await enrichChatSources(getChatResponseSources(response))

      const nextSessionId = response.session_id || activeSessionId
      const assistantMessage = {
        id: createLocalId('assistant'),
        role: 'assistant',
        content: response.answer || 'Tôi chưa nhận được câu trả lời phù hợp từ hệ thống.',
        intent: response.intent || '',
        sources: enrichedSources,
        createdAt: new Date().toISOString(),
      }
      const nextMessages = [...optimisticMessages, assistantMessage]
      saveChatSourcesToCache(nextSessionId, assistantMessage.content, enrichedSources)

      setActiveSessionId(nextSessionId)
      setActiveConversationId(nextSessionId)
      setMessages(nextMessages)
      syncConversationSummary(nextSessionId, text, assistantMessage.content)
    } catch (error) {
      const message =
        error?.status === 401
          ? 'Bạn cần đăng nhập để sử dụng AI Agent.'
          : error?.message || 'Không thể gửi câu hỏi tới AI Agent. Vui lòng thử lại.'
      const errorMessage = {
        id: createLocalId('assistant'),
        role: 'assistant',
        content: message,
        isError: true,
        createdAt: new Date().toISOString(),
        sources: [],
      }
      const nextMessages = [...optimisticMessages, errorMessage]
      setChatError(message)
      setMessages(nextMessages)
    } finally {
      setIsSending(false)
      setSendingStartedAt(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f9fb] text-slate-900">
      <PublicHeader session={session} activeNav="/ai-agent" />

      <main className="h-[calc(100vh-121px)] lg:h-[calc(100vh-57px)]">
        <div className="h-full bg-white">
          <div className="grid h-full grid-cols-1 lg:grid-cols-[292px_minmax(0,1fr)]">
            <aside className="hidden h-full min-h-0 overflow-hidden border-r border-slate-200 bg-[#f8fafb] lg:flex lg:flex-col">
              <div className="border-b border-slate-100 px-5 pb-4 pt-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f5f6] text-teal-700">
                    <span className="material-symbols-outlined text-[18px]">neurology</span>
                  </span>
                  <div>
                    <h1 className="text-[15px] font-extrabold tracking-[0.08em] text-slate-900">MYCODER AI</h1>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">Trợ lý nghề nghiệp</p>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex h-10 w-full items-center justify-center rounded-lg bg-[#2b59ff] text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1f4bf1]"
                  >
                    <span className="material-symbols-outlined mr-2 text-[18px]">add</span>
                    Cuộc trò chuyện mới
                  </button>
                  <button
                    type="button"
                    className="hidden"
                    title="Tìm hội thoại"
                  >
                    <span className="material-symbols-outlined text-[18px]">search</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">Lịch sử trò chuyện</p>
                    <span className="text-[11px] font-medium text-slate-400">{conversations.length}</span>
                  </div>
                </div>

                <div className="space-y-1 px-3 py-3">
                  {isLoadingSessions ? (
                    <div className="rounded-[14px] border border-dashed border-slate-200 px-4 py-5 text-center text-[13px] leading-6 text-slate-500">
                      Đang tải danh sách session...
                    </div>
                  ) : conversations.length ? (
                    conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`group flex items-center gap-2 border-l-2 px-2 py-2 transition ${
                          activeSessionId === (conversation.sessionId || conversation.id)
                            ? 'border-[#2b59ff] bg-blue-50 text-[#1e58b1]'
                            : 'border-transparent text-slate-700 hover:bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectConversation(conversation)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1 text-left text-[13px] font-medium"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#2489d2]">forum</span>
                          <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
                          <span className="text-[11px] text-slate-400">{formatTime(conversation.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleDeleteConversation(conversation, event)}
                          disabled={deletingSessionId === (conversation.sessionId || conversation.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          title="Xóa session"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-slate-200 px-4 py-5 text-center text-[13px] leading-6 text-slate-500">
                      Chưa có hội thoại nào. Hãy hỏi về job IT, độ phù hợp hoặc CV của bạn.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto space-y-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((prev) => !prev)}
                  className="flex h-11 w-full items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 transition hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined mr-2 text-[18px] text-slate-500">settings</span>
                  Ngữ cảnh CV
                  <span className="material-symbols-outlined ml-auto text-[18px] text-slate-400">
                    {settingsOpen ? 'expand_more' : 'chevron_right'}
                  </span>
                </button>

                {settingsOpen && (
                  <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                    {isAuthenticated ? (
                      resumeOptions.length > 0 ? (
                        <label className="block">
                          <span className="mb-2 block text-[12px] font-semibold text-slate-500">CV dùng cho đánh giá</span>
                          <select
                            value={selectedResumeId}
                            onChange={(event) => setSelectedResumeId(event.target.value)}
                            className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 outline-none transition focus:border-blue-300"
                          >
                            {resumeOptions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                          {activeResumeTitle && (
                            <p className="mt-2 truncate text-[11px] font-medium text-slate-400">Đang chọn: {activeResumeTitle}</p>
                          )}
                        </label>
                      ) : (
                        <p className="text-[13px] leading-6 text-slate-500">Bạn chưa có CV active để AI Agent đánh giá.</p>
                      )
                    ) : (
                      <p className="text-[13px] leading-6 text-slate-500">Đăng nhập để chọn CV dùng cho đánh giá.</p>
                    )}
                  </div>
                )}

                <button className="flex h-11 w-full items-center rounded-full border border-slate-200 bg-white px-2 text-[14px] font-medium text-slate-800 transition hover:bg-slate-50">
                  <UserAvatar src={profileAvatar} name={profileName} className="mr-3 h-8 w-8" textClassName="text-[11px]" />
                  <span className="min-w-0 truncate">{isAuthenticated ? profileName : 'Khách MYCODER'}</span>
                </button>
              </div>
            </aside>

            <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
              <div className="border-b border-slate-200 px-3 py-2.5 lg:hidden">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileHistoryOpen(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
                    aria-label="Mở lịch sử chat"
                  >
                    <span className="material-symbols-outlined text-[22px]">menu</span>
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <h1 className="truncate text-[15px] font-extrabold tracking-[0.08em] text-slate-900">MYCODER AI</h1>
                    <p className="truncate text-[11px] font-medium text-slate-500">
                      {activeResumeTitle ? `CV: ${activeResumeTitle}` : 'AI Agent hỗ trợ job và CV'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2b59ff] text-white transition hover:bg-[#1f4bf1]"
                    aria-label="Tạo chat mới"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
                <div className="mx-auto w-full max-w-[1320px] space-y-7 pb-6">
                  {isLoadingConversation && (
                    <div className="pl-11 text-[13px] font-medium text-slate-500">Đang tải nội dung session...</div>
                  )}
                  {messages.length === 1 && messages[0]?.id === 'welcome' && !isLoadingConversation ? (
                    <EmptyChatHero onPromptClick={handleSend} disabled={isSending} />
                  ) : (
                    messages.map((message) => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        profileName={profileName}
                        profileAvatar={profileAvatar}
                        onCopy={handleCopy}
                        onPreviewResume={setPreviewResume}
                        favoriteIds={favoriteIds}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))
                  )}

                  {isSending && (
                    <div className="flex items-center gap-3 pl-11 text-[13px] font-medium text-slate-500">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#20c3d0]"></span>
                      <span>AI Agent đang xử lý...</span>
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[12px] font-bold text-cyan-700">
                        {elapsedSeconds}s
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <footer className="shrink-0 bg-white px-3 py-3 md:px-8 md:py-4">
                <div className="mx-auto w-full max-w-[820px]">
                  {chatError && <p className="mb-2 text-[13px] font-medium text-rose-600">{chatError}</p>}
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)] sm:gap-3 sm:px-4">
                    <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#e7fbfd] text-[#20c3d0] sm:flex">
                      <span className="material-symbols-outlined text-[18px]">neurology</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <input
                        value={prompt}
                        onChange={(event) => {
                          setPrompt(event.target.value)
                          if (chatError) setChatError('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            handleSend()
                          }
                        }}
                        className="h-9 w-full border-0 bg-transparent text-[14px] text-slate-700 outline-none ring-0 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0"
                        placeholder="Hỏi về job IT, so sánh tin tuyển dụng hoặc nhờ đánh giá CV..."
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={isSending}
                      aria-label="Gửi tin nhắn"
                      title="Gửi tin nhắn"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#2b59ff] transition hover:bg-slate-100 hover:text-[#1f4bf1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[22px]">arrow_upward</span>
                    </button>
                  </div>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </main>
      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileHistoryOpen(false)}
            aria-label="Đóng lịch sử chat"
          />
          <aside className="relative flex h-full w-[84vw] max-w-[340px] flex-col bg-white px-4 py-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-black tracking-[0.08em] text-slate-900">CHAT A.I+</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Lịch sử và cài đặt</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label="Đóng lịch sử chat"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                handleNewChat()
                setMobileHistoryOpen(false)
              }}
              className="mb-4 flex h-11 items-center justify-center rounded-lg bg-[#2b59ff] text-[14px] font-bold text-white transition hover:bg-[#1f4bf1]"
            >
              <span className="material-symbols-outlined mr-2 text-[18px]">add</span>
              Chat mới
            </button>

            {isAuthenticated && resumeOptions.length > 0 && (
              <label className="mb-4 block rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <span className="mb-2 block text-[12px] font-semibold text-slate-500">CV dùng cho đánh giá</span>
                <select
                  value={selectedResumeId}
                  onChange={(event) => setSelectedResumeId(event.target.value)}
                  className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 outline-none"
                >
                  {resumeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-500">Lịch sử trò chuyện</p>
              <button
                type="button"
                onClick={handleClearConversations}
                className="rounded-md px-2 py-1 text-[12px] font-bold text-[#2b59ff] transition hover:bg-blue-50"
              >
                Chat mới
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoadingSessions ? (
                <div className="rounded-[14px] border border-dashed border-slate-200 px-4 py-5 text-center text-[13px] leading-6 text-slate-500">
                  Đang tải danh sách session...
                </div>
              ) : conversations.length ? (
                <div className="space-y-1">
                  {conversations.map((conversation) => {
                    const sessionId = conversation.sessionId || conversation.id
                    const active = activeSessionId === sessionId
                    return (
                      <div
                        key={conversation.id}
                        className={`flex items-center gap-2 rounded-[14px] px-2 py-2 ${
                          active ? 'bg-blue-50 text-[#1e58b1]' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectConversation(conversation)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] px-1 py-1 text-left text-[13px] font-medium"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#2489d2]">forum</span>
                          <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
                          <span className="text-[11px] text-slate-400">{formatTime(conversation.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleDeleteConversation(conversation, event)}
                          disabled={deletingSessionId === sessionId}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Xóa session"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-slate-200 px-4 py-5 text-center text-[13px] leading-6 text-slate-500">
                  Chưa có hội thoại nào.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
      <CvPreviewModal resume={previewResume} onClose={() => setPreviewResume(null)} />
    </div>
  )
}
