import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import { getAdminAuditLogs, getAdminUsers } from '../../api/adminService.js'
import { compactId, formatDateTimeVi as formatDateTime, toIsoString } from '../../utils/formatters.js'

const actionOptions = [
  '', 'admin.login', 'admin.logout', 'user.status.update', 'company.verification.update', 'job.moderation.update',
  'wallet.adjust', 'wallet.transactions.view', 'user.wallet.view', 'user.topup_orders.view',
  'sepay.config.view', 'sepay.config.update', 'sepay.secret.rotate', 'sepay.test_connection', 'sepay.diagnostics.view',
  'rag_chat.config.view', 'rag_chat.config.update', 'rag_chat.secret.rotate', 'rag_chat.health.view',
  'job_promotion.view', 'job_promotion.create', 'job_promotion.update', 'job_promotion.delete',
  'job_promotion_plan.create', 'job_promotion_plan.update', 'job_promotion_plan.delete',
]

const targetTypeOptions = ['', 'admin', 'user', 'company', 'job', 'wallet', 'wallet_transaction', 'wallet_topup_order', 'sepay', 'rag_chat', 'system_setting', 'job_promotion', 'job_promotion_plan']

const inputClassName =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

function PickerModal({ open, onClose, onSelect }) {
  const [keyword, setKeyword] = useState('')
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getAdminUsers({ page: 1, limit: 8, role: 2, keyword: keyword || undefined })
        .then((data) => {
          if (active) setAdmins(Array.isArray(data?.users) ? data.users : [])
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, keyword ? 250 : 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [keyword, open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-extrabold text-slate-950">Chọn quản trị viên</h3>
            <p className="mt-1 text-[12px] font-medium text-slate-500">Lọc audit log ngay trong màn này.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>
        <div className="p-5">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo tên, email hoặc username..." className={inputClassName} />
          <div className="mt-4 space-y-2">
            {admins.map((admin) => (
              <div key={admin._id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-slate-950">{admin.fullName || admin.username || admin.email || 'Quản trị viên'}</p>
                  <p className="mt-1 truncate text-[12px] font-medium text-slate-500">{admin.email || 'Chưa có email'} · {compactId(admin._id)}</p>
                </div>
                <button type="button" onClick={() => onSelect(admin)} className="h-9 rounded-md border border-teal-200 bg-teal-50 px-4 text-[12px] font-extrabold text-teal-700 transition hover:bg-teal-100">Chọn admin</button>
              </div>
            ))}
            {!admins.length ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-[13px] font-semibold text-slate-400">{loading ? 'Đang tải quản trị viên...' : 'Không tìm thấy quản trị viên phù hợp.'}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [filters, setFilters] = useState({ action: '', targetType: '', success: '', fromDate: '', toDate: '' })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })

  useEffect(() => {
    let active = true
    getAdminAuditLogs({
      page: pagination.page,
      limit: pagination.limit,
      adminId: selectedAdmin?._id || undefined,
      action: filters.action || undefined,
      targetType: filters.targetType || undefined,
      success: filters.success || undefined,
      fromDate: toIsoString(filters.fromDate),
      toDate: toIsoString(filters.toDate),
    })
      .then((data) => {
        if (!active) return
        setLogs(Array.isArray(data?.logs) ? data.logs : [])
        setPagination((current) => ({ ...current, ...(data?.pagination || {}) }))
      })
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải audit log.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [filters.action, filters.fromDate, filters.success, filters.targetType, filters.toDate, pagination.limit, pagination.page, selectedAdmin?._id])

  const updateFilter = (key, value) => {
    setLoading(true)
    setFilters((current) => ({ ...current, [key]: value }))
    setPagination((current) => ({ ...current, page: 1 }))
  }

  const selectAdmin = (admin) => {
    setLoading(true)
    setSelectedAdmin(admin)
    setPagination((current) => ({ ...current, page: 1 }))
    setIsPickerOpen(false)
  }

  const resetFilters = () => {
    setLoading(true)
    setSelectedAdmin(null)
    setFilters({ action: '', targetType: '', success: '', fromDate: '', toDate: '' })
    setPagination((current) => ({ ...current, page: 1 }))
  }

  const changePage = (page) => {
    setLoading(true)
    setPagination((current) => ({ ...current, page }))
  }

  const stats = useMemo(() => ({
    success: logs.filter((item) => item.success).length,
    failed: logs.filter((item) => item.success === false).length,
    sepay: logs.filter((item) => item.target_type === 'sepay').length,
    rag: logs.filter((item) => item.target_type === 'rag_chat').length,
  }), [logs])

  return (
    <AdminLayout title="Nhật Ký Admin" subtitle="Theo dõi hành động quản trị, lọc theo quản trị viên, action, resource và khoảng thời gian, đồng thời xem chi tiết metadata thay đổi.">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <PickerModal open={isPickerOpen} onClose={() => setIsPickerOpen(false)} onSelect={selectAdmin} />

      <section className="admin-metrics mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Success</p><p className="mt-2 text-2xl font-extrabold text-emerald-700">{stats.success}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Failed</p><p className="mt-2 text-2xl font-extrabold text-rose-700">{stats.failed}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">SePay</p><p className="mt-2 text-2xl font-extrabold text-teal-700">{stats.sepay}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">RAG Chat</p><p className="mt-2 text-2xl font-extrabold text-slate-950">{stats.rag}</p></div>
      </section>

      <section className="admin-filter-bar mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[220px_180px_170px_170px_170px_120px_110px]">
          <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3">
            <p className="truncate text-[13px] font-bold text-slate-700">{selectedAdmin ? selectedAdmin.fullName || selectedAdmin.username || selectedAdmin.email : 'Tất cả admin'}</p>
            <button type="button" onClick={() => setIsPickerOpen(true)} className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-extrabold text-slate-600 transition hover:bg-slate-50">Chọn</button>
          </div>
          <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)} className={inputClassName}>
            <option value="">Tất cả action</option>
            {actionOptions.filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.targetType} onChange={(event) => updateFilter('targetType', event.target.value)} className={inputClassName}>
            <option value="">Tất cả resource</option>
            {targetTypeOptions.filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.success} onChange={(event) => updateFilter('success', event.target.value)} className={inputClassName}>
            <option value="">Tất cả kết quả</option><option value="true">Success</option><option value="false">Failed</option>
          </select>
          <input type="datetime-local" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} className={inputClassName} />
          <input type="datetime-local" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} className={inputClassName} />
          <button type="button" onClick={resetFilters} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50">Đặt lại</button>
        </div>
      </section>

      <section>
        <section className="admin-data-panel flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[160px_1.2fr_150px_110px_150px_96px] bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 lg:grid">
            <span>Admin</span><span>Hành động</span><span>Tài nguyên</span><span>Kết quả</span><span>Thời gian</span><span></span>
          </div>
          <div className="flex-1">
          {logs.map((log) => (
            <article key={log._id} className={`border-t border-slate-100 px-4 py-3 text-[12px] transition lg:grid lg:grid-cols-[160px_1.2fr_150px_110px_150px_96px] lg:items-center lg:gap-3 ${selectedLog?._id === log._id ? 'bg-teal-50/60' : 'hover:bg-slate-50'}`}>
              <div className="min-w-0"><p className="truncate font-extrabold text-slate-950">{log.admin_email || compactId(log.admin_id)}</p><p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{compactId(log.admin_id)}</p></div>
              <div className="mt-3 min-w-0 lg:mt-0"><p className="truncate font-bold text-slate-800">{log.action}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{log.method || 'GET'} · {log.path || 'Chưa có path'}</p></div>
              <div className="mt-3 lg:mt-0"><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-extrabold text-slate-700">{log.target_type || 'N/A'}</span></div>
              <div className="mt-3 lg:mt-0"><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-extrabold ${log.success ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{log.success ? 'Thành công' : 'Thất bại'}</span></div>
              <div className="mt-3 text-[11px] font-medium text-slate-500 lg:mt-0">{formatDateTime(log.created_at)}</div>
              <button type="button" onClick={() => setSelectedLog(log)} className="mt-3 h-9 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-slate-700 transition hover:bg-slate-50 lg:mt-0">Xem</button>
            </article>
          ))}
          {!logs.length ? <div className="flex min-h-[360px] items-center justify-center px-4 py-10 text-center text-[13px] font-semibold text-slate-400">{loading ? 'Đang tải audit log...' : 'Không có log phù hợp.'}</div> : null}
          </div>
          <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Trang {pagination.page || 1}/{pagination.total_pages || 1} · Tổng {pagination.total || logs.length} log</span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button type="button" disabled={Number(pagination.page) <= 1} onClick={() => changePage(Number(pagination.page || 1) - 1)} className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
              <button type="button" disabled={Number(pagination.page) >= Number(pagination.total_pages || 1)} onClick={() => changePage(Number(pagination.page || 1) + 1)} className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
            </div>
          </div>
        </section>

        <AdminDrawer open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title="Chi tiết audit log" subtitle={selectedLog ? `${selectedLog.method || 'GET'} · ${selectedLog.path || 'Không có path'}` : ''} wide>
          {selectedLog ? (
            <div className="p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Admin</p><p className="mt-1 text-[12px] font-bold text-slate-800">{selectedLog.admin_email || compactId(selectedLog.admin_id)}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Hành động</p><p className="mt-1 text-[12px] font-bold text-slate-800">{selectedLog.action}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Tài nguyên</p><p className="mt-1 text-[12px] font-bold text-slate-800">{selectedLog.target_type || "Chưa có"}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">ID m?c ti?u</p><p className="mt-1 text-[12px] font-bold text-slate-800">{selectedLog.target_id ? compactId(selectedLog.target_id) : 'Chưa có'}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Đường dẫn</p><p className="mt-1 text-[12px] font-bold text-slate-800 break-all">{selectedLog.path || 'Chưa có'}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Phương thức / trạng thái</p><p className="mt-1 text-[12px] font-bold text-slate-800">{selectedLog.method || 'N/A'} · {selectedLog.status_code || 'N/A'}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">IP</p><p className="mt-1 text-[12px] font-bold text-slate-800">{selectedLog.ip || 'Chưa có'}</p></div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Thời gian</p><p className="mt-1 text-[12px] font-bold text-slate-800">{formatDateTime(selectedLog.created_at)}</p></div>
              </div>
              <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Payload thay đổi / metadata</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-[12px] font-medium leading-5 text-slate-600">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
              </div>
            </div>
          ) : null}
        </AdminDrawer>
      </section>
    </AdminLayout>
  )
}
