import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.jsx'
import Toast from '../../components/Toast.jsx'
import {
  createAdminJobPromotion,
  deleteAdminJobPromotion,
  getAdminJobPromotionPlans,
  getAdminJobPromotions,
  getAdminJobs,
  updateAdminJobPromotion,
} from '../../api/adminService.js'
import { formatDateTimeVi as formatDate } from '../../utils/formatters.js'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

const statusLabelMap = {
  active: 'Đang hiển thị',
  scheduled: 'Đã lên lịch',
  expired: 'Đã hết hạn',
  cancelled: 'Đã hủy',
}

const statusToneMap = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  scheduled: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

const formatMoney = (value, currency = 'VND') =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(Number(value || 0))

function datetimeLocal(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function emptyCreateForm() {
  const start = new Date(Date.now() + 10 * 60 * 1000)
  const end = new Date(start.getTime() + 7 * 86400000)
  return {
    jobId: '',
    plan_id: '',
    starts_at: datetimeLocal(start),
    ends_at: datetimeLocal(end),
  }
}

function getTimeProgress(startsAt, endsAt) {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
}

function getTimeRemainingText(status, startsAt, endsAt) {
  if (status === 'cancelled') return 'Đã dừng trước hạn'
  if (status === 'expired') return 'Đã hoàn thành thời hạn'
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()

  if (status === 'scheduled' || now < start) {
    const diffHours = Math.max(1, Math.round((start - now) / (1000 * 60 * 60)))
    if (diffHours < 24) return `Bắt đầu sau ${diffHours} giờ`
    const days = Math.round(diffHours / 24)
    return `Bắt đầu sau ${days} ngày`
  }

  const diffMs = end - now
  if (diffMs <= 0) return 'Vừa hết hạn'
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffHours / 24)
  const remainingHours = diffHours % 24

  if (days > 0) {
    return remainingHours > 0 ? `Còn ${days} ngày ${remainingHours}h` : `Còn ${days} ngày`
  }
  return `Còn ${diffHours} giờ`
}

