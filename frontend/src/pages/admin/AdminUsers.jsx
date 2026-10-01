import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import { getAdminUserDetail, getAdminUsers, updateAdminUserStatus } from '../../api/adminService.js'
import { compactId, formatDateVi as formatDate } from '../../utils/formatters.js'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

const roleLabelMap = { 0: 'Ứng viên', 1: 'Nhà tuyển dụng', 2: 'Quản trị viên' }
const statusLabelMap = { 0: 'Đang hoạt động', 1: 'Đã khóa', 2: 'Đã xóa' }
const statusToneMap = {
  0: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  1: 'border-rose-100 bg-rose-50 text-rose-700',
  2: 'border-slate-200 bg-slate-100 text-slate-600',
}
const roleToneMap = {
  0: 'bg-teal-50 text-teal-700',
  1: 'bg-amber-50 text-amber-700',
  2: 'bg-slate-900 text-white',
}

function getInitial(user) {
  return (user?.fullName || user?.username || user?.email || 'U').slice(0, 1).toUpperCase()
}

function Field({ label, value }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-[12px] font-bold text-slate-800">{value || 'Chưa có'}</p>
    </div>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getAdminUsers({
        page: pagination.page,
        limit: pagination.limit,
        keyword: keyword || undefined,
        role: role === '' ? undefined : Number(role),
        status: status === '' ? undefined : Number(status),
      })
        .then((data) => {
          if (!active) return
          setUsers(data?.users ?? [])
          setPagination((current) => ({ ...current, ...(data?.pagination || {}) }))
        })
        .catch((error) => {
          if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh sách người dùng.' })
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, keyword ? 250 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [keyword, role, status, pagination.page, pagination.limit])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [keyword, role, status])

  const stats = useMemo(() => ({
    active: users.filter((user) => Number(user.status) === 0).length,
    banned: users.filter((user) => Number(user.status) === 1).length,
    admins: users.filter((user) => Number(user.role) === 2).length,
    unverified: users.filter((user) => !user.is_verified).length,
  }), [users])

  const handleOpenDetail = async (userId) => {
    setDrawerOpen(true)
    setSelectedUser(null)
    setDetailLoading(true)
    try {
      const detail = await getAdminUserDetail(userId)
      setSelectedUser(detail)
    } catch (error) {
      setDrawerOpen(false)
      setToast({ type: 'error', message: error.message || 'Không thể tải chi tiết người dùng.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedUser(null)
  }

  const handleStatusChange = async (nextStatus) => {
    if (!selectedUser) return
    setUpdatingStatus(true)
    try {
      const result = await updateAdminUserStatus(selectedUser._id, Number(nextStatus))
      const updatedStatus = Number(result?.status ?? nextStatus)
      const updatedAt = result?.updated_at || new Date().toISOString()
      setUsers((current) => current.map((user) => (
        user._id === selectedUser._id ? { ...user, status: updatedStatus, updated_at: updatedAt } : user
      )))
      setSelectedUser((current) => ({ ...current, status: updatedStatus, updated_at: updatedAt }))
      setToast({ type: 'success', message: 'Đã cập nhật trạng thái người dùng.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật trạng thái người dùng.' })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <AdminLayout title="Người dùng" subtitle="Quản lý tài khoản, trạng thái hoạt động và quyền người dùng trong hệ thống.">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section className="admin-metrics mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Đang hoạt động', stats.active, 'text-slate-950'],
          ['Đã khóa', stats.banned, 'text-rose-700'],
          ['Quản trị viên', stats.admins, 'text-slate-950'],
          ['Chưa xác minh', stats.unverified, 'text-amber-700'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
            <p className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="admin-filter-bar mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_170px_110px]">
          <label className="relative">
            <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo tên, email hoặc username..." className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100" />
          </label>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 outline-none">
            <option value="">Tất cả vai trò</option><option value="0">Ứng viên</option><option value="1">Nhà tuyển dụng</option><option value="2">Quản trị viên</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 outline-none">
            <option value="">Tất cả trạng thái</option><option value="0">Đang hoạt động</option><option value="1">Đã khóa</option><option value="2">Đã xóa</option>
          </select>
          <button type="button" onClick={() => { setKeyword(''); setRole(''); setStatus('') }} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50">Đặt lại</button>
        </div>
      </section>

      <section className="admin-data-panel overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1.25fr)_130px_120px_110px_92px] bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 lg:grid">
          <span>Người dùng</span><span>Vai trò</span><span>Trạng thái</span><span>Cập nhật</span><span />
        </div>
        {users.map((user) => (
          <article key={user._id} className="border-t border-slate-100 px-4 py-3 text-[12px] transition hover:bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1.25fr)_130px_120px_110px_92px] lg:items-center lg:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-[13px] font-extrabold text-slate-700 ring-1 ring-slate-200">
                {toSafeImageUrl(user.avatar) ? <img src={toSafeImageUrl(user.avatar)} alt="" className="h-full w-full object-cover" /> : getInitial(user)}
              </div>
              <div className="min-w-0"><p className="truncate font-extrabold text-slate-950">{user.fullName || user.username || 'Người dùng chưa đặt tên'}</p><p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{user.email || 'Chưa có email'}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:contents">
              <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-extrabold ${roleToneMap[user.role] || 'bg-slate-100 text-slate-700'}`}>{roleLabelMap[user.role] ?? user.role}</span>
              <span className={`w-fit rounded-full border px-2 py-1 text-[11px] font-extrabold ${statusToneMap[user.status] || statusToneMap[2]}`}>{statusLabelMap[user.status] ?? user.status}</span>
              <p className="text-[11px] font-semibold text-slate-500 lg:text-[12px]">{formatDate(user.updated_at)}</p>
            </div>
            <button type="button" onClick={() => handleOpenDetail(user._id)} className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 lg:mt-0 lg:w-auto">Xem</button>
          </article>
        ))}
        {!users.length ? <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">{loading ? 'Đang tải danh sách người dùng...' : 'Không tìm thấy người dùng phù hợp.'}</div> : null}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Trang {pagination.page || 1}/{pagination.total_pages || 1} · Tổng {pagination.total || users.length} người dùng</span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button type="button" disabled={!canGoPrev} onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) - 1 }))} className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
            <button type="button" disabled={!canGoNext} onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) + 1 }))} className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
          </div>
        </div>
      </section>

      <AdminDrawer open={drawerOpen} onClose={closeDrawer} title="Chi tiết tài khoản" subtitle={detailLoading ? 'Đang tải dữ liệu người dùng...' : selectedUser?.email || 'Hồ sơ người dùng'}>
        {detailLoading || !selectedUser ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm font-semibold text-slate-400">Đang tải chi tiết...</div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-base font-extrabold text-slate-700 ring-1 ring-slate-200">
                {toSafeImageUrl(selectedUser.avatar) ? <img src={toSafeImageUrl(selectedUser.avatar)} alt="" className="h-full w-full object-cover" /> : getInitial(selectedUser)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold text-slate-950">{selectedUser.fullName || selectedUser.username || 'Người dùng chưa đặt tên'}</h3>
                <p className="mt-1 truncate text-[12px] font-medium text-slate-500">{selectedUser.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${roleToneMap[selectedUser.role] || 'bg-slate-100 text-slate-700'}`}>{roleLabelMap[selectedUser.role] ?? selectedUser.role}</span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold ${statusToneMap[selectedUser.status] || statusToneMap[2]}`}>{statusLabelMap[selectedUser.status] ?? selectedUser.status}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${selectedUser.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{selectedUser.is_verified ? 'Đã xác minh' : 'Chưa xác minh'}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Mã người dùng" value={compactId(selectedUser._id, { prefix: 7, suffix: 5 })} />
              <Field label="Username" value={selectedUser.username} />
              <Field label="Số điện thoại" value={selectedUser.phone} />
              <Field label="Ngày tạo" value={formatDate(selectedUser.created_at)} />
              <Field label="Địa chỉ" value={selectedUser.address} />
              <Field label="Cập nhật" value={formatDate(selectedUser.updated_at)} />
            </div>
            {selectedUser.bio ? <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Giới thiệu</p><p className="mt-2 text-[12px] font-medium leading-5 text-slate-600">{selectedUser.bio}</p></div> : null}
            {Array.isArray(selectedUser.skills) && selectedUser.skills.length ? <div className="mt-3 flex flex-wrap gap-1.5">{selectedUser.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{skill}</span>)}</div> : null}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Hành động trạng thái</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" disabled={updatingStatus || Number(selectedUser.status) === 0} onClick={() => handleStatusChange(0)} className="h-9 rounded-md bg-slate-900 px-3 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Mở khóa</button>
                <button type="button" disabled={updatingStatus || Number(selectedUser.status) === 1 || Number(selectedUser.status) === 2} onClick={() => handleStatusChange(1)} className="h-9 rounded-md border border-rose-200 bg-rose-50 px-3 text-[12px] font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45">Khóa tài khoản</button>
              </div>
              <p className="mt-2 text-[11px] font-medium leading-5 text-slate-400">API hiện chỉ cho phép chuyển trạng thái giữa đang hoạt động và đã khóa.</p>
              <Link to="/admin/wallet-transactions" state={{ userPreview: { _id: selectedUser._id, fullName: selectedUser.fullName, username: selectedUser.username, email: selectedUser.email } }} className="mt-3 flex h-9 items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-3 text-[12px] font-extrabold text-teal-700 transition hover:bg-teal-100">Cộng hoặc trừ tiền cho người dùng này</Link>
            </div>
          </>
        )}
      </AdminDrawer>
    </AdminLayout>
  )
}
