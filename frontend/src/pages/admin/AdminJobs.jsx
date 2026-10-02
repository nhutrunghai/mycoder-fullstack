import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.jsx'
import Toast from '../../components/Toast.jsx'
import {
  getAdminJobApplications,
  getAdminJobDetail,
  getAdminJobs,
  updateAdminJobModerationStatus,
} from '../../api/adminService.js'
import { compactId, formatDateVi as formatDate } from '../../utils/formatters.js'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

const jobStatusLabelMap = {
  draft: 'Bản nháp',
  open: 'Đang tuyển',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
  expired: 'Hết hạn',
}

const jobStatusToneMap = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  paused: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  closed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  draft: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/10',
}

const moderationLabelMap = {
  active: 'Công khai',
  blocked: 'Đã bị chặn',
}

const jobTypeLabelMap = {
  'full-time': 'Toàn thời gian',
  'part-time': 'Bán thời gian',
  internship: 'Thực tập',
  contract: 'Hợp đồng',
  remote: 'Từ xa',
}

const levelLabelMap = {
  intern: 'Thực tập sinh',
  fresher: 'Mới đi làm (Fresher)',
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  lead: 'Trưởng nhóm (Lead)',
  manager: 'Quản lý (Manager)',
  director: 'Giám đốc',
}

const applicationStatusLabelMap = {
  submitted: 'Đã nộp',
  reviewing: 'Đang xem',
  shortlisted: 'Chọn lọc',
  interviewing: 'Phỏng vấn',
  hired: 'Trúng tuyển',
  rejected: 'Từ chối',
  withdrawn: 'Đã rút',
}

const applicationStatusToneMap = {
  submitted: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  reviewing: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  shortlisted: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  interviewing: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  hired: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  withdrawn: 'bg-slate-100 text-slate-600 ring-slate-500/10',
}

function formatSalary(salary) {
  if (!salary || typeof salary !== 'object') return 'Thỏa thuận'
  if (salary.is_negotiable && salary.min == null && salary.max == null) return 'Thỏa thuận'

  const unit = salary.currency === 'USD' ? 'USD' : 'VNĐ'
  const formatAmount = (value) => {
    if (typeof value !== 'number') return null
    if (salary.currency === 'USD') return value.toLocaleString('en-US')
    if (value >= 1000000) return `${Math.round(value / 1000000)} triệu`
    return value.toLocaleString('vi-VN')
  }

  const min = formatAmount(salary.min)
  const max = formatAmount(salary.max)

  if (min && max) return `${min} - ${max} ${unit}`
  if (min) return `Từ ${min} ${unit}`
  if (max) return `Đến ${max} ${unit}`
  return 'Thỏa thuận'
}

function formatJobCategories(job) {
  if (Array.isArray(job?.category_names) && job.category_names.length) return job.category_names.join(', ')
  if (Array.isArray(job?.categories) && job.categories.length) {
    return job.categories.map((item) => (typeof item === 'string' ? item : item?.name || item?.slug)).filter(Boolean).join(', ')
  }
  return ''
}

function PropertyRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 text-xs">
      <span className="text-slate-500 font-medium shrink-0">{label}</span>
      <span className={`text-slate-900 text-right ${mono ? 'font-mono' : 'font-medium'} break-all`}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function AdminJobs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const companyIdParam = searchParams.get('companyId') || searchParams.get('company_id') || ''

  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [moderationStatus, setModerationStatus] = useState('')
  const [stats, setStats] = useState({ total: 0, open: 0, paused: 0, blocked: 0 })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('content') // 'content' | 'applications'
  const [jobApplications, setJobApplications] = useState([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    targetJob: null,
    targetStatus: null, // 'active' | 'blocked'
    title: '',
    description: '',
    confirmLabel: 'Xác nhận',
    tone: 'danger',
  })
  const [blockReasonInput, setBlockReasonInput] = useState('')
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
        companyId: companyIdParam || undefined,
      })
        .then((data) => {
          if (!active) return
          setJobs(data?.jobs ?? [])
          if (data?.stats) {
            setStats(data.stats)
          }
          setPagination((current) => ({ ...current, ...(data?.pagination || {}) }))
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
  }, [keyword, status, moderationStatus, companyIdParam, pagination.page, pagination.limit])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [keyword, status, moderationStatus, companyIdParam])

  const handleOpenDetail = async (jobId) => {
    setDrawerOpen(true)
    setSelectedJob(null)
    setJobApplications([])
    setActiveTab('content')
    setDetailLoading(true)
    try {
      const detailRes = await getAdminJobDetail(jobId)
      const detail = detailRes?.data || detailRes
      setSelectedJob(detail)

      // Fetch applications in background
      getAdminJobApplications(jobId, { limit: 50 })
        .then((appsRes) => {
          const appsData = appsRes?.data || appsRes
          setJobApplications(appsData?.applications || [])
        })
        .catch(() => {})
    } catch (error) {
      setDrawerOpen(false)
      setToast({ type: 'error', message: error.message || 'Không thể tải chi tiết tin tuyển dụng.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSwitchTab = (tab) => {
    setActiveTab(tab)
    if (tab === 'applications' && selectedJob && !jobApplications.length && !applicationsLoading) {
      setApplicationsLoading(true)
      getAdminJobApplications(selectedJob._id, { limit: 50 })
        .then((appsRes) => {
          const appsData = appsRes?.data || appsRes
          setJobApplications(appsData?.applications || [])
        })
        .catch(() => {})
        .finally(() => setApplicationsLoading(false))
    }
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedJob(null)
    setJobApplications([])
    setActiveTab('content')
  }

  const handlePromptModeration = (job, nextStatus) => {
    setBlockReasonInput(nextStatus === 'blocked' ? (job.blocked_reason || '') : '')
    setConfirmDialog({
      open: true,
      targetJob: job,
      targetStatus: nextStatus,
      title: nextStatus === 'blocked' ? 'Chặn tin tuyển dụng' : 'Mở khóa hiển thị tin tuyển dụng',
      description: nextStatus === 'blocked'
        ? 'Tin tuyển dụng sẽ bị ẩn khỏi toàn bộ trang tìm kiếm việc làm công khai và ứng viên không thể nộp đơn.'
        : 'Tin tuyển dụng sẽ được hiển thị công khai trở lại trên trang tìm việc làm.',
      confirmLabel: nextStatus === 'blocked' ? 'Xác nhận chặn tin' : 'Xác nhận mở khóa',
      tone: nextStatus === 'blocked' ? 'danger' : 'primary',
    })
  }

  const handleConfirmModeration = async () => {
    const { targetJob, targetStatus } = confirmDialog
    if (!targetJob || !targetStatus) return

    if (targetStatus === 'blocked' && !blockReasonInput.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập lý do chặn tin tuyển dụng.' })
      return
    }

    setUpdatingModeration(true)
    try {
      const reason = targetStatus === 'blocked' ? blockReasonInput.trim() : ''
      const result = await updateAdminJobModerationStatus(targetJob._id, {
        moderation_status: targetStatus,
        blocked_reason: reason || undefined,
      })
      const updatedStatus = result?.data?.moderation_status || targetStatus
      const updatedReason = result?.data?.blocked_reason || reason
      const updatedAt = result?.data?.updated_at || new Date().toISOString()

      // Update in table
      setJobs((current) => current.map((j) => (
        String(j._id) === String(targetJob._id)
          ? { ...j, moderation_status: updatedStatus, blocked_reason: updatedReason, updated_at: updatedAt }
          : j
      )))

      // Update in drawer if open
      if (selectedJob && String(selectedJob._id) === String(targetJob._id)) {
        setSelectedJob((prev) => ({
          ...prev,
          moderation_status: updatedStatus,
          blocked_reason: updatedReason,
          updated_at: updatedAt,
        }))
      }

      // Update stats
      setStats((prev) => ({
        ...prev,
        blocked: targetStatus === 'blocked' ? prev.blocked + 1 : Math.max(0, prev.blocked - 1),
      }))

      setToast({
        type: 'success',
        message: targetStatus === 'blocked'
          ? 'Đã chặn tin tuyển dụng khỏi hiển thị công khai.'
          : 'Đã mở khóa hiển thị cho tin tuyển dụng.',
      })
      setConfirmDialog((prev) => ({ ...prev, open: false }))
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật trạng thái kiểm duyệt.' })
    } finally {
      setUpdatingModeration(false)
    }
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)
﻿
  return (
    <AdminLayout
      title="Quản lý tin tuyển dụng"
      subtitle="Kiểm duyệt nội dung việc làm, theo dõi trạng thái hiển thị và phát hiện vi phạm."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Đang tuyển dụng', stats.open, 'text-emerald-700 bg-emerald-50'],
          ['Bị chặn / Vi phạm', stats.blocked, 'text-rose-700 bg-rose-50'],
          ['Tạm dừng tuyển', stats.paused, 'text-amber-700 bg-amber-50'],
          ['Tổng số tin', stats.total, 'text-indigo-700 bg-indigo-50'],
        ].map(([label, value, badgeStyle]) => (
          <div key={label} className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-900">{value}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badgeStyle}`}>
                Toàn hệ thống
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Filter & Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={companyIdParam ? `Tìm trong các tin của ${location.state?.companyName || 'công ty này'}...` : 'Tìm theo tiêu đề tin, doanh nghiệp hoặc địa điểm...'}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="open">Đang tuyển</option>
            <option value="paused">Tạm dừng</option>
            <option value="closed">Đã đóng</option>
            <option value="draft">Bản nháp</option>
            <option value="expired">Hết hạn</option>
          </select>
          <select
            value={moderationStatus}
            onChange={(event) => setModerationStatus(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả kiểm duyệt</option>
            <option value="active">Hiển thị công khai</option>
            <option value="blocked">Đã bị chặn</option>
          </select>
        </div>

        {companyIdParam ? (
          <div className="mt-3 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span className="material-symbols-outlined text-[15px] text-indigo-500">apartment</span>
            <span>
              Đang lọc theo công ty: <strong>{location.state?.companyName || (companyIdParam ? 'Công ty #' + companyIdParam.slice(-6) : '')}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('companyId')
                  next.delete('company_id')
                  return next
                }, { replace: true })
              }}
              title="Hủy lọc theo công ty"
              className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-indigo-200/60 text-indigo-600 transition ml-1 font-bold"
            >
              ✕
            </button>
          </div>
        ) : null}
      </section>

      {/* Main Data Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Tin tuyển dụng</th>
                <th className="py-3 px-4">Mức lương & Hình thức</th>
                <th className="py-3 px-4">Trạng thái tuyển</th>
                <th className="py-3 px-4">Kiểm duyệt</th>
                <th className="py-3 px-4">Ngày đăng</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job._id} className="hover:bg-slate-50/70 transition">
                  {/* Job Title + Company */}
                  <td className="py-3 px-4">
                    <div className="min-w-0 max-w-sm">
                      <p className="font-semibold text-slate-900 truncate">{job.title}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {job.company?._id ? (
                          <Link
                            to={`/admin/companies?companyId=${job.company._id}`}
                            state={{ companyName: job.company.company_name }}
                            className="font-medium text-slate-600 hover:text-indigo-600 hover:underline"
                          >
                            {job.company.company_name}
                          </Link>
                        ) : (
                          job.company?.company_name || 'Doanh nghiệp'
                        )}
                        {' · '}
                        <span>{job.location || 'Toàn quốc'}</span>
                      </p>
                    </div>
                  </td>

                  {/* Salary & Type */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <p className="text-slate-900 font-medium">{formatSalary(job.salary)}</p>
                    <p className="text-[11px] text-slate-500">{jobTypeLabelMap[job.job_type] || job.job_type || 'Toàn thời gian'}</p>
                  </td>

                  {/* Recruitment Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${jobStatusToneMap[job.status] || 'bg-slate-100 text-slate-600'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {jobStatusLabelMap[job.status] || job.status}
                    </span>
                  </td>

                  {/* Moderation Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
                      job.moderation_status === 'blocked'
                        ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    }`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {moderationLabelMap[job.moderation_status] || 'Công khai'}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {formatDate(job.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(job._id)}
                        className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        <span>Chi tiết</span>
                      </button>
                      {job.moderation_status === 'blocked' ? (
                        <button
                          type="button"
                          onClick={() => handlePromptModeration(job, 'active')}
                          className="inline-flex h-7 w-[64px] items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          <span className="material-symbols-outlined text-[14px]">lock_open</span>
                          <span>Mở</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePromptModeration(job, 'blocked')}
                          className="inline-flex h-7 w-[64px] items-center justify-center gap-1 rounded-md border border-rose-200 bg-rose-50 text-[11px] font-medium text-rose-700 hover:bg-rose-100 transition"
                        >
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          <span>Chặn</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!jobs.length ? (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải danh sách tin tuyển dụng...' : 'Không tìm thấy tin tuyển dụng nào.'}
            </div>
          ) : null}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between bg-slate-50/40">
          <span>
            Trang <strong className="text-slate-900 font-semibold">{pagination.page || 1}</strong> / {pagination.total_pages || 1} · Tổng <strong className="text-slate-900 font-semibold">{pagination.total || jobs.length}</strong> tin tuyển dụng
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) - 1 }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) + 1 }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>

      {/* Job Detail & Moderation Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Kiểm duyệt tin tuyển dụng"
        subtitle={detailLoading ? 'Đang tải thông tin...' : selectedJob?.title}
        wide
      >
        {detailLoading || !selectedJob ? (
          <div className="py-12 text-center text-xs text-slate-400">Đang tải thông tin tin tuyển dụng...</div>
        ) : (
          <div className="space-y-5">
            {/* Header: Company & Job Overview */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-700 font-bold text-sm ring-1 ring-slate-200">
                    {toSafeImageUrl(selectedJob.company?.logo) ? (
                      <img src={toSafeImageUrl(selectedJob.company.logo)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (selectedJob.company?.company_name || 'C').slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate text-sm">
                      {selectedJob.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                      {selectedJob.company?._id ? (
                        <Link
                          to={`/admin/companies?companyId=${selectedJob.company._id}`}
                          state={{ companyName: selectedJob.company.company_name }}
                          className="font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>{selectedJob.company.company_name}</span>
                          {selectedJob.company.verified ? (
                            <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                          ) : null}
                        </Link>
                      ) : (
                        <span>{selectedJob.company?.company_name || 'Doanh nghiệp'}</span>
                      )}
                      <span>·</span>
                      <span className="text-slate-500">{selectedJob.location || 'Toàn quốc'}</span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/viec-lam/${selectedJob.slug || selectedJob._id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  <span>Xem tin gốc</span>
                </Link>
              </div>

              {/* Status and Moderation Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${jobStatusToneMap[selectedJob.status] || 'bg-slate-100 text-slate-600'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {jobStatusLabelMap[selectedJob.status] || selectedJob.status}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
                  selectedJob.moderation_status === 'blocked'
                    ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {moderationLabelMap[selectedJob.moderation_status] || 'Công khai'}
                </span>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => handleSwitchTab('content')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'content'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span>Nội dung & Kiểm duyệt</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchTab('applications')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'applications'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                <span>Hồ sơ ứng tuyển ({jobApplications.length})</span>
              </button>
            </div>

            {/* TAB 1: Content & Moderation */}
            {activeTab === 'content' && (
              <div className="space-y-5">
                {/* Moderation Action Box */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Hành động kiểm duyệt quản trị
                    </h4>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${
                      selectedJob.moderation_status === 'blocked'
                        ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    }`}>
                      {selectedJob.moderation_status === 'blocked' ? 'Đang bị chặn' : 'Đang hiển thị công khai'}
                    </span>
                  </div>

                  {selectedJob.moderation_status === 'blocked' && (
                    <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3 text-xs space-y-1">
                      <p className="font-semibold text-rose-900">Lý do chặn hiển thị:</p>
                      <p className="text-rose-700 leading-relaxed">{selectedJob.blocked_reason || 'Nội dung vi phạm quy định sàn tuyển dụng.'}</p>
                      {selectedJob.blocked_at && (
                        <p className="text-[10px] text-rose-500 pt-1">
                          Thời gian chặn: {formatDate(selectedJob.blocked_at)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    {selectedJob.moderation_status === 'blocked' ? (
                      <button
                        type="button"
                        onClick={() => handlePromptModeration(selectedJob, 'active')}
                        className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-600/20"
                      >
                        <span className="material-symbols-outlined text-[15px]">lock_open</span>
                        <span>Mở khóa / Cho phép hiển thị</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePromptModeration(selectedJob, 'blocked')}
                        className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-rose-600 px-3.5 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-sm shadow-rose-600/20"
                      >
                        <span className="material-symbols-outlined text-[15px]">block</span>
                        <span>Chặn tin tuyển dụng</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Job Specifications */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Thông số tuyển dụng
                  </h4>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white px-3.5 shadow-2xs">
                    <PropertyRow label="Mã tin (ID)" value={selectedJob._id} mono />
                    <PropertyRow label="Mức lương" value={formatSalary(selectedJob.salary)} />
                    <PropertyRow label="Hình thức làm việc" value={jobTypeLabelMap[selectedJob.job_type] || selectedJob.job_type} />
                    <PropertyRow label="Cấp bậc" value={levelLabelMap[selectedJob.level] || selectedJob.level} />
                    <PropertyRow label="Số lượng tuyển" value={selectedJob.quantity ? `${selectedJob.quantity} người` : 'Không giới hạn'} />
                    <PropertyRow label="Danh mục nghề" value={formatJobCategories(selectedJob)} />
                    <PropertyRow label="Hạn nộp hồ sơ" value={selectedJob.expired_at ? formatDate(selectedJob.expired_at) : 'Không thời hạn'} mono />
                    <PropertyRow label="Ngày tạo tin" value={formatDate(selectedJob.created_at)} mono />
                  </div>
                </div>

                {/* Skills Required */}
                {Array.isArray(selectedJob.skills) && selectedJob.skills.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Kỹ năng yêu cầu
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.skills.map((skill, index) => (
                        <span key={index} className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Job Description */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Mô tả công việc
                  </h4>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                    <div className="whitespace-pre-line text-xs text-slate-700 leading-relaxed">
                      {selectedJob.description || 'Chưa có thông tin mô tả công việc.'}
                    </div>
                  </div>
                </div>

                {/* Job Requirements */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Yêu cầu ứng viên
                  </h4>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                    <div className="whitespace-pre-line text-xs text-slate-700 leading-relaxed">
                      {selectedJob.requirements || 'Chưa có thông tin yêu cầu ứng viên.'}
                    </div>
                  </div>
                </div>

                {/* Job Benefits */}
                {selectedJob.benefits && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Quyền lợi được hưởng
                    </h4>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                      <div className="whitespace-pre-line text-xs text-slate-700 leading-relaxed">
                        {selectedJob.benefits}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Applications */}
            {activeTab === 'applications' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Danh sách hồ sơ nộp ({jobApplications.length})
                  </h4>
                </div>

                {applicationsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400">Đang tải danh sách hồ sơ...</div>
                ) : jobApplications.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
                    {jobApplications.map((app) => (
                      <div key={app._id} className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs overflow-hidden">
                            {toSafeImageUrl(app.candidate?.avatar) ? (
                              <img src={toSafeImageUrl(app.candidate.avatar)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              (app.candidate?.fullName || 'U').slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {app.candidate?.fullName || 'Ứng viên'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {app.candidate?.email || 'Chưa có email'} · Nộp lúc: {formatDate(app.applied_at)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${
                            applicationStatusToneMap[app.status] || 'bg-slate-100 text-slate-600'
                          }`}>
                            {applicationStatusLabelMap[app.status] || app.status}
                          </span>
                          {app.candidate?._id && (
                            <Link
                              to={`/admin/users?userId=${app.candidate._id}`}
                              state={{ userPreview: app.candidate }}
                              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-indigo-600 hover:underline"
                            >
                              <span>Hồ sơ</span>
                              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                    Chưa có ứng viên nào nộp hồ sơ vào tin tuyển dụng này.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AdminDrawer>

      {/* Moderation Confirm Dialog */}
      <AdminConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmModeration}
        title={confirmDialog.title}
        confirmLabel={confirmDialog.confirmLabel}
        confirming={updatingModeration}
        tone={confirmDialog.tone}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            {confirmDialog.description}
          </p>

          {confirmDialog.targetStatus === 'blocked' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Lý do chặn hiển thị <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="Nhập lý do vi phạm (ví dụ: Tin tuyển dụng có dấu hiệu lừa đảo, vi phạm pháp luật hoặc thông tin sai lệch)..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
              />
            </div>
          )}
        </div>
      </AdminConfirmDialog>
    </AdminLayout>
  )
}
