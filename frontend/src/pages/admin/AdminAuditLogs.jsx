import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import Toast from '../../components/Toast.jsx'
import { getAdminAuditLogs, getAdminUsers } from '../../api/adminService.js'
import { formatDateTimeVi as formatDateTime } from '../../utils/formatters.js'

const actionOptions = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'admin.login', label: 'admin.login (Đăng nhập quản trị)' },
  { value: 'admin.logout', label: 'admin.logout (Đăng xuất quản trị)' },
  { value: 'user.status.update', label: 'user.status.update (Đổi trạng thái tài khoản)' },
  { value: 'user.role.update', label: 'user.role.update (Đổi vai trò người dùng)' },
  { value: 'company.verification.update', label: 'company.verification.update (Xác minh doanh nghiệp)' },
  { value: 'job.moderation.update', label: 'job.moderation.update (Kiểm duyệt tin tuyển dụng)' },
  { value: 'wallet.adjust', label: 'wallet.adjust (Điều chỉnh số dư ví)' },
  { value: 'wallet.transactions.view', label: 'wallet.transactions.view (Xem lịch sử giao dịch ví)' },
  { value: 'sepay.config.update', label: 'sepay.config.update (Cập nhật cấu hình SePay)' },
  { value: 'sepay.secret.rotate', label: 'sepay.secret.rotate (Xoay khóa bảo mật SePay)' },
  { value: 'sepay.test_connection', label: 'sepay.test_connection (Kiểm tra kết nối SePay)' },
  { value: 'rag_chat.config.update', label: 'rag_chat.config.update (Cập nhật cấu hình RAG AI)' },
  { value: 'rag_chat.secret.rotate', label: 'rag_chat.secret.rotate (Xoay khóa bảo mật RAG AI)' },
  { value: 'job_promotion.create', label: 'job_promotion.create (Tạo chiến dịch quảng cáo)' },
  { value: 'job_promotion.update', label: 'job_promotion.update (Cập nhật chiến dịch quảng cáo)' },
  { value: 'job_promotion.delete', label: 'job_promotion.delete (Xóa chiến dịch quảng cáo)' },
  { value: 'job_promotion_plan.create', label: 'job_promotion_plan.create (Tạo gói quảng cáo mới)' },
  { value: 'job_promotion_plan.update', label: 'job_promotion_plan.update (Cập nhật gói quảng cáo)' },
  { value: 'job_promotion_plan.delete', label: 'job_promotion_plan.delete (Xóa gói quảng cáo)' },
]

const targetTypeOptions = [
  { value: '', label: 'Tất cả đối tượng' },
  { value: 'admin', label: 'Quản trị viên (admin)' },
  { value: 'user', label: 'Người dùng (user)' },
  { value: 'company', label: 'Doanh nghiệp (company)' },
  { value: 'job', label: 'Tin tuyển dụng (job)' },
  { value: 'wallet', label: 'Số dư ví (wallet)' },
  { value: 'wallet_transaction', label: 'Giao dịch ví (wallet_transaction)' },
  { value: 'wallet_topup_order', label: 'Đơn nạp tiền (wallet_topup_order)' },
  { value: 'sepay', label: 'Cổng SePay (sepay)' },
  { value: 'rag_chat', label: 'Trợ lý AI (rag_chat)' },
  { value: 'system_setting', label: 'Cấu hình hệ thống (system_setting)' },
  { value: 'job_promotion', label: 'Quảng cáo tuyển dụng (job_promotion)' },
  { value: 'job_promotion_plan', label: 'Gói quảng cáo (job_promotion_plan)' },
]

const targetTypeLabels = {
  admin: 'Quản trị viên',
  user: 'Người dùng',
  company: 'Doanh nghiệp',
  job: 'Tin tuyển dụng',
  wallet: 'Số dư ví',
  wallet_transaction: 'Giao dịch ví',
  wallet_topup_order: 'Đơn nạp tiền',
  sepay: 'Cổng SePay',
  rag_chat: 'Trợ lý AI',
  system_setting: 'Cấu hình',
  job_promotion: 'Quảng cáo',
  job_promotion_plan: 'Gói quảng cáo',
}

