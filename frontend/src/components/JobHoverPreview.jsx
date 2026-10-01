import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { loadJobDetail } from '../data/apiClient.js'
import { queryKeys } from '../lib/queryKeys.js'

function PreviewList({ title, icon, items, fallback }) {
  const values = (items || []).filter(Boolean).slice(0, 5)

  return (
    <section className="mt-4">
      <h5 className="flex items-center gap-2 border-l-4 border-emerald-500 pl-2 text-[15px] font-bold text-slate-800">
        <span className="material-symbols-outlined !text-[18px] text-emerald-600" aria-hidden="true">{icon}</span>
        {title}
      </h5>
      <ul className="mt-2 space-y-1.5 pl-5 text-[13px] leading-5 text-slate-600">
        {(values.length ? values : [fallback]).map((item, index) => (
          <li key={`${title}-${index}`} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function PreviewMeta({ icon, value }) {
  if (!value) return null

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600">
      <span className="material-symbols-outlined !text-[16px] text-slate-400" aria-hidden="true">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  )
}

export default function JobHoverPreview({ job, className = '' }) {
  const detailUrl = `/job-detail/${job.id}`
  const tooltipId = `job-preview-${job.id}`
  const triggerRef = useRef(null)
  const openTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ left: 16, top: 16, width: 544, maxHeight: 544, side: 'right' })

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: queryKeys.jobs.detail(job.id),
    queryFn: () => loadJobDetail(job.id),
    enabled: isOpen && Boolean(job.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const viewportPadding = 16
    const gap = 12
    const width = Math.min(544, window.innerWidth - viewportPadding * 2)
    const rightSpace = window.innerWidth - rect.right - viewportPadding
    const leftSpace = rect.left - viewportPadding
    const side = rightSpace >= width + gap || rightSpace >= leftSpace ? 'right' : 'left'
    const preferredLeft = side === 'right'
      ? rect.right + gap
      : rect.left - width - gap
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    )
    const maxHeight = Math.min(544, window.innerHeight - viewportPadding * 2)
    const top = Math.min(
      Math.max(viewportPadding, rect.top - 24),
      Math.max(viewportPadding, window.innerHeight - maxHeight - viewportPadding),
    )

    setPosition({ left, top, width, maxHeight, side })
  }, [])

  const clearTimers = () => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current)
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
  }

  const openPreview = (delay = 160) => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return

    clearTimers()
    if (delay === 0) {
      updatePosition()
      setIsOpen(true)
      return
    }

    openTimerRef.current = window.setTimeout(() => {
      updatePosition()
      setIsOpen(true)
    }, delay)
  }

  const closePreview = () => {
    clearTimers()
    closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 120)
  }

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    if (!isOpen) return undefined

    const reposition = () => updatePosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)

    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [isOpen, updatePosition])

  const previewJob = detail || job
  const responsibilities = detail?.responsibilities || []
  const requirements = detail?.requirements || detail?.requirementsList || []
  const tags = (previewJob.tags || previewJob.skills || []).filter(Boolean).slice(0, 6)
  const summary = previewJob.summary || previewJob.requirements || 'Thông tin công việc đang được cập nhật.'

  const preview = (
    <>
      {isOpen ? (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-[101] h-3.5 w-3.5 rotate-45 bg-white shadow-[2px_2px_5px_rgba(15,23,42,0.12)]"
          style={{
            left: position.side === 'right' ? position.left - 7 : position.left + position.width - 7,
            top: position.top + 32,
          }}
        />
      ) : null}
    <div
      id={tooltipId}
      role="dialog"
      aria-label={`Xem nhanh ${previewJob.title}`}
      onMouseEnter={() => {
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
      }}
      onMouseLeave={closePreview}
      className={`fixed z-[100] overflow-y-auto rounded-xl bg-white p-5 text-left shadow-[0_26px_70px_-18px_rgba(15,23,42,0.5)] transition duration-150 ease-out ${
        isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
      }`}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[18px] font-bold leading-6 text-slate-900">{previewJob.title}</p>
          <p className="mt-1 text-[14px] font-medium text-slate-500">{previewJob.company}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[14px] font-bold text-emerald-600">
          <span className="material-symbols-outlined !text-[18px]" aria-hidden="true">payments</span>
          {previewJob.salary}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        <PreviewMeta icon="location_on" value={previewJob.location} />
        <PreviewMeta icon="workspace_premium" value={previewJob.level || previewJob.experience} />
        <PreviewMeta icon="schedule" value={previewJob.deadline} />
        <PreviewMeta icon="work_history" value={previewJob.workMode} />
      </div>

      {isLoading && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      {!isLoading && (
        <>
          <PreviewList
            title="Mô tả công việc"
            icon="description"
            items={responsibilities}
            fallback={summary}
          />
          <PreviewList
            title="Yêu cầu ứng viên"
            icon="person_search"
            items={requirements}
            fallback={previewJob.requirements || 'Đang cập nhật yêu cầu.'}
          />
        </>
      )}

      {isError && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
          Không tải được chi tiết mới nhất. Đang hiển thị thông tin tóm tắt.
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <Link
          to={detailUrl}
          tabIndex={isOpen ? 0 : -1}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0b7cff] px-4 text-[13px] font-bold text-white transition hover:bg-blue-700"
        >
          Xem chi tiết
          <span className="material-symbols-outlined !text-[17px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    </div>
    </>
  )

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative mb-3 inline-block max-w-full ${className}`}
        onMouseEnter={() => openPreview()}
        onMouseLeave={closePreview}
        onFocus={() => openPreview(0)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closePreview()
        }}
      >
        <Link
          to={detailUrl}
          aria-controls={tooltipId}
          aria-expanded={isOpen}
          className="block max-w-full text-[17px] font-bold text-[#0b7cff] transition-colors hover:text-blue-700 focus:text-blue-700 focus:outline-none"
        >
          {job.title}
        </Link>
      </div>
      {typeof document !== 'undefined' ? createPortal(preview, document.body) : null}
    </>
  )
}