export default function AdminJobPromotions() {
  const [searchParams, setSearchParams] = useSearchParams()

  const jobIdParam = searchParams.get('jobId') || ''
  const companyIdParam = searchParams.get('companyId') || ''
  const planIdParam = searchParams.get('planId') || ''

  const [promotions, setPromotions] = useState([])
  const [plans, setPlans] = useState([])
  const [openJobs, setOpenJobs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, total_pages: 1 })
  const [summaryStats, setSummaryStats] = useState(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState(planIdParam)
  const [keyword, setKeyword] = useState('')

  const [selectedPromotion, setSelectedPromotion] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [jobSearchTerm, setJobSearchTerm] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: '',
    tone: 'danger',
    action: null,
  })

  const loadPromotions = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const data = await getAdminJobPromotions({
        page,
        limit: 15,
        status: statusFilter || undefined,
        planId: planFilter || undefined,
        jobId: jobIdParam || undefined,
        companyId: companyIdParam || undefined,
        keyword: keyword.trim() || undefined,
      })

      const list = data?.promotions || data?.data?.promotions || []
      setPromotions(list)
      if (data?.pagination || data?.data?.pagination) {
        setPagination(data.pagination || data.data.pagination)
      }
      if (data?.summary || data?.data?.summary) {
        setSummaryStats(data.summary || data.data.summary)
      }
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải danh sách quảng cáo.' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, planFilter, jobIdParam, companyIdParam, keyword])

  useEffect(() => {
    const fetchSupplementary = async () => {
      try {
        const [planRes, jobRes] = await Promise.all([
          getAdminJobPromotionPlans(),
          getAdminJobs({ page: 1, limit: 100 }),
        ])
        setPlans(planRes?.plans || planRes?.data?.plans || [])
        const jobsList = jobRes?.jobs || jobRes?.data?.jobs || []
        setOpenJobs(jobsList.filter((j) => j.status === 'open' && j.moderation_status !== 'blocked'))
      } catch {
        // ignore
      }
    }
    fetchSupplementary()
  }, [])

  useEffect(() => {
    loadPromotions(1)
  }, [loadPromotions])

  const stats = useMemo(() => {
    if (summaryStats) {
      return {
        active: summaryStats.active ?? 0,
        scheduled: summaryStats.scheduled ?? 0,
        ended: (summaryStats.expired ?? 0) + (summaryStats.cancelled ?? 0),
        totalRevenue: summaryStats.total_revenue ?? 0,
      }
    }
    return {
      active: promotions.filter((p) => p.status === 'active').length,
      scheduled: promotions.filter((p) => p.status === 'scheduled').length,
      ended: promotions.filter((p) => ['expired', 'cancelled'].includes(p.status)).length,
      totalRevenue: promotions.reduce((acc, p) => acc + (Number(p.amount_paid) || 0), 0),
    }
  }, [summaryStats, promotions])

  const filteredJobsForCreate = useMemo(() => {
    if (!jobSearchTerm.trim()) return openJobs
    const term = jobSearchTerm.toLowerCase()
    return openJobs.filter(
      (j) =>
        (j.title || '').toLowerCase().includes(term) ||
        (j.company_name || '').toLowerCase().includes(term)
    )
  }, [openJobs, jobSearchTerm])

  const handleClearUrlFilter = (key) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete(key)
    setSearchParams(nextParams)
  }

  const handleOpenCreateModal = () => {
    setCreateForm(emptyCreateForm())
    setJobSearchTerm('')
    setCreateModalOpen(true)
  }

  const handleSelectPlan = (planId) => {
    const selectedPlan = plans.find((p) => String(p._id) === String(planId))
    const start = new Date(Date.now() + 10 * 60 * 1000)
    const durationDays = selectedPlan?.min_duration_days || 7
    const end = new Date(start.getTime() + durationDays * 86400000)

    setCreateForm((prev) => ({
      ...prev,
      plan_id: planId,
      starts_at: datetimeLocal(start),
      ends_at: datetimeLocal(end),
    }))
  }

  const handleSaveCreate = async (e) => {
    e.preventDefault()
    if (!createForm.jobId) {
      setToast({ type: 'error', message: 'Vui lòng chọn tin tuyển dụng cần cấp quảng cáo.' })
      return
    }
    if (!createForm.plan_id) {
      setToast({ type: 'error', message: 'Vui lòng chọn gói quảng cáo dịch vụ.' })
      return
    }
    if (new Date(createForm.starts_at) >= new Date(createForm.ends_at)) {
      setToast({ type: 'error', message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' })
      return
    }

    setSaving(true)
    try {
      await createAdminJobPromotion({
        jobId: createForm.jobId,
        plan_id: createForm.plan_id,
        starts_at: new Date(createForm.starts_at).toISOString(),
        ends_at: new Date(createForm.ends_at).toISOString(),
      })
      setToast({ type: 'success', message: 'Đã cấp gói quảng cáo đặc cách thành công.' })
      setCreateModalOpen(false)
      await loadPromotions(1)
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cấp gói quảng cáo.' })
    } finally {
      setSaving(false)
    }
  }

  const handlePromptCancel = (promo) => {
    setConfirmDialog({
      open: true,
      title: 'Dừng chiến dịch quảng cáo',
      description: `Bạn có chắc chắn muốn dừng hiển thị sớm chiến dịch quảng cáo cho tin "${promo.job?.title}"? Tin sẽ lập tức bị gỡ khỏi khu vực nổi bật.`,
      confirmLabel: 'Dừng chiến dịch',
      tone: 'danger',
      action: async () => {
        try {
          await updateAdminJobPromotion(promo._id, { status: 'cancelled' })
          setToast({ type: 'success', message: 'Đã dừng chiến dịch quảng cáo thành công.' })
          if (selectedPromotion?._id === promo._id) {
            setSelectedPromotion((prev) => ({ ...prev, status: 'cancelled' }))
          }
          await loadPromotions(pagination.page)
        } catch (error) {
          setToast({ type: 'error', message: error.message || 'Không thể dừng chiến dịch.' })
        }
      },
    })
  }

  const handlePromptDelete = (promo) => {
    if (promo.source === 'employer_purchase' || Number(promo.amount_paid) > 0) {
      setToast({
        type: 'warning',
        message: 'Không thể xóa chiến dịch đã trừ tiền ví doanh nghiệp. Hãy chọn "Dừng" để lưu vết giao dịch.',
      })
      return
    }

    setConfirmDialog({
      open: true,
      title: 'Xóa chiến dịch thử nghiệm',
      description: 'Xóa vĩnh viễn chiến dịch quảng cáo được cấp đặc cách này? Thao tác này không thể hoàn tác.',
      confirmLabel: 'Xóa vĩnh viễn',
      tone: 'danger',
      action: async () => {
        try {
          await deleteAdminJobPromotion(promo._id)
          setToast({ type: 'success', message: 'Đã xóa chiến dịch thành công.' })
          setDrawerOpen(false)
          await loadPromotions(pagination.page)
        } catch (error) {
          setToast({ type: 'error', message: error.message || 'Không thể xóa chiến dịch.' })
        }
      },
    })
  }

  const handleOpenDetail = (promo) => {
    setSelectedPromotion(promo)
    setDrawerOpen(true)
  }

  return (
    <AdminLayout
      title="Quảng cáo tuyển dụng"
      subtitle="Quản lý và kiểm duyệt các chiến dịch ghim tin nổi bật, thời hạn hiển thị và nguồn gốc kích hoạt."
      actions={
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span>Cấp quảng cáo đặc cách</span>
        </button>
      }
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Đang hiển thị</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-emerald-600">{stats.active}</p>
          <p className="mt-1 text-[11px] text-slate-400">Tin đang ghim nổi bật</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Đã lên lịch</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-sky-600">{stats.scheduled}</p>
          <p className="mt-1 text-[11px] text-slate-400">Sắp bắt đầu hiển thị</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Đã kết thúc / Hủy</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <span className="material-symbols-outlined text-[16px]">history</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-700">{stats.ended}</p>
          <p className="mt-1 text-[11px] text-slate-400">Hết hạn hoặc dừng sớm</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Doanh thu quảng cáo</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[16px]">payments</span>
            </span>
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold text-slate-900 font-mono">
            {formatMoney(stats.totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Từ gói nạp ví nhà tuyển dụng</p>
        </div>
      </section>

      {/* Active Filter Tags from URL */}
      {(jobIdParam || companyIdParam || planIdParam) && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs text-indigo-900">
          <span className="font-semibold text-indigo-700">Đang lọc theo liên kết:</span>

          {jobIdParam && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700 border border-indigo-200">
              <span>Tin: {jobIdParam.slice(-8)}</span>
              <button
                type="button"
                onClick={() => handleClearUrlFilter('jobId')}
                className="text-slate-400 hover:text-rose-600 transition"
                title="Bỏ lọc tin này"
              >
                ✕
              </button>
            </span>
          )}

          {companyIdParam && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700 border border-indigo-200">
              <span>Doanh nghiệp: {companyIdParam.slice(-8)}</span>
              <button
                type="button"
                onClick={() => handleClearUrlFilter('companyId')}
                className="text-slate-400 hover:text-rose-600 transition"
                title="Bỏ lọc công ty này"
              >
                ✕
              </button>
            </span>
          )}

          {planIdParam && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700 border border-indigo-200">
              <span>Gói: {plans.find((p) => p._id === planIdParam)?.name || planIdParam.slice(-8)}</span>
              <button
                type="button"
                onClick={() => {
                  setPlanFilter('')
                  handleClearUrlFilter('planId')
                }}
                className="text-slate-400 hover:text-rose-600 transition"
                title="Bỏ lọc gói này"
              >
                ✕
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setPlanFilter('')
              setSearchParams({})
            }}
            className="text-[11px] font-semibold text-indigo-600 underline hover:text-indigo-800 ml-1"
          >
            Xóa tất cả bộ lọc
          </button>
        </section>
      )}

      {/* Filter & Search Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <span
              aria-hidden="true"
              className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400"
            >
              search
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề tin tuyển dụng..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
            />
          </div>

          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hiển thị</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="expired">Đã hết hạn</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          <div className="w-full sm:w-52">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="">Tất cả gói quảng cáo</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Promotions Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Tin tuyển dụng & Doanh nghiệp</th>
                <th className="py-3 px-4">Gói quảng cáo</th>
                <th className="py-3 px-4">Thời hạn hiển thị</th>
                <th className="py-3 px-4">Nguồn & Chi phí</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promotions.map((promo) => {
                const planName = promo.plan_snapshot?.name || promo.plan?.name || 'Gói quảng cáo'
                const planCode = promo.plan_snapshot?.code || promo.plan?.code || ''
                const priority = promo.priority || promo.plan_snapshot?.default_priority || 0
                const isPaid = promo.source === 'employer_purchase' || Number(promo.amount_paid) > 0
                const canCancel = ['active', 'scheduled'].includes(promo.status)

                return (
                  <tr key={promo._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate" title={promo.job?.title}>
                          {promo.job?.title || 'Tin đã xóa'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          {toSafeImageUrl(promo.company?.logo) && (
                            <img
                              src={toSafeImageUrl(promo.company.logo)}
                              alt=""
                              className="h-3.5 w-3.5 rounded object-cover border border-slate-200"
                            />
                          )}
                          <span className="truncate">{promo.company?.company_name || 'Công ty ẩn danh'}</span>
                          {promo.company?.verified && (
                            <span
                              className="material-symbols-outlined text-[13px] text-blue-600"
                              title="Doanh nghiệp đã xác minh"
                            >
                              verified
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-xs">{planName}</span>
                        {planCode && (
                          <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] text-slate-500 uppercase">
                            {planCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                          <span>Priority {priority}</span>
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-[11px] text-slate-800">
                        <span>{formatDate(promo.starts_at)}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span>{formatDate(promo.ends_at)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {getTimeRemainingText(promo.status, promo.starts_at, promo.ends_at)}
                      </p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <span className="material-symbols-outlined text-[12px]">wallet</span>
                          <span>{formatMoney(promo.amount_paid, promo.currency)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <span className="material-symbols-outlined text-[12px]">shield_person</span>
                          <span>Admin kích hoạt</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
                          statusToneMap[promo.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        <span>{statusLabelMap[promo.status] || promo.status}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(promo)}
                          className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                        >
                          Chi tiết
                        </button>

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handlePromptCancel(promo)}
                            className="inline-flex h-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-medium text-rose-700 hover:bg-rose-100 transition"
                            title="Dừng chiến dịch sớm"
                          >
                            Dừng
                          </button>
                        )}

                        {!isPaid && promo.status !== 'active' && (
                          <button
                            type="button"
                            onClick={() => handlePromptDelete(promo)}
                            className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa chiến dịch thử nghiệm"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!promotions.length && (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải danh sách chiến dịch...' : 'Không tìm thấy chiến dịch quảng cáo phù hợp.'}
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between bg-slate-50/40">
          <span>
            Trang <strong className="text-slate-900 font-semibold">{pagination.page || 1}</strong> /{' '}
            {pagination.total_pages || 1} · Tổng{' '}
            <strong className="text-slate-900 font-semibold">{pagination.total || promotions.length}</strong> chiến
            dịch
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={(pagination.page || 1) <= 1 || loading}
              onClick={() => loadPromotions((pagination.page || 1) - 1)}
              className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={(pagination.page || 1) >= (pagination.total_pages || 1) || loading}
              onClick={() => loadPromotions((pagination.page || 1) + 1)}
              className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      {/* Promotion Detail Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Chi tiết chiến dịch quảng cáo"
        subtitle="Thông tin ghim tin nổi bật, nguồn thanh toán và tiến độ hiển thị."
      >
        {selectedPromotion && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${
                    statusToneMap[selectedPromotion.status] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span>{statusLabelMap[selectedPromotion.status] || selectedPromotion.status}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">ID: {selectedPromotion._id}</span>
              </div>

              <h3 className="mt-2 text-sm font-bold text-slate-900 leading-snug">
                {selectedPromotion.job?.title || 'Tin tuyển dụng'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedPromotion.company?.company_name || 'Doanh nghiệp'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Thời gian & Tiến độ hiển thị
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Bắt đầu</span>
                  <span className="font-semibold text-slate-800">{formatDate(selectedPromotion.starts_at)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Kết thúc</span>
                  <span className="font-semibold text-slate-800">{formatDate(selectedPromotion.ends_at)}</span>
                </div>
              </div>

              {selectedPromotion.status === 'active' && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Tiến độ chiến dịch</span>
                    <span className="font-semibold text-slate-700">
                      {getTimeProgress(selectedPromotion.starts_at, selectedPromotion.ends_at)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${getTimeProgress(selectedPromotion.starts_at, selectedPromotion.ends_at)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500 font-medium">
                {getTimeRemainingText(
                  selectedPromotion.status,
                  selectedPromotion.starts_at,
                  selectedPromotion.ends_at
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gói dịch vụ áp dụng</h4>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tên gói</span>
                <span className="font-semibold text-slate-900">
                  {selectedPromotion.plan_snapshot?.name || selectedPromotion.plan?.name || 'Gói quảng cáo'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Mã gói</span>
                <span className="font-mono text-slate-700">
                  {selectedPromotion.plan_snapshot?.code || selectedPromotion.plan?.code || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Điểm ưu tiên</span>
                <span className="font-mono font-semibold text-amber-700">
                  {selectedPromotion.priority || selectedPromotion.plan_snapshot?.default_priority || 0}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Đơn giá tham chiếu</span>
                <span className="font-mono text-slate-800">
                  {formatMoney(
                    selectedPromotion.plan_snapshot?.daily_price || 0,
                    selectedPromotion.currency
                  )}{' '}
                  / ngày
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Tài chính & Nguồn kích hoạt
              </h4>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Nguồn gốc</span>
                <span className="font-semibold text-slate-800">
                  {selectedPromotion.source === 'employer_purchase'
                    ? 'Nhà tuyển dụng mua qua Ví'
                    : 'Admin kích hoạt'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Số tiền thanh toán</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatMoney(selectedPromotion.amount_paid, selectedPromotion.currency)}
                </span>
              </div>

              {selectedPromotion.company_id && (
                <div className="pt-1">
                  <Link
                    to={`/admin/wallet-transactions?companyId=${selectedPromotion.company_id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
                  >
                    <span>Xem lịch sử giao dịch ví công ty này</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              {['active', 'scheduled'].includes(selectedPromotion.status) && (
                <button
                  type="button"
                  onClick={() => handlePromptCancel(selectedPromotion)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                >
                  <span className="material-symbols-outlined text-[15px]">cancel</span>
                  <span>Dừng hiển thị sớm</span>
                </button>
              )}

              {selectedPromotion.job_id && (
                <Link
                  to={`/jobs/${selectedPromotion.job_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                  <span>Xem tin công khai</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* Create / Grant Modal (Centered) */}
      <AdminModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Cấp quảng cáo đặc cách cho tin tuyển dụng"
        subtitle="Kích hoạt chiến dịch ghim tin nổi bật trên trang chủ dành riêng cho đối tác hoặc tin tuyển dụng đặc biệt."
      >
        <form onSubmit={handleSaveCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Chọn tin tuyển dụng <span className="text-rose-500">*</span>
            </label>
            <input
              value={jobSearchTerm}
              onChange={(e) => setJobSearchTerm(e.target.value)}
              placeholder="Gõ để lọc tin theo tiêu đề hoặc tên công ty..."
              className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none mb-1.5 transition"
            />
            <select
              value={createForm.jobId}
              onChange={(e) => setCreateForm({ ...createForm, jobId: e.target.value })}
              required
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="">-- Chọn tin tuyển dụng đang mở ({filteredJobsForCreate.length} tin) --</option>
              {filteredJobsForCreate.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.title} — {job.company_name || 'Doanh nghiệp'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Chọn gói quảng cáo <span className="text-rose-500">*</span>
            </label>
            <select
              value={createForm.plan_id}
              onChange={(e) => handleSelectPlan(e.target.value)}
              required
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="">-- Chọn gói dịch vụ --</option>
              {plans
                .filter((p) => p.is_active)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (Độ ưu tiên: {p.default_priority || 100}, Đơn giá: {formatMoney(p.daily_price)}/ngày)
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Thời gian bắt đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={createForm.starts_at}
                onChange={(e) => setCreateForm({ ...createForm, starts_at: e.target.value })}
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Thời gian kết thúc <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={createForm.ends_at}
                onChange={(e) => setCreateForm({ ...createForm, ends_at: e.target.value })}
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="rounded-lg bg-indigo-50/70 p-3 text-[11px] text-indigo-800 border border-indigo-100 leading-relaxed">
            <strong>Ghi chú:</strong> Chiến dịch do quản trị viên cấp được ghi nhận nguồn <code>Admin kích hoạt</code>, chi phí thanh toán là <code>0 ₫</code> và không ảnh hưởng đến số dư ví của doanh nghiệp.
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? 'Đang kích hoạt...' : 'Kích hoạt chiến dịch'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Confirmation Dialog */}
      <AdminConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          if (confirmDialog.action) {
            await confirmDialog.action()
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }))
        }}
        title={confirmDialog.title}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
      >
        <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.description}</p>
      </AdminConfirmDialog>
    </AdminLayout>
  )
}