function getTargetLink(targetType, targetId, targetName) {
  if (!targetId) return null
  const idStr = String(targetId)
  switch (targetType) {
    case 'user':
    case 'admin':
      return `/admin/users?keyword=${encodeURIComponent(targetName?.email || idStr)}`
    case 'company':
      return `/admin/companies?keyword=${encodeURIComponent(targetName?.name || idStr)}`
    case 'job':
      return `/admin/jobs?keyword=${encodeURIComponent(idStr)}`
    case 'wallet':
    case 'wallet_transaction':
    case 'wallet_topup_order':
      return `/admin/wallet-transactions?userId=${encodeURIComponent(idStr)}`
    case 'job_promotion':
      return `/admin/job-promotions?keyword=${encodeURIComponent(idStr)}`
    case 'job_promotion_plan':
      return `/admin/job-promotion-plans`
    case 'sepay':
      return `/admin/sepay-config`
    case 'rag_chat':
      return `/admin/rag-chat-config`
    default:
      return null
  }
}

function PropertyRow({ label, value, mono = false, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 text-xs last:border-b-0">
      <span className="text-slate-500 font-medium shrink-0">{label}</span>
      {children || (
        <span className={`text-slate-900 text-right ${mono ? 'font-mono' : 'font-medium'} break-all`}>
          {value || '—'}
        </span>
      )}
    </div>
  )
}

