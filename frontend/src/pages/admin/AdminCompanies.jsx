import { useEffect, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.jsx'
import Toast from '../../components/Toast.jsx'
import { compactId, formatDateVi as formatDate } from '../../utils/formatters.js'
import { toSafeImageUrl } from '../../utils/safeUrl.js'
import {
  getAdminCompanies,
  getAdminCompanyApplications,
  getAdminCompanyDetail,
  getAdminCompanyJobs,
  updateAdminCompanyStatus,
} from '../../api/adminService.js'

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

const applicationStatusLabelMap = {
  submitted: 'Đã nộp',
  reviewing: 'Đang xem',
  shortlisted: 'Phù hợp',
  interviewing: 'Phỏng vấn',
  rejected: 'Từ chối',
  hired: 'Đã nhận',
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

function getInitial(company) {
  return (company?.company_name || 'C').slice(0, 1).toUpperCase()
}

function PropertyRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 text-xs">
      <span className="text-slate-500 font-medium shrink-0">{label}</span>
      <span className={`text-slate-900 text-right ${mono ? 'font-mono' : 'font-medium'} break-all`}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([])
  const [stats, setStats] = useState({ total: 0, verified: 0, unverified: 0 })
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [companyJobs, setCompanyJobs] = useState([])
  const [companyApplications, setCompanyApplications] = useState([])
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'jobs' | 'applications'
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlKeyword = searchParams.get('keyword') || ''
  const urlCompanyId = searchParams.get('companyId') || searchParams.get('company_id') || ''
  const [keyword, setKeyword] = useState(urlCompanyId ? '' : urlKeyword)
  const [verified, setVerified] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    tone: 'primary',
    confirmLabel: 'Xác nhận',
  })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (urlCompanyId) {
      handleOpenDetail(urlCompanyId)
    }
  }, [urlCompanyId])

  useEffect(() => {
    if (urlKeyword && urlKeyword !== keyword) {
      setKeyword(urlKeyword)
    }
  }, [urlKeyword])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getAdminCompanies({
        page: pagination.page,
        limit: pagination.limit,
        keyword: keyword || undefined,
        verified: verified === '' ? undefined : verified === 'true',
        companyId: urlCompanyId || undefined,
      })
        .then((data) => {
          if (!active) return
          setCompanies(data?.companies ?? [])
          if (data?.stats) {
            setStats(data.stats)
          }
          setPagination((current) => ({ ...current, ...(data?.pagination || {}) }))
        })
        .catch((error) => {
          if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh sách doanh nghiệp.' })
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, keyword ? 250 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [keyword, verified, urlCompanyId, pagination.page, pagination.limit])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [keyword, verified, urlCompanyId])

  const handleOpenDetail = async (companyId) => {
    setDrawerOpen(true)
    setSelectedCompany(null)
    setCompanyJobs([])
    setCompanyApplications([])
    setActiveTab('overview')
    setDetailLoading(true)
    try {
      const [detail, jobs, applications] = await Promise.all([
        getAdminCompanyDetail(companyId),
        getAdminCompanyJobs(companyId, { limit: 20 }),
        getAdminCompanyApplications(companyId, { limit: 20 }),
      ])
      setSelectedCompany(detail)
      setCompanyJobs(jobs?.jobs || [])
      setCompanyApplications(applications?.applications || [])
    } catch (error) {
      setDrawerOpen(false)
      setToast({ type: 'error', message: error.message || 'Không thể tải chi tiết doanh nghiệp.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedCompany(null)
    setActiveTab('overview')
  }

  const handlePromptToggleVerified = () => {
    if (!selectedCompany) return
    const nextVerified = !selectedCompany.verified

    if (nextVerified) {
      setConfirmDialog({
        open: true,
        title: 'Phê duyệt xác minh doanh nghiệp',
        description: `Xác nhận phê duyệt hồ sơ pháp lý của "${selectedCompany.company_name}"? Doanh nghiệp sẽ được cấp tích xanh xác thực uy tín trên cổng tuyển dụng.`,
        tone: 'primary',
        confirmLabel: 'Phê duyệt xác minh',
      })
    } else {
      setConfirmDialog({
        open: true,
        title: 'Hủy trạng thái xác minh',
        description: `Bạn có chắc chắn muốn hủy trạng thái xác minh của "${selectedCompany.company_name}"? Doanh nghiệp này sẽ mất tích xanh uy tín.`,
        tone: 'danger',
        confirmLabel: 'Hủy xác minh',
      })
    }
  }

  const handleConfirmToggleVerified = async () => {
    if (!selectedCompany) return
    setUpdatingStatus(true)
    const nextVerified = !selectedCompany.verified
    try {
      const result = await updateAdminCompanyStatus(selectedCompany._id, { verified: nextVerified })
      const updatedVerified = Boolean(result?.verified ?? nextVerified)
      const updatedAt = result?.updated_at || new Date().toISOString()
      setCompanies((current) => current.map((item) => (
        item._id === selectedCompany._id ? { ...item, verified: updatedVerified, updated_at: updatedAt } : item
      )))
      setSelectedCompany((current) => ({ ...current, verified: updatedVerified, updated_at: updatedAt }))
      setStats((current) => ({
        ...current,
        verified: updatedVerified ? current.verified + 1 : Math.max(0, current.verified - 1),
        unverified: updatedVerified ? Math.max(0, current.unverified - 1) : current.unverified + 1,
      }))
      setConfirmDialog((prev) => ({ ...prev, open: false }))
      setToast({ type: 'success', message: `Đã ${updatedVerified ? 'xác minh' : 'hủy xác minh'} doanh nghiệp thành công.` })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật trạng thái doanh nghiệp.' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <AdminLayout
      title="Quản lý doanh nghiệp"
      subtitle="Danh sách tổ chức, công ty tuyển dụng và trạng thái xác minh hồ sơ pháp lý."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards (Real-time DB Totals) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Tổng doanh nghiệp', stats.total, 'text-slate-900 bg-slate-100 ring-slate-500/10'],
          ['Đã xác minh', stats.verified, 'text-emerald-700 bg-emerald-50 ring-emerald-600/20'],
          ['Chờ xác minh', stats.unverified, 'text-amber-700 bg-amber-50 ring-amber-600/20'],
        ].map(([label, value, badgeStyle]) => (
          <div key={label} className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-900">{value}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ring-1 ring-inset ${badgeStyle}`}>
                Toàn hệ thống
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Filter & Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={urlCompanyId ? `Tìm trong doanh nghiệp ${location.state?.companyName || ''}...` : 'Tìm theo tên công ty hoặc từ khóa...'}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
            />
          </div>
          <select
            value={verified}
            onChange={(event) => setVerified(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả trạng thái xác minh</option>
            <option value="true">Đã xác minh (Tích xanh)</option>
            <option value="false">Chờ xác minh</option>
          </select>
        </div>

        {urlCompanyId ? (
          <div className="mt-3 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span className="material-symbols-outlined text-[15px] text-indigo-500">apartment</span>
            <span>
              Đang lọc theo công ty: <strong>{location.state?.companyName || (companies.find((c) => String(c._id) === urlCompanyId)?.company_name) || ('ID #' + urlCompanyId.slice(-6))}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('companyId')
                  next.delete('company_id')
                  next.delete('keyword')
                  return next
                }, { replace: true })
              }}
              title="Hủy lọc theo công ty"
              className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-indigo-200/60 text-indigo-600 transition ml-1 font-bold"
            >
              ✕
            </button>
          </div>
        ) : urlKeyword ? (
          <div className="mt-3 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span className="material-symbols-outlined text-[15px] text-indigo-500">search</span>
            <span>
              Từ khóa tìm kiếm: <strong>{urlKeyword}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('keyword')
                  return next
                }, { replace: true })
              }}
              title="Hủy từ khóa"
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
                <th className="py-3 px-4">Doanh nghiệp</th>
                <th className="py-3 px-4">Trụ sở chính</th>
                <th className="py-3 px-4">Chủ tài khoản / Đại diện</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Ngày tham gia</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => {
                const owner = company.owner || {}

                return (
                  <tr key={company._id} className="hover:bg-slate-50/70 transition">
                    {/* Company Logo + Name + Website */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-700 text-xs font-bold ring-1 ring-slate-200">
                          {toSafeImageUrl(company.logo) ? (
                            <img src={toSafeImageUrl(company.logo)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            getInitial(company)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {company.company_name}
                          </p>
                          {company.website ? (
                            <a
                              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-indigo-600 hover:underline truncate block"
                            >
                              {company.website}
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">Chưa có website</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3 px-4">
                      <p className="text-slate-700 font-medium truncate max-w-xs">{company.address || '—'}</p>
                    </td>

                    {/* Owner Account */}
                    <td className="py-3 px-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{owner.fullName || '—'}</p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{owner.email || 'Chưa có email'}</p>
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${
                        company.verified
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {company.verified ? 'Đã xác minh' : 'Chờ xác minh'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-medium">
                      {formatDate(company.created_at)}
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(company._id)}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 hover:border-slate-300 transition"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!companies.length ? (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải danh sách doanh nghiệp...' : 'Không tìm thấy doanh nghiệp phù hợp.'}
            </div>
          ) : null}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between bg-slate-50/40">
          <span>
            Trang <strong className="text-slate-900 font-semibold">{pagination.page || 1}</strong> / {pagination.total_pages || 1} · Tổng <strong className="text-slate-900 font-semibold">{pagination.total || companies.length}</strong> doanh nghiệp
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

      {/* Detail Drawer with Tab Navigation */}
      <AdminDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Hồ sơ doanh nghiệp"
        subtitle={detailLoading ? 'Đang tải dữ liệu doanh nghiệp...' : selectedCompany?.company_name || 'Chi tiết doanh nghiệp'}
      >
        {detailLoading || !selectedCompany ? (
          <div className="flex min-h-[320px] items-center justify-center text-xs font-medium text-slate-400">
            Đang tải dữ liệu...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header Company Summary */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-700 font-bold text-sm ring-1 ring-slate-200">
                  {toSafeImageUrl(selectedCompany.logo) ? (
                    <img src={toSafeImageUrl(selectedCompany.logo)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitial(selectedCompany)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 truncate text-sm">
                      {selectedCompany.company_name}
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${
                      selectedCompany.verified
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                        : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                    }`}>
                      <span className="h-1 w-1 rounded-full bg-current" />
                      {selectedCompany.verified ? 'Đã xác minh' : 'Chờ xác minh'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{selectedCompany.address || 'Doanh nghiệp tuyển dụng'}</p>
                </div>
              </div>

              <button
                type="button"
                disabled={updatingStatus}
                onClick={handlePromptToggleVerified}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                  selectedCompany.verified
                    ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20'
                }`}
              >
                {updatingStatus ? 'Đang cập nhật...' : selectedCompany.verified ? 'Hủy xác minh' : 'Phê duyệt xác minh'}
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Thông tin chung</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'jobs'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">work</span>
                <span>Tin tuyển dụng ({companyJobs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('applications')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'applications'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                <span>Hồ sơ ứng tuyển ({companyApplications.length})</span>
              </button>
            </div>

            {/* Tab 1: Overview & Owner */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Owner Representative Account */}
                {selectedCompany.owner && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Chủ sở hữu / Người đại diện
                      </h4>
                      <Link
                        to={`/admin/users?userId=${selectedCompany.owner._id}`}
                        state={{ userPreview: selectedCompany.owner }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                      >
                        <span>Quản lý tài khoản</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">{selectedCompany.owner.fullName || 'Người dùng'}</span>
                        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                          Nhà tuyển dụng
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-indigo-100/80 pt-2 text-xs">
                        <span className="text-slate-500 font-mono text-[11px]">{selectedCompany.owner.email}</span>
                        <span className="text-slate-600 text-[11px] font-medium">
                          {selectedCompany.owner.is_verified ? 'Email đã xác minh' : 'Chưa xác minh email'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key-Value Properties */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Thông tin pháp lý & Liên hệ
                  </h4>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3">
                    <PropertyRow label="Mã doanh nghiệp (ID)" value={compactId(selectedCompany._id, { prefix: 8, suffix: 6 })} mono />
                    <PropertyRow label="Trang web" value={selectedCompany.website} />
                    <PropertyRow label="Địa chỉ trụ sở" value={selectedCompany.address} />
                    <PropertyRow label="Ngày đăng ký" value={formatDate(selectedCompany.created_at)} mono />
                    <PropertyRow label="Cập nhật gần nhất" value={formatDate(selectedCompany.updated_at)} mono />
                  </div>
                </div>

                {/* Description */}
                {selectedCompany.description && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Giới thiệu doanh nghiệp</h4>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs text-slate-700 leading-relaxed">
                      {selectedCompany.description}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Jobs */}
            {activeTab === 'jobs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Danh sách tin tuyển dụng ({companyJobs.length})
                  </h4>
                  <Link
                    to={`/admin/jobs?companyId=${selectedCompany._id}`}
                    state={{ companyName: selectedCompany.company_name }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                  >
                    <span>Xem trên trang Tin tuyển dụng</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden">
                  {companyJobs.map((job) => (
                    <div key={job._id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{job.title}</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{formatDate(job.created_at)}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${jobStatusToneMap[job.status] || 'bg-slate-100 text-slate-600'}`}>
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {jobStatusLabelMap[job.status] || job.status}
                      </span>
                    </div>
                  ))}
                  {!companyJobs.length && (
                    <div className="p-6 text-center text-xs text-slate-400">Doanh nghiệp chưa đăng tin tuyển dụng nào.</div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Applications */}
            {activeTab === 'applications' && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Hồ sơ ứng tuyển đã nhận ({companyApplications.length})
                </h4>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden">
                  {companyApplications.map((app) => (
                    <div key={app._id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{app.candidate?.fullName || 'Ứng viên'}</p>
                        <p className="text-[11px] text-slate-500 truncate">Vị trí: {app.job?.title || 'Tin tuyển dụng'}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${applicationStatusToneMap[app.status] || 'bg-slate-100 text-slate-600'}`}>
                        {applicationStatusLabelMap[app.status] || app.status}
                      </span>
                    </div>
                  ))}
                  {!companyApplications.length && (
                    <div className="p-6 text-center text-xs text-slate-400">Chưa có ứng viên nào nộp hồ sơ.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminDrawer>

      {/* Confirmation Dialog */}
      <AdminConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmToggleVerified}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        confirming={updatingStatus}
        tone={confirmDialog.tone}
      />
    </AdminLayout>
  )
}