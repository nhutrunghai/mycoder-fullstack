import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import { getAdminJobDetail, getAdminJobs, updateAdminJobModerationStatus } from '../../api/adminService.js'
import { compactId, formatDateVi as formatDate } from '../../utils/formatters.js'

const jobStatusLabelMap = {
  draft: 'Bản nháp',
  open: 'Đang tuyển',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
  expired: 'Hết hạn',
}

const jobStatusToneMap = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  open: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  paused: 'border-amber-100 bg-amber-50 text-amber-700',
  closed: 'border-slate-200 bg-white text-slate-600',
  expired: 'border-rose-100 bg-rose-50 text-rose-700',
}

const moderationLabelMap = {
  active: 'Được phép hiển thị',
  blocked: 'Admin đã chặn',
}

const moderationToneMap = {
  active: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  blocked: 'border-rose-200 bg-rose-50 text-rose-700',
}

const listBadgeClassName =
  'inline-flex min-h-[38px] w-full items-center justify-center rounded-xl border px-2.5 py-1.5 text-center text-[11px] font-extrabold leading-4 whitespace-normal break-words'

const listActionClassName =
  'flex min-h-[40px] items-center justify-center rounded-md border px-3.5 py-2.5 text-center text-[11px] font-bold leading-4 whitespace-normal break-words transition'

const jobTypeLabelMap = {
  'full-time': 'Toàn thời gian',
  'part-time': 'Bán thời gian',
  internship: 'Thực tập',
  contract: 'Hợp đồng',
  remote: 'Từ xa',
}


function formatJobCategories(job) {
  if (Array.isArray(job?.category_names) && job.category_names.length) return job.category_names.join(', ')
  if (Array.isArray(job?.categories) && job.categories.length) {
    return job.categories.map((item) => (typeof item === 'string' ? item : item?.name || item?.slug)).filter(Boolean).join(', ')
  }
  if (Array.isArray(job?.category_ids) && job.category_ids.length) return job.category_ids.join(', ')
  if (Array.isArray(job?.category) && job.category.length) return job.category.join(', ')
  return ''
}