export default function AdminAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [adminPickerOpen, setAdminPickerOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [copiedPayload, setCopiedPayload] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  // Filters read from URL
  const keywordParam = searchParams.get('keyword') || ''
  const actionParam = searchParams.get('action') || ''
  const targetTypeParam = searchParams.get('targetType') || searchParams.get('target_type') || ''
  const adminIdParam = searchParams.get('adminId') || searchParams.get('admin_id') || ''
  const successParam = searchParams.get('success') || ''
  const pageParam = Number(searchParams.get('page') || 1)

  const [keywordInput, setKeywordInput] = useState(keywordParam)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [adminSearch, setAdminSearch] = useState('')
  const [adminResults, setAdminResults] = useState([])
  const [searchAdminLoading, setSearchAdminLoading] = useState(false)

  // Sync keywordInput if URL changes
  useEffect(() => {
    setKeywordInput(keywordParam)
  }, [keywordParam])

  // Sync selectedAdmin if adminIdParam exists
  useEffect(() => {
    if (!adminIdParam) {
      setSelectedAdmin(null)
    }
  }, [adminIdParam])

  const updateFilters = useCallback(
    (newParams) => {
      const current = Object.fromEntries(searchParams.entries())
      const merged = { ...current, ...newParams }

      // Clean empty keys
      Object.keys(merged).forEach((k) => {
        if (!merged[k] || merged[k] === 'all') {
          delete merged[k]
        }
      })

      // Reset page to 1 if filter criteria changed
      if ('keyword' in newParams || 'action' in newParams || 'targetType' in newParams || 'adminId' in newParams || 'success' in newParams) {
        delete merged.page
      }

      setSearchParams(merged)
    },
    [searchParams, setSearchParams]
  )

  const handleResetFilters = () => {
    setKeywordInput('')
    setSelectedAdmin(null)
    setSearchParams({})
  }

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminAuditLogs({
        page: pageParam,
        limit: 12,
        keyword: keywordParam.trim() || undefined,
        action: actionParam || undefined,
        targetType: targetTypeParam || undefined,
        adminId: adminIdParam || undefined,
        success: successParam === 'true' ? true : successParam === 'false' ? false : undefined,
      })

      const rawLogs = data?.logs || data?.data?.logs || []
      setLogs(rawLogs)
      setPagination((curr) => ({
        ...curr,
        page: data?.pagination?.page || pageParam,
        limit: data?.pagination?.limit || 12,
        total: data?.pagination?.total || 0,
        total_pages: data?.pagination?.total_pages || 1,
      }))
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải nhật ký kiểm toán.' })
    } finally {
      setLoading(false)
    }
  }, [pageParam, keywordParam, actionParam, targetTypeParam, adminIdParam, successParam])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Admin Search inside picker
  useEffect(() => {
    if (!adminPickerOpen) return
    const timer = setTimeout(async () => {
      setSearchAdminLoading(true)
      try {
        const data = await getAdminUsers({ page: 1, limit: 8, role: 2, keyword: adminSearch.trim() || undefined })
        setAdminResults(data?.users ?? [])
      } catch {
        setAdminResults([])
      } finally {
        setSearchAdminLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [adminSearch, adminPickerOpen])

  const handleCopyPayload = (payload) => {
    if (!payload) return
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

    const handleCopyTargetId = (id) => {
    if (!id) return
    navigator.clipboard.writeText(String(id))
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  const hasActiveFilters = Boolean(
    keywordParam || actionParam || targetTypeParam || adminIdParam || successParam
  )

  return (
    <AdminLayout
      title="Nhật ký kiểm toán hệ thống"
      subtitle="Theo dõi toàn bộ các thao tác nghiệp vụ, cấu hình bảo mật và thay đổi dữ liệu của quản trị viên."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_140px_160px_auto]">
          {/* Keyword Search */}
          <div className="relative">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateFilters({ keyword: keywordInput.trim() })
                }
              }}
              placeholder="Tìm theo từ khóa (hành động, email, IP, ID đối tượng)..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:outline-none transition"
            />
            {keywordInput ? (
              <button
                type="button"
                onClick={() => {
                  setKeywordInput('')
                  updateFilters({ keyword: '' })
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Action Filter */}
          <select
            value={actionParam}
            onChange={(e) => updateFilters({ action: e.target.value })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Target Type Filter */}
          <select
            value={targetTypeParam}
            onChange={(e) => updateFilters({ targetType: e.target.value })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            {targetTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={successParam}
            onChange={(e) => updateFilters({ success: e.target.value })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả kết quả</option>
            <option value="true">Thành công</option>
            <option value="false">Thất bại / Lỗi</option>
          </select>

          {/* Admin Picker Button */}
          <button
            type="button"
            onClick={() => setAdminPickerOpen(true)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 transition truncate text-left"
            title={selectedAdmin ? selectedAdmin.fullName || selectedAdmin.email : 'Lọc theo Quản trị viên'}
          >
            {selectedAdmin
              ? `Admin: ${selectedAdmin.fullName || selectedAdmin.username || selectedAdmin.email}`
              : adminIdParam
                ? `Admin: #${adminIdParam.slice(-6)}`
                : 'Lọc theo Admin...'}
          </button>

          {/* Reset Filters */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-9 rounded-lg border border-rose-200 bg-rose-50/50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition whitespace-nowrap"
            >
              Đặt lại
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-400 cursor-not-allowed whitespace-nowrap"
            >
              Mặc định
            </button>
          )}
        </div>

        {/* Active Filter Tags */}
        {selectedAdmin || adminIdParam ? (
          <div className="mt-2.5 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span>
              Quản trị viên:{' '}
              <strong>
                {selectedAdmin ? selectedAdmin.fullName || selectedAdmin.email : `#${adminIdParam}`}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedAdmin(null)
                updateFilters({ adminId: '' })
              }}
              className="text-indigo-400 hover:text-indigo-900 transition font-bold ml-1"
              title="Hủy lọc admin"
            >
              ✕
            </button>
          </div>
        ) : null}
      </section>

      {/* Audit Logs Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Quản trị viên</th>
                <th className="py-3 px-4">Hành động & Kết quả</th>
                <th className="py-3 px-4">Đối tượng tác động</th>
                <th className="py-3 px-4">Địa chỉ IP & Method</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const adminObj =
                  typeof log.admin_id === 'object' && log.admin_id !== null ? log.admin_id : {}
                const adminName =
                  adminObj.fullName ||
                  adminObj.username ||
                  log.admin_email ||
                  'Quản trị viên'
                const adminEmail = adminObj.email || log.admin_email || '—'
                const isSuccess = log.success !== false
                const targetLink = getTargetLink(log.target_type, log.target_id, log.target_name)

                return (
                  <tr key={log._id} className="hover:bg-slate-50/70 transition">
                    {/* Time */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>

                    {/* Admin User */}
                    <td className="py-3 px-4">
                      {adminEmail !== '—' ? (
                        <Link
                          to={`/admin/users?keyword=${encodeURIComponent(adminEmail)}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 transition block truncate max-w-xs"
                          title="Xem người dùng"
                        >
                          {adminName}
                        </Link>
                      ) : (
                        <p className="font-semibold text-slate-900 truncate max-w-xs">{adminName}</p>
                      )}
                      <p className="text-[11px] text-slate-400 font-mono truncate">{adminEmail}</p>
                    </td>

                    {/* Action & Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50/70 text-[10px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Thành công
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-rose-200 bg-rose-50/70 text-[10px] font-medium text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Thất bại
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Target Type & Target Lookup Info */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {targetTypeLabels[log.target_type] || log.target_type || '—'}
                          </span>
                          {log.target_name?.name ? (
                            targetLink ? (
                              <Link
                                to={targetLink}
                                className="font-semibold text-xs text-indigo-600 hover:underline truncate max-w-[180px]"
                                title="Xem chi tiết đối tượng"
                              >
                                {log.target_name.name}
                              </Link>
                            ) : (
                              <span className="font-semibold text-xs text-slate-900 truncate max-w-[180px]">
                                {log.target_name.name}
                              </span>
                            )
                          ) : null}
                        </div>

                        {log.target_name?.email ? (
                          <span className="text-[11px] text-slate-400 font-mono truncate">
                            {log.target_name.email}
                          </span>
                        ) : null}

                        {log.target_id ? (
                          targetLink && !log.target_name?.name ? (
                            <Link
                              to={targetLink}
                              className="font-mono text-[11px] font-medium text-indigo-600 hover:underline truncate max-w-[150px]"
                              title="Mở đối tượng tác động"
                            >
                              #{String(log.target_id).slice(-10)}
                            </Link>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                              #{String(log.target_id).slice(-8)}
                            </span>
                          )
                        ) : null}
                      </div>
                    </td>

                    {/* IP & Method */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-600">
                          {log.ip || '127.0.0.1'}
                        </span>
                        {log.method ? (
                          <span className="rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {log.method}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(log)
                          setDetailModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!logs.length ? (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải nhật ký kiểm toán...' : 'Không có nhật ký nào phù hợp.'}
            </div>
          ) : null}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between bg-slate-50/40">
          <span>
            Trang <strong className="text-slate-900 font-semibold">{pagination.page || 1}</strong> / {pagination.total_pages || 1} · Tổng <strong className="text-slate-900 font-semibold">{pagination.total || logs.length}</strong> bản ghi
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => updateFilters({ page: Number(pagination.page || 1) - 1 })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => updateFilters({ page: Number(pagination.page || 1) + 1 })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>

      {/* Audit Log Detail Center Modal */}
      <AdminModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Chi tiết bản ghi kiểm toán"
        subtitle={selectedLog ? `Hành động: ${selectedLog.action}` : ''}
        size="lg"
      >
        {selectedLog ? (
          <div className="space-y-4">
            {/* Status Header Banner */}
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex items-center gap-2">
                {selectedLog.success !== false ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Thực hiện thành công
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Thao tác thất bại / Gặp lỗi
                  </span>
                )}
                {selectedLog.status_code ? (
                  <span className="font-mono text-xs font-bold text-slate-600 px-2 py-0.5 rounded bg-white border border-slate-200">
                    HTTP {selectedLog.status_code}
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {formatDateTime(selectedLog.created_at)}
              </span>
            </div>

            {/* Event Information Table */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Thông tin sự kiện & Đối tượng
              </h4>
              {(() => {
                const adminObj =
                  typeof selectedLog.admin_id === 'object' && selectedLog.admin_id !== null
                    ? selectedLog.admin_id
                    : {}
                const adminName =
                  adminObj.fullName ||
                  adminObj.username ||
                  selectedLog.admin_email ||
                  'Quản trị viên'
                const adminEmail = adminObj.email || selectedLog.admin_email
                const targetLink = getTargetLink(selectedLog.target_type, selectedLog.target_id, selectedLog.target_name)

                return (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white px-3 shadow-2xs">
                    <PropertyRow label="Mã bản ghi (Log ID)" value={selectedLog._id} mono />
                    <PropertyRow label="Hành động" value={selectedLog.action} mono />
                    <PropertyRow label="Quản trị viên thực hiện">
                      {adminEmail ? (
                        <Link
                          to={`/admin/users?keyword=${encodeURIComponent(adminEmail)}`}
                          className="font-semibold text-indigo-600 hover:underline text-xs"
                          title="Mở hồ sơ người dùng"
                        >
                          {adminName} {adminEmail ? `(${adminEmail})` : ''}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900 text-xs">{adminName}</span>
                      )}
                    </PropertyRow>
                    <PropertyRow label="Loại đối tượng tác động">
                      <span className="font-semibold text-xs text-slate-900">
                        {targetTypeLabels[selectedLog.target_type] || selectedLog.target_type || '—'}{' '}
                        <span className="font-mono text-[11px] text-slate-400 font-normal">({selectedLog.target_type})</span>
                      </span>
                    </PropertyRow>

                    {selectedLog.target_name?.name ? (
                      <PropertyRow label={`Tên ${(targetTypeLabels[selectedLog.target_type] || 'đối tượng').toLowerCase()}`}>
                        {targetLink ? (
                          <Link
                            to={targetLink}
                            className="font-bold text-xs text-indigo-600 hover:underline"
                            title="Điều hướng đến đối tượng này"
                          >
                            {selectedLog.target_name.name}
                            {selectedLog.target_name.email ? (
                              <span className="font-normal font-mono text-[11px] text-slate-500 ml-1">
                                ({selectedLog.target_name.email})
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <span className="font-bold text-xs text-slate-900">
                            {selectedLog.target_name.name}
                            {selectedLog.target_name.email ? (
                              <span className="font-normal font-mono text-[11px] text-slate-500 ml-1">
                                ({selectedLog.target_name.email})
                              </span>
                            ) : null}
                          </span>
                        )}
                      </PropertyRow>
                    ) : null}

                    <PropertyRow label="Mã đối tượng (Target ID)">
                      {selectedLog.target_id ? (
                        <div className="flex items-center gap-2">
                          {targetLink ? (
                            <Link
                              to={targetLink}
                              className="font-mono text-xs font-semibold text-indigo-600 hover:underline"
                              title="Điều hướng đến đối tượng này"
                            >
                              {String(selectedLog.target_id)}
                            </Link>
                          ) : (
                            <span className="font-mono text-slate-900 text-xs">
                              {String(selectedLog.target_id)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyTargetId(selectedLog.target_id)}
                            className="text-[11px] text-slate-400 hover:text-indigo-600 transition"
                            title="Sao chép ID"
                          >
                            {copiedId ? '✓' : 'Copy'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </PropertyRow>
                    <PropertyRow
                      label="Phương thức & Đường dẫn"
                      value={
                        selectedLog.method || selectedLog.path
                          ? `${selectedLog.method || 'GET'} ${selectedLog.path || ''}`
                          : '—'
                      }
                      mono
                    />
                    <PropertyRow label="Địa chỉ IP" value={selectedLog.ip || '127.0.0.1'} mono />
                    <PropertyRow label="Trình duyệt (User Agent)" value={selectedLog.user_agent} />
                  </div>
                )
              })()}
            </div>

            {/* Payload / Metadata */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Dữ liệu thay đổi (Metadata / Payload)
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(selectedLog.metadata)}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition"
                  >
                    {copiedPayload ? '✓ Đã sao chép!' : 'Sao chép JSON'}
                  </button>
                </div>
                <pre className="p-3 rounded-lg border border-slate-200 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-60 custom-scrollbar">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : null}
      </AdminModal>

      {/* Admin User Picker Modal */}
      <AdminModal
        open={adminPickerOpen}
        onClose={() => setAdminPickerOpen(false)}
        title="Chọn Quản trị viên để lọc"
        subtitle="Tìm kiếm tài khoản admin trong hệ thống."
        size="sm"
      >
        <div className="space-y-3">
          <input
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="Tìm theo email hoặc họ tên admin..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
          />

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {searchAdminLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Đang tìm admin...</div>
            ) : (
              adminResults.map((a) => (
                <button
                  key={a._id}
                  type="button"
                  onClick={() => {
                    setSelectedAdmin(a)
                    updateFilters({ adminId: a._id })
                    setAdminPickerOpen(false)
                  }}
                  className="w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.fullName || a.username}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{a.email}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600 shrink-0">Chọn</span>
                </button>
              ))
            )}
            {!adminResults.length && !searchAdminLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy quản trị viên.</div>
            ) : null}
          </div>
        </div>
      </AdminModal>
    </AdminLayout>
  )
}