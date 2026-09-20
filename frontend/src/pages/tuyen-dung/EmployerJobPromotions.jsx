import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Toast from '../../components/Toast.jsx'
import DashboardSidebar from '../../components/DashboardSidebar.jsx'
import EmployerTopBar from '../../components/EmployerTopBar.jsx'
import { formatCurrencyVi as formatMoney, formatDateTimeVi as formatDateTime } from '../../utils/formatters.js'
import {
  getPromotionDurationDays,
  PROMOTION_STATUS_OPTIONS,
  PROMOTION_STATUS_TONES,
} from '../../features/job-promotions/presentation.js'
import { getCompanyJobPromotions } from '../../api/companyService.js'

export default function EmployerJobPromotions() {
  const [promotions, setPromotions] = useState([])
  const [status, setStatus] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let active = true
    getCompanyJobPromotions({
      page: pagination.page,
      limit: pagination.limit,
      status: status || undefined,
    })
      .then((data) => {
        if (!active) return
        setPromotions(data.items || [])
        setPagination((current) => ({
          ...current,
          ...(data.pagination || {}),
        }))
      })
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh sách quảng cáo.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [pagination.page, pagination.limit, status])

  const stats = useMemo(() => ({
    active: promotions.filter((item) => item.status === 'active').length,
    expired: promotions.filter((item) => item.status === 'expired').length,
    cancelled: promotions.filter((item) => item.status === 'cancelled').length,
    totalSpent: promotions.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0),
  }), [promotions])

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <div className="dashboard-copy-font min-h-screen bg-[#F9FAFB] text-slate-900">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <DashboardSidebar activeKey="job-promotions" />

      <main className="min-h-screen bg-[#F9FAFB] lg:ml-64">
        <EmployerTopBar />

        <div className="space-y-4 px-4 py-5 lg:px-6 lg:py-8">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {[
              ['Đang hiển thị', stats.active, 'text-emerald-700'],
              ['Đã hết hạn', stats.expired, 'text-amber-700'],
              ['Đã hủy', stats.cancelled, 'text-rose-700'],
              ['Chi tiêu trang này', formatMoney(stats.totalSpent), 'text-slate-950'],
            ].map(([label, value, tone]) => (
              <article key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                <p className={`mt-2 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
              <select
                value={status}
                onChange={(event) => {
                  setLoading(true)
                  setStatus(event.target.value)
                  setPagination((current) => ({ ...current, page: 1 }))
                }}
                className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 text-[15px] font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                {PROMOTION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                Chọn một mục để xem chi tiết hoặc hủy gói quảng cáo còn hiệu lực.
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-sm font-semibold text-slate-400 shadow-sm">
                Đang tải danh sách quảng cáo...
              </div>
            ) : null}

            {!loading && promotions.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
                <div className="mx-auto max-w-md">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <span className="material-symbols-outlined text-[26px]">rocket_launch</span>
                  </div>
                  <p className="mt-4 text-lg font-bold text-slate-800">Chưa có gói quảng cáo nào</p>
                  <p className="mt-2 text-sm text-slate-500">Hãy mở danh sách job và mua quảng cáo cho tin đang đủ điều kiện hiển thị.</p>
                </div>
              </div>
            ) : null}

            {promotions.map((promotion) => (
              <article key={promotion._id} className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm lg:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900">{promotion.job?.title || 'Tin tuyển dụng'}</h3>
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-[11px] font-semibold ${PROMOTION_STATUS_TONES[promotion.status] || PROMOTION_STATUS_TONES.active}`}>
                        {PROMOTION_STATUS_OPTIONS.find((option) => option.value === promotion.status)?.label || promotion.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600">{promotion.plan_snapshot?.name || 'Gói quảng cáo'} • {promotion.job?.location || 'Chưa có địa điểm'} • {promotion.job?.level || 'Chưa có cấp bậc'}</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Bắt đầu</p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-700">{formatDateTime(promotion.starts_at)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Kết thúc</p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-700">{formatDateTime(promotion.ends_at)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Thời lượng</p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-700">{getPromotionDurationDays(promotion)} ngày</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Đã thanh toán</p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-700">{formatMoney(promotion.amount_paid, promotion.currency)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-[224px] xl:w-[224px]">
                    <Link
                      to={`/employer-job-promotions/${promotion._id}`}
                      className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Xem chi tiết
                    </Link>
                    <Link
                      to="/employer-job-list"
                      state={{ focusJobId: promotion.job_id }}
                      className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      Mở job
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm lg:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Tổng số gói quảng cáo: {pagination.total || promotions.length}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) - 1 }))}
                  className="inline-flex h-10 min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="px-2 text-sm font-semibold text-slate-500">Trang {pagination.page || 1}/{pagination.total_pages || 1}</span>
                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) + 1 }))}
                  className="inline-flex h-10 min-w-[88px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tiếp
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