function getVisibilityState(job) {
  if (job?.moderation_status === 'blocked') {
    return {
      isBlocked: true,
      label: 'Không hiển thị công khai',
      description:
        'Tin này đã bị admin chặn. Người dùng sẽ không thấy tin trên khu vực công khai dù trạng thái tuyển dụng vẫn là đang tuyển.',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  return {
    isBlocked: false,
    label: 'Được phép hiển thị',
    description:
      'Tin được phép hiển thị bởi admin. Việc xuất hiện công khai còn phụ thuộc trạng thái tuyển dụng, ngày đăng và hạn chót.',
    tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  }
}

function formatMoneyRange(salary) {
  if (!salary) return 'Chưa cập nhật'
  if (typeof salary === 'string') return salary
  const min = salary.min ?? salary.from ?? salary.minimum
  const max = salary.max ?? salary.to ?? salary.maximum
  const currency = salary.currency || 'VND'
  if (min || max) return `${min || 0} - ${max || 0} ${currency}`
  return 'Chưa cập nhật'
}

function buildPromotionLink(job) {
  const params = new URLSearchParams()
  if (job?._id) params.set('jobId', job._id)
  if (job?.title) params.set('jobTitle', job.title)
  if (job?.company?.company_name) params.set('companyName', job.company.company_name)
  return `/admin/job-promotions?${params.toString()}`
}

function Field({ label, value }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-[12px] font-bold text-slate-800">{value || 'Chưa có'}</p>
    </div>
  )
}

function ParagraphBlock({ title, value }) {
  if (!value) return null
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{title}</p>
      <p className="mt-2 line-clamp-4 whitespace-pre-line text-[12px] font-medium leading-5 text-slate-600">{value}</p>
    </div>
  )
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [moderationStatus, setModerationStatus] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updatingModeration, setUpdatingModeration] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getAdminJobs({
        page: pagination.page,
        limit: pagination.limit,
        keyword: keyword || undefined,
        status: status || undefined,
        moderation_status: moderationStatus || undefined,
      })
        .then((data) => {
          if (!active) return
          setJobs(data?.jobs ?? [])
          setPagination((current) => ({
            ...current,
            ...(data?.pagination || {}),
          }))
        })
        .catch((error) => {
          if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh sách tin tuyển dụng.' })
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, keyword ? 250 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [keyword, status, moderationStatus, pagination.page, pagination.limit])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [keyword, status, moderationStatus])

  const stats = useMemo(() => {
    return {
      open: jobs.filter((job) => job.status === 'open').length,
      blocked: jobs.filter((job) => job.moderation_status === 'blocked').length,
      active: jobs.filter((job) => job.moderation_status !== 'blocked').length,
      expired: jobs.filter((job) => job.status === 'expired').length,
    }
  }, [jobs])

  const handleOpenDetail = async (jobId) => {
    setSelectedJob(null)
    setDetailLoading(true)
    try {
      const detail = await getAdminJobDetail(jobId)
      setSelectedJob(detail)
      setBlockedReason(detail?.blocked_reason || '')
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải chi tiết tin tuyển dụng.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleModeration = async (nextStatus) => {
    if (!selectedJob) return
    if (nextStatus === 'blocked' && !blockedReason.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập lý do chặn tin tuyển dụng.' })
      return
    }

    setUpdatingModeration(true)
    try {
      const payload = nextStatus === 'blocked'
        ? { moderation_status: nextStatus, blocked_reason: blockedReason.trim() }
        : { moderation_status: nextStatus }
      const result = await updateAdminJobModerationStatus(selectedJob._id, payload)
      const updated = {
        moderation_status: result?.moderation_status ?? nextStatus,
        blocked_reason: result?.blocked_reason ?? null,
        blocked_at: result?.blocked_at ?? null,
        updated_at: result?.updated_at || new Date().toISOString(),
      }

      setJobs((current) => current.map((job) => (job._id === selectedJob._id ? { ...job, ...updated } : job)))
      setSelectedJob((current) => ({ ...current, ...updated }))
      if (nextStatus === 'active') setBlockedReason('')
      setToast({ type: 'success', message: nextStatus === 'blocked' ? 'Đã chặn tin tuyển dụng.' : 'Đã mở hiển thị tin tuyển dụng.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật kiểm duyệt tin tuyển dụng.' })
    } finally {
      setUpdatingModeration(false)
    }
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)
  const selectedVisibilityState = getVisibilityState(selectedJob)

  return (
    <AdminLayout title="Tin tuyển dụng" subtitle="Quản lý danh sách tin, trạng thái hiển thị và thao tác kiểm duyệt tin tuyển dụng.">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section className="admin-metrics mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Đang tuyển</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">{stats.open}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Được phép hiển thị</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Admin đã chặn</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-700">{stats.blocked}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Hết hạn</p>
          <p className="mt-2 text-2xl font-extrabold text-amber-700">{stats.expired}</p>
        </div>
      </section>

      <section className="admin-filter-bar mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_170px_110px]">
          <label className="relative md:col-span-2 xl:col-span-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo tiêu đề tin tuyển dụng..."
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 outline-none">
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="open">Đang tuyển</option>
            <option value="paused">Tạm dừng</option>
            <option value="closed">Đã đóng</option>
            <option value="expired">Hết hạn</option>
          </select>
          <select value={moderationStatus} onChange={(event) => setModerationStatus(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 outline-none">
            <option value="">Tất cả kiểm duyệt</option>
            <option value="active">Được phép hiển thị</option>
            <option value="blocked">Admin đã chặn</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setKeyword('')
              setStatus('')
              setModerationStatus('')
            }}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50"
          >
            Đặt lại
          </button>
        </div>
      </section>

      <section>
        <section className="admin-data-panel overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_170px_120px_145px_140px] bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 lg:grid">
            <span>Tin tuyển dụng</span>
            <span>Doanh nghiệp</span>
            <span>Tuyển dụng</span>
            <span>Hiển thị admin</span>
            <span></span>
          </div>

          {jobs.map((job) => {
            const isSelected = selectedJob?._id === job._id
            const visibilityState = getVisibilityState(job)
            return (
              <article
                key={job._id}
                className={`border-t px-4 py-3 text-[12px] transition ${
                  visibilityState.isBlocked
                    ? 'border-rose-100 bg-rose-50/45 hover:bg-rose-50'
                    : isSelected
                      ? 'border-slate-100 bg-teal-50/60'
                      : 'border-slate-100 hover:bg-slate-50'
                } lg:grid lg:grid-cols-[minmax(0,1.2fr)_170px_120px_145px_140px] lg:items-center lg:gap-3`}
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-slate-950">{job.title}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{job.level || 'Chưa có cấp bậc'} · {job.location || 'Chưa có địa điểm'}</p>
                  {visibilityState.isBlocked ? (
                    <p className="mt-1 truncate text-[11px] font-bold text-rose-700">{visibilityState.label}</p>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:contents">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-700">{job.company?.company_name || 'Chưa có doanh nghiệp'}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400">{job.company?.verified ? 'Đã xác minh' : 'Chờ xác minh'}</p>
                  </div>
                  <span className={`${listBadgeClassName} ${jobStatusToneMap[job.status] || jobStatusToneMap.draft}`}>
                    {jobStatusLabelMap[job.status] || job.status || 'Chưa rõ'}
                  </span>
                  <span className={`${listBadgeClassName} ${moderationToneMap[job.moderation_status] || moderationToneMap.active}`}>
                    {moderationLabelMap[job.moderation_status] || 'Được phép hiển thị'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-0">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(job._id)}
                    className={`${listActionClassName} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
                  >
                    Xem
                  </button>
                  <Link
                    to={buildPromotionLink(job)}
                    className={`${listActionClassName} border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100`}
                  >
                    Quảng cáo
                  </Link>
                </div>
              </article>
            )
          })}

          {!jobs.length ? (
            <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
              {loading ? 'Đang tải danh sách tin tuyển dụng...' : 'Không tìm thấy tin tuyển dụng phù hợp.'}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Trang {pagination.page || 1}/{pagination.total_pages || 1} · Tổng {pagination.total || jobs.length} tin tuyển dụng
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) - 1 }))}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) + 1 }))}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </section>

        <AdminDrawer open={Boolean(selectedJob) || detailLoading} onClose={() => { setSelectedJob(null); setDetailLoading(false); setBlockedReason('') }} title="Chi tiết tin tuyển dụng" subtitle={detailLoading ? 'Đang tải dữ liệu tin tuyển dụng...' : selectedJob?.company?.company_name || 'Kiểm duyệt và thông tin tin tuyển dụng'} wide>
          {detailLoading || !selectedJob ? (
            <div className="flex min-h-[360px] items-center justify-center text-sm font-semibold text-slate-400">Đang tải chi tiết...</div>
          ) : (
            <div className="p-4">
              <h3 className="text-lg font-extrabold leading-6 text-slate-950">{selectedJob.title}</h3>
              <p className="mt-1 text-[12px] font-medium text-slate-500">{selectedJob.company?.company_name || 'Chưa có doanh nghiệp'}</p>
              <div className={`mt-3 rounded-md border px-3 py-2 text-[12px] font-semibold leading-5 ${selectedVisibilityState.tone}`}>
                {selectedVisibilityState.description}
                {selectedVisibilityState.isBlocked && selectedJob.blocked_reason ? (
                  <p className="mt-1 font-bold">Lý do chặn: {selectedJob.blocked_reason}</p>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold ${jobStatusToneMap[selectedJob.status] || jobStatusToneMap.draft}`}>
                  {jobStatusLabelMap[selectedJob.status] || selectedJob.status || 'Chưa rõ'}
                </span>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold ${moderationToneMap[selectedJob.moderation_status] || moderationToneMap.active}`}>
                  {moderationLabelMap[selectedJob.moderation_status] || 'Được phép hiển thị'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-600">{jobTypeLabelMap[selectedJob.job_type] || selectedJob.job_type || 'Chưa có hình thức'}</span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Mã tin" value={compactId(selectedJob._id, { prefix: 7, suffix: 5 })} />
                <Field label="Danh mục" value={formatJobCategories(selectedJob)} />
                <Field label="Cấp bậc" value={selectedJob.level} />
                <Field label="Số lượng" value={selectedJob.quantity} />
                <Field label="Lương" value={formatMoneyRange(selectedJob.salary)} />
                <Field label="Hạn nộp" value={formatDate(selectedJob.expired_at)} />
                <Field label="Đăng tuyển" value={formatDate(selectedJob.published_at)} />
                <Field label="Cập nhật" value={formatDate(selectedJob.updated_at)} />
              </div>

              {Array.isArray(selectedJob.skills) && selectedJob.skills.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedJob.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{skill}</span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                <ParagraphBlock title="Mô tả" value={selectedJob.description} />
                <ParagraphBlock title="Yêu cầu" value={selectedJob.requirements} />
                <ParagraphBlock title="Quyền lợi" value={selectedJob.benefits} />
              </div>

              <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Lý do chặn</p>
                <textarea
                  value={blockedReason}
                  onChange={(event) => setBlockedReason(event.target.value)}
                  rows="3"
                  className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  placeholder="Nhập lý do nếu cần chặn tin tuyển dụng..."
                />
                {selectedJob.blocked_at ? <p className="mt-1 text-[11px] font-semibold text-slate-400">Đã chặn ngày {formatDate(selectedJob.blocked_at)}</p> : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={updatingModeration || selectedJob.moderation_status === 'active'}
                  onClick={() => handleModeration('active')}
                  className="h-9 rounded-md bg-slate-900 px-3 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Mở hiển thị
                </button>
                <button
                  type="button"
                  disabled={updatingModeration || selectedJob.moderation_status === 'blocked'}
                  onClick={() => handleModeration('blocked')}
                  className="h-9 rounded-md border border-rose-200 bg-rose-50 px-3 text-[12px] font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Chặn tin
                </button>
              </div>
              <Link
                to={buildPromotionLink(selectedJob)}
                className="mt-2 flex h-9 items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-3 text-[12px] font-extrabold text-teal-700 transition hover:bg-teal-100"
              >
                Quản lý quảng cáo của tin này
              </Link>
            </div>
          )}
        </AdminDrawer>
      </section>
    </AdminLayout>
  )
}
