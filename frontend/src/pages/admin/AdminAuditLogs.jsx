import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import Toast from '../../components/Toast.jsx'
import { getAdminAuditLogs, getAdminUsers } from '../../api/adminService.js'
import { formatDateTimeVi as formatDateTime } from '../../utils/formatters.js'

const actionOptions = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'admin.login', label: 'admin.login (Đăng nhập)' },
  { value: 'admin.logout', label: 'admin.logout (Đăng xuất)' },
  { value: 'user.status.update', label: 'user.status.update (Đổi trạng thái user)' },
  { value: 'company.verification.update', label: 'company.verification.update (Xác minh công ty)' },
  { value: 'job.moderation.update', label: 'job.moderation.update (Kiểm duyệt tin)' },
  { value: 'wallet.adjust', label: 'wallet.adjust (Điều chỉnh ví)' },
  { value: 'sepay.config.update', label: 'sepay.config.update (Cập nhật SePay)' },
  { value: 'rag_chat.config.update', label: 'rag_chat.config.update (Cập nhật RAG AI)' },
  { value: 'job_promotion.create', label: 'job_promotion.create (Tạo QC)' },
  { value: 'job_promotion.update', label: 'job_promotion.update (Sửa QC)' },
  { value: 'job_promotion_plan.update', label: 'job_promotion_plan.update (Sửa gói QC)' },
]

const targetTypeOptions = [
  { value: '', label: 'Tất cả đối tượng' },
  { value: 'user', label: 'Người dùng (user)' },
  { value: 'company', label: 'Doanh nghiệp (company)' },
  { value: 'job', label: 'Tin tuyển dụng (job)' },
  { value: 'wallet', label: 'Số dư ví (wallet)' },
  { value: 'sepay', label: 'Cổng SePay (sepay)' },
  { value: 'rag_chat', label: 'Trợ lý AI (rag_chat)' },
  { value: 'job_promotion', label: 'Quảng cáo (job_promotion)' },
]

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

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [adminPickerOpen, setAdminPickerOpen] = useState(false)
  const [toast, setToast] = useState(null)

  // Filters
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [adminSearch, setAdminSearch] = useState('')
  const [adminResults, setAdminResults] = useState([])
  const [searchAdminLoading, setSearchAdminLoading] = useState(false)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await getAdminAuditLogs({
        page: pagination.page,
        limit: pagination.limit,
        action: action || undefined,
        target_type: targetType || undefined,
        admin_id: selectedAdmin?._id || undefined,
      })
      setLogs(data?.audit_logs || data?.data?.audit_logs || [])
      setPagination((curr) => ({ ...curr, ...(data?.pagination || {}) }))
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải nhật ký kiểm toán.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [pagination.page, action, targetType, selectedAdmin])

  // Admin Search inside picker
  useEffect(() => {
    if (!adminPickerOpen) return
    const timer = setTimeout(async () => {
      setSearchAdminLoading(true)
      try {
        const data = await getAdminUsers({ page: 1, limit: 6, role: 2, keyword: adminSearch.trim() || undefined })
        setAdminResults(data?.users ?? [])
      } catch {
        setAdminResults([])
      } finally {
        setSearchAdminLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [adminSearch, adminPickerOpen])

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <AdminLayout
      title="Nhật ký kiểm toán hệ thống"
      subtitle="Theo dõi toàn bộ các thao tác nghiệp vụ, cấu hình bảo mật và thay đổi dữ liệu của quản trị viên."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px_auto]">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            {targetTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAdminPickerOpen(true)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 transition truncate text-left"
          >
            {selectedAdmin ? `Admin: ${selectedAdmin.fullName || selectedAdmin.username}` : 'Lọc theo Admin...'}
          </button>

          <button
            type="button"
            onClick={() => { setAction(''); setTargetType(''); setSelectedAdmin(null) }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Đặt lại
          </button>
        </div>

        {selectedAdmin ? (
          <div className="mt-2.5 flex items-center gap-2 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span>Lọc theo quản trị viên: <strong>{selectedAdmin.fullName || selectedAdmin.email}</strong></span>
            <button
              type="button"
              onClick={() => setSelectedAdmin(null)}
              className="text-indigo-400 hover:text-indigo-900 transition font-bold ml-1"
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
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Đối tượng tác động</th>
                <th className="py-3 px-4">Địa chỉ IP</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const admin = log.admin_id || {}
                return (
                  <tr key={log._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 truncate max-w-xs">{admin.fullName || admin.username || 'Quản trị viên'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{admin.email || '—'}</p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-500/10">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-900 font-medium">{log.target_type || '—'}</span>
                      {log.target_id ? (
                        <span className="block font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                          #{String(log.target_id).slice(-8)}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.ip_address || '127.0.0.1'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(log)
                          setDrawerOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Xem
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
              onClick={() => setPagination((curr) => ({ ...curr, page: Number(curr.page || 1) - 1 }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPagination((curr) => ({ ...curr, page: Number(curr.page || 1) + 1 }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>

      {/* Audit Log Detail Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Chi tiết bản ghi kiểm toán"
        subtitle={selectedLog?.action}
        wide
      >
        {selectedLog ? (
          <div className="space-y-5">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Thông tin sự kiện
              </h4>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50 px-3">
                <PropertyRow label="Mã bản ghi (ID)" value={selectedLog._id} mono />
                <PropertyRow label="Hành động" value={selectedLog.action} mono />
                <PropertyRow label="Quản trị viên thực hiện" value={`${selectedLog.admin_id?.fullName || ''} (${selectedLog.admin_id?.email || selectedLog.admin_id})`} />
                <PropertyRow label="Đối tượng mục tiêu" value={selectedLog.target_type} />
                <PropertyRow label="Mã đối tượng mục tiêu" value={selectedLog.target_id} mono />
                <PropertyRow label="Địa chỉ IP" value={selectedLog.ip_address} mono />
                <PropertyRow label="Trình duyệt (User Agent)" value={selectedLog.user_agent} />
                <PropertyRow label="Thời gian ghi nhận" value={formatDateTime(selectedLog.created_at)} mono />
              </div>
            </div>

            {selectedLog.details && Object.keys(selectedLog.details).length > 0 ? (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Dữ liệu payload thay đổi (Details)
                </h4>
                <pre className="p-3 rounded-lg border border-slate-200 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-60 custom-scrollbar">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminDrawer>

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
            ) : adminResults.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => {
                  setSelectedAdmin(a)
                  setAdminPickerOpen(false)
                }}
                className="w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{a.fullName || a.username}</p>
                  <p className="text-[11px] text-slate-400 truncate">{a.email}</p>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 shrink-0">Chọn</span>
              </button>
            ))}
            {!adminResults.length && !searchAdminLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy quản trị viên.</div>
            ) : null}
          </div>
        </div>
      </AdminModal>
    </AdminLayout>
  )
}
