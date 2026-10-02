import { useEffect, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.jsx'
import Toast from '../../components/Toast.jsx'
import {
  getAdminMe,
  getAdminUserDetail,
  getAdminUsers,
  getAdminUserWallet,
  getAdminUserApplications,
  getAdminUserTopUpOrders,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../../api/adminService.js'
import { compactId, formatCurrencyVi, formatDateVi as formatDate } from '../../utils/formatters.js'
import { toSafeImageUrl } from '../../utils/safeUrl.js'

const roleLabelMap = { 0: 'Ứng viên', 1: 'Nhà tuyển dụng', 2: 'Quản trị viên' }
const statusLabelMap = { 0: 'Đang hoạt động', 1: 'Đã khóa', 2: 'Đã xóa' }

const statusToneMap = {
  0: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  1: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  2: 'bg-slate-100 text-slate-600 ring-slate-500/10',
}

const orderStatusLabelMap = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
}

const orderStatusToneMap = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/10',
}

const applicationStatusLabelMap = {
  submitted: 'Đã nộp',
  reviewing: 'Đang xem xét',
  shortlisted: 'Phù hợp',
  interviewing: 'Phỏng vấn',
  rejected: 'Từ chối',
  accepted: 'Trúng tuyển',
  withdrawn: 'Đã rút',
}

const applicationStatusToneMap = {
  submitted: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  reviewing: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  shortlisted: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  interviewing: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  withdrawn: 'bg-slate-100 text-slate-600 ring-slate-500/10',
}

const roleToneMap = {
  0: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  1: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  2: 'bg-slate-900 text-white ring-slate-900/20',
}

function getInitial(user) {
  return (user?.fullName || user?.username || user?.email || 'U').slice(0, 1).toUpperCase()
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

export default function AdminUsers() {
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    deleted: 0,
    admins: 0,
    unverified: 0,
  })
  const [selectedUser, setSelectedUser] = useState(null)
  const [userWallet, setUserWallet] = useState(null)
  const [userApplications, setUserApplications] = useState([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [userOrders, setUserOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlKeyword = searchParams.get('keyword') || searchParams.get('email') || ''
  const urlUserId = searchParams.get('userId') || searchParams.get('user_id') || ''
  const [keyword, setKeyword] = useState(urlUserId ? '' : urlKeyword)
  const [filterUser, setFilterUser] = useState(location.state?.userPreview || null)
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [actionProcessing, setActionProcessing] = useState(false)

  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    actionType: null, // 'status' | 'role'
    targetValue: null,
    title: '',
    description: '',
    tone: 'danger',
    confirmLabel: 'Xác nhận',
  })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (urlUserId) {
      handleOpenDetail(urlUserId)
    }
  }, [urlUserId])

  useEffect(() => {
    if (!urlUserId) {
      setFilterUser(null)
      return
    }
    if (location.state?.userPreview && String(location.state.userPreview._id) === urlUserId) {
      setFilterUser(location.state.userPreview)
      return
    }
    const matched = users.find((u) => String(u._id) === urlUserId)
    if (matched) {
      setFilterUser(matched)
      return
    }
    getAdminUserDetail(urlUserId)
      .then((res) => {
        const u = res?.data || res
        if (u) setFilterUser(u)
      })
      .catch(() => {})
  }, [urlUserId, location.state, users])

  useEffect(() => {
    if (!urlUserId && urlKeyword && urlKeyword !== keyword) {
      setKeyword(urlKeyword)
    }
  }, [urlKeyword, urlUserId])

  useEffect(() => {
    getAdminMe()
      .then((data) => {
        setCurrentAdmin(data?.data || data)
      })
      .catch(() => {})
  }, [])

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
        userId: urlUserId || undefined,
      })
        .then((data) => {
          if (!active) return
          setUsers(data?.users ?? [])
          if (data?.stats) {
            setStats(data.stats)
          }
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
  }, [keyword, role, status, urlUserId, pagination.page, pagination.limit])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [keyword, role, status, urlUserId])

  const handleOpenDetail = async (userId) => {
    setDrawerOpen(true)
    setSelectedUser(null)
    setUserWallet(null)
    setUserApplications([])
    setUserOrders([])
    setActiveTab('profile')
    setDetailLoading(true)
    try {
      const [detailData, walletData] = await Promise.all([
        getAdminUserDetail(userId),
        getAdminUserWallet(userId).catch(() => null),
      ])
      const detail = detailData?.data || detailData
      setSelectedUser(detail)
      setUserWallet(walletData?.wallet ?? walletData ?? null)

      if (Number(detail.role) === 0) {
        setApplicationsLoading(true)
        getAdminUserApplications(userId, { limit: 20 })
          .then((appData) => {
            const list = appData?.data?.applications || appData?.applications || []
            setUserApplications(list)
          })
          .catch(() => {})
          .finally(() => {
            setApplicationsLoading(false)
          })
      }

      setOrdersLoading(true)
      getAdminUserTopUpOrders(userId, { limit: 10 })
        .then((orderData) => {
          const orders = orderData?.data?.orders || orderData?.orders || []
          setUserOrders(orders)
        })
        .catch(() => {})
        .finally(() => {
          setOrdersLoading(false)
        })
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
    setUserWallet(null)
    setUserApplications([])
    setUserOrders([])
    setActiveTab('profile')
  }

  // Handle Status change prompt
  const handlePromptStatusChange = (nextStatus) => {
    if (!selectedUser) return
    const isSelf = currentAdmin?._id && String(currentAdmin._id) === String(selectedUser._id)
    if (isSelf && nextStatus === 1) {
      setToast({ type: 'error', message: 'Bạn không thể tự khóa tài khoản quản trị viên đang đăng nhập.' })
      return
    }

    if (nextStatus === 1) {
      setConfirmDialog({
        open: true,
        actionType: 'status',
        targetValue: 1,
        title: 'Khóa tài khoản người dùng',
        description: `Bạn có chắc chắn muốn khóa tài khoản "${selectedUser.email}"? Người dùng này sẽ bị hủy phiên đăng nhập ngay lập tức.`,
        tone: 'danger',
        confirmLabel: 'Khóa tài khoản',
      })
    } else if (nextStatus === 0) {
      setConfirmDialog({
        open: true,
        actionType: 'status',
        targetValue: 0,
        title: 'Mở khóa tài khoản',
        description: `Mở khóa và cho phép tài khoản "${selectedUser.email}" hoạt động lại bình thường?`,
        tone: 'primary',
        confirmLabel: 'Mở khóa',
      })
    }
  }

  // Handle Role change prompt
  const handlePromptRoleChange = (nextRole) => {
    if (!selectedUser) return
    const isSelf = currentAdmin?._id && String(currentAdmin._id) === String(selectedUser._id)
    if (isSelf && nextRole !== 2) {
      setToast({ type: 'error', message: 'Bạn không thể tự thu hồi quyền Quản trị viên của chính mình.' })
      return
    }

    if (nextRole === 2) {
      setConfirmDialog({
        open: true,
        actionType: 'role',
        targetValue: 2,
        title: 'Cấp quyền Quản trị viên',
        description: `Cấp quyền Quản trị viên (Admin) cho người dùng "${selectedUser.email}"? Tài khoản này sẽ có toàn quyền truy cập trang quản trị hệ thống.`,
        tone: 'primary',
        confirmLabel: 'Cấp quyền Admin',
      })
    } else {
      setConfirmDialog({
        open: true,
        actionType: 'role',
        targetValue: 0,
        title: 'Thu hồi quyền Quản trị viên',
        description: `Bạn có chắc chắn muốn thu hồi quyền Quản trị viên của "${selectedUser.email}"? Tài khoản này sẽ không còn quyền truy cập trang quản trị.`,
        tone: 'danger',
        confirmLabel: 'Thu hồi quyền',
      })
    }
  }

  // Confirm execution
  const handleConfirmAction = async () => {
    if (!selectedUser || !confirmDialog.actionType) return
    setActionProcessing(true)

    try {
      if (confirmDialog.actionType === 'status') {
        const nextStatus = confirmDialog.targetValue
        const result = await updateAdminUserStatus(selectedUser._id, Number(nextStatus))
        const updatedStatus = Number(result?.status ?? nextStatus)
        const updatedAt = result?.updated_at || new Date().toISOString()
        setUsers((current) => current.map((user) => (
          user._id === selectedUser._id ? { ...user, status: updatedStatus, updated_at: updatedAt } : user
        )))
        setSelectedUser((current) => ({ ...current, status: updatedStatus, updated_at: updatedAt }))
        setStats((current) => ({
          ...current,
          active: updatedStatus === 0 ? current.active + 1 : Math.max(0, current.active - 1),
          banned: updatedStatus === 1 ? current.banned + 1 : Math.max(0, current.banned - 1),
        }))
        setToast({ type: 'success', message: 'Đã cập nhật trạng thái người dùng thành công.' })
      } else if (confirmDialog.actionType === 'role') {
        const nextRole = confirmDialog.targetValue
        const result = await updateAdminUserRole(selectedUser._id, Number(nextRole))
        const updatedRole = Number(result?.role ?? nextRole)
        const updatedAt = result?.updated_at || new Date().toISOString()
        setUsers((current) => current.map((user) => (
          user._id === selectedUser._id ? { ...user, role: updatedRole, updated_at: updatedAt } : user
        )))
        setSelectedUser((current) => ({ ...current, role: updatedRole, updated_at: updatedAt }))
        setStats((current) => ({
          ...current,
          admins: updatedRole === 2 ? current.admins + 1 : Math.max(0, current.admins - 1),
        }))
        setToast({ type: 'success', message: 'Đã cập nhật phân quyền người dùng thành công.' })
      }

      setConfirmDialog((prev) => ({ ...prev, open: false }))
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Thao tác không thành công.' })
    } finally {
      setActionProcessing(false)
    }
  }

  const isSelectedUserSelf = Boolean(
    currentAdmin?._id && selectedUser?._id && String(currentAdmin._id) === String(selectedUser._id)
  )

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <AdminLayout
      title="Quản lý người dùng"
      subtitle="Quản lý tài khoản, trạng thái hoạt động, số dư ví và phân quyền người dùng trong hệ thống."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards (Real-time DB Totals) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Tổng người dùng', stats.total, 'text-slate-900 bg-slate-100 ring-slate-500/10'],
          ['Đang hoạt động', stats.active, 'text-emerald-700 bg-emerald-50 ring-emerald-600/20'],
          ['Đã khóa', stats.banned, 'text-rose-700 bg-rose-50 ring-rose-600/20'],
          ['Quản trị viên', stats.admins, 'text-indigo-700 bg-indigo-50 ring-indigo-600/20'],
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

      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={urlUserId ? `Tìm trong tài khoản ${filterUser?.fullName || filterUser?.email || ''}...` : 'Tìm theo tên, email hoặc username...'}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
            />
          </div>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
          >
            <option value="">Tất cả vai trò</option>
            <option value="0">Ứng viên</option>
            <option value="1">Nhà tuyển dụng</option>
            <option value="2">Quản trị viên</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="0">Đang hoạt động</option>
            <option value="1">Đã khóa</option>
            <option value="2">Đã xóa</option>
          </select>
        </div>

        {urlUserId ? (
          <div className="mt-3 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span className="material-symbols-outlined text-[15px] text-indigo-500">account_circle</span>
            <span>
              Đang lọc theo tài khoản: <strong>{filterUser?.fullName ? `${filterUser.fullName} (${filterUser.email || filterUser.username || ''})` : (filterUser?.email || (urlUserId ? `ID #${urlUserId.slice(-6)}` : ''))}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setFilterUser(null)
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('userId')
                  next.delete('user_id')
                  next.delete('keyword')
                  next.delete('email')
                  return next
                }, { replace: true })
              }}
              title="Hủy lọc theo tài khoản"
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
                  next.delete('email')
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

      {/* Users Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_140px_130px_130px_90px] bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 lg:grid">
          <span>Người dùng</span>
          <span>Vai trò</span>
          <span>Trạng thái</span>
          <span>Cập nhật</span>
          <span className="text-right">Thao tác</span>
        </div>

        {users.map((user) => {
          const isRowSelf = currentAdmin?._id && String(currentAdmin._id) === String(user._id)

          return (
            <article
              key={user._id}
              className="border-b border-slate-100 last:border-b-0 px-4 py-3 text-xs transition hover:bg-slate-50/70 lg:grid lg:grid-cols-[minmax(0,1.4fr)_140px_130px_130px_90px] lg:items-center lg:gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {toSafeImageUrl(user.avatar) ? (
                    <img src={toSafeImageUrl(user.avatar)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitial(user)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold text-slate-900">
                      {user.fullName || user.username || 'Người dùng chưa đặt tên'}
                    </p>
                    {isRowSelf && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                        Bạn
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-400 font-mono mt-0.5">{user.email || 'Chưa có email'}</p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 lg:mt-0 lg:contents">
                <span className={`w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleToneMap[user.role] || 'bg-slate-100 text-slate-700'}`}>
                  {roleLabelMap[user.role] ?? user.role}
                </span>
                <span className={`w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusToneMap[user.status] || statusToneMap[2]}`}>
                  {statusLabelMap[user.status] ?? user.status}
                </span>
                <p className="text-[11px] text-slate-500 font-medium lg:text-xs">{formatDate(user.updated_at)}</p>
              </div>

              <div className="mt-3 lg:mt-0 text-right">
                <button
                  type="button"
                  onClick={() => handleOpenDetail(user._id)}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 hover:border-slate-300 transition"
                >
                  Chi tiết
                </button>
              </div>
            </article>
          )
        })}

        {!users.length && (
          <div className="px-4 py-12 text-center text-xs font-medium text-slate-400">
            {loading ? 'Đang tải danh sách người dùng...' : 'Không tìm thấy người dùng phù hợp.'}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Trang {pagination.page || 1}/{pagination.total_pages || 1} · Tổng {pagination.total || users.length} người dùng
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) - 1 }))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) + 1 }))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>

      {/* User Detail Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Hồ sơ tài khoản"
        subtitle={detailLoading ? 'Đang tải dữ liệu người dùng...' : selectedUser?.email || 'Chi tiết người dùng'}
      >
        {detailLoading || !selectedUser ? (
          <div className="flex min-h-[320px] items-center justify-center text-xs font-medium text-slate-400">
            Đang tải dữ liệu...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Profile */}
            <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-base font-bold text-slate-700 ring-2 ring-slate-200">
                {toSafeImageUrl(selectedUser.avatar) ? (
                  <img src={toSafeImageUrl(selectedUser.avatar)} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitial(selectedUser)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold text-slate-900">
                    {selectedUser.fullName || selectedUser.username || 'Người dùng chưa đặt tên'}
                  </h3>
                  {isSelectedUserSelf && (
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                      Tài khoản của bạn
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500 font-mono">{selectedUser.email}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${roleToneMap[selectedUser.role] || 'bg-slate-100 text-slate-700'}`}>
                    {roleLabelMap[selectedUser.role] ?? selectedUser.role}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${statusToneMap[selectedUser.status] || statusToneMap[2]}`}>
                    {statusLabelMap[selectedUser.status] ?? selectedUser.status}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${selectedUser.is_verified ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}`}>
                    {selectedUser.is_verified ? 'Đã xác minh email' : 'Chưa xác minh email'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={'flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ' + (activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')}
              >
                <span className="material-symbols-outlined text-[16px]">account_box</span>
                <span>Hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('wallet')}
                className={'flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ' + (activeTab === 'wallet' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')}
              >
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                <span>Ví tài khoản</span>
              </button>

              {Number(selectedUser.role) === 1 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('company')}
                  className={'flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ' + (activeTab === 'company' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')}
                >
                  <span className="material-symbols-outlined text-[16px]">apartment</span>
                  <span>Doanh nghiệp</span>
                </button>
              )}

              {Number(selectedUser.role) === 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('applications')}
                  className={'flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ' + (activeTab === 'applications' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')}
                >
                  <span className="material-symbols-outlined text-[16px]">history_edu</span>
                  <span>Đơn đã nộp ({userApplications.length})</span>
                </button>
              )}
            </div>

            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Profile Properties */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Thông tin tài khoản</h4>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-0.5">
                    <PropertyRow label="Mã định danh (ID)" value={compactId(selectedUser._id, { prefix: 8, suffix: 6 })} mono />
                    <PropertyRow label="Username" value={selectedUser.username} />
                    <PropertyRow label="Số điện thoại" value={selectedUser.phone} />
                    <PropertyRow label="Địa chỉ" value={selectedUser.address} />
                    <PropertyRow label="Ngày tạo tài khoản" value={formatDate(selectedUser.created_at)} />
                    <PropertyRow label="Cập nhật gần nhất" value={formatDate(selectedUser.updated_at)} />
                  </div>
                </div>

                {/* Bio & Skills */}
                {selectedUser.bio && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Giới thiệu</h4>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs text-slate-700 leading-relaxed">
                      {selectedUser.bio}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedUser.skills) && selectedUser.skills.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Kỹ năng</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUser.skills.map((skill) => (
                        <span key={skill} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Role & Status Management Actions */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  {/* Role Selector */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Phân quyền người dùng</h4>
                    <div className="flex items-center gap-2.5">
                      <select
                        value={Number(selectedUser.role)}
                        disabled={actionProcessing || isSelectedUserSelf}
                        onChange={(e) => {
                          const nextRole = Number(e.target.value)
                          if (nextRole !== Number(selectedUser.role)) {
                            handlePromptRoleChange(nextRole)
                          }
                        }}
                        className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value={0}>Ứng viên</option>
                        <option value={2}>Quản trị viên</option>
                      </select>
                      <span className={'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ' + (roleToneMap[selectedUser.role] || 'bg-slate-100 text-slate-700')}>
                        {roleLabelMap[selectedUser.role] ?? selectedUser.role}
                      </span>
                    </div>
                    {isSelectedUserSelf && (
                      <p className="mt-2 text-[11px] text-amber-600 leading-normal">
                        * Không thể thay đổi quyền của tài khoản đang đăng nhập.
                      </p>
                    )}
                  </div>

                  {/* Status Action */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Trạng thái tài khoản</h4>
                    {Number(selectedUser.status) === 1 ? (
                      <button
                        type="button"
                        disabled={actionProcessing}
                        onClick={() => handlePromptStatusChange(0)}
                        className="flex w-full h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">lock_open</span>
                        <span>Mở khóa tài khoản</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionProcessing || isSelectedUserSelf}
                        onClick={() => handlePromptStatusChange(1)}
                        className="flex w-full h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                        <span>{isSelectedUserSelf ? 'Không thể tự khóa tài khoản' : 'Khóa tài khoản'}</span>
                      </button>
                    )}
                  </div>

                  {isSelectedUserSelf && (
                    <p className="text-[11px] text-amber-600 leading-normal">
                      * Không thể tự khóa tài khoản đang đăng nhập.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="space-y-5">
                {/* Wallet Balance Card */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Số dư & Thao tác ví</h4>
                    <div className="flex items-center gap-3">
                      <Link
                        to={'/admin/wallet-transactions?user_id=' + selectedUser._id}
                        state={{
                          userPreview: {
                            _id: selectedUser._id,
                            fullName: selectedUser.fullName,
                            username: selectedUser.username,
                            email: selectedUser.email,
                          },
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                      >
                        <span>Lịch sử GD</span>
                        <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                      </Link>
                      <Link
                        to="/admin/wallet-transactions"
                        state={{
                          userPreview: {
                            _id: selectedUser._id,
                            fullName: selectedUser.fullName,
                            username: selectedUser.username,
                            email: selectedUser.email,
                          },
                          openAdjust: true,
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                      >
                        <span>Cộng/Trừ tiền</span>
                        <span className="material-symbols-outlined text-[14px]">tune</span>
                      </Link>
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Số dư khả dụng</span>
                      <span className="text-lg font-bold text-indigo-900">
                        {formatCurrencyVi(userWallet?.balance ?? 0, userWallet?.currency || 'VND')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-indigo-100/80 pt-2 text-xs">
                      <span className="text-slate-500">Trạng thái ví</span>
                      <span className="font-semibold text-slate-700 capitalize">
                        {userWallet?.status === 'active' ? 'Đang hoạt động' : userWallet?.status || 'Chưa kích hoạt'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Up Orders List */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Lịch sử nạp tiền gần nhất ({userOrders.length})
                  </h4>
                  {ordersLoading ? (
                    <div className="flex min-h-[140px] items-center justify-center text-xs font-medium text-slate-400">
                      Đang tải lịch sử nạp tiền...
                    </div>
                  ) : userOrders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      Chưa có đơn nạp tiền nào.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
                      {userOrders.map((order) => (
                        <div key={order._id} className="p-3 hover:bg-slate-50/60 transition flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 font-mono">
                              #{order.order_code || compactId(order._id, { prefix: 6, suffix: 4 })}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            <span className="font-bold text-slate-900">
                              {formatCurrencyVi(order.amount, order.currency || 'VND')}
                            </span>
                            <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ' + (orderStatusToneMap[order.status] || 'bg-slate-100 text-slate-600')}>
                              {orderStatusLabelMap[order.status] || order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'company' && Number(selectedUser.role) === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Doanh nghiệp quản lý</h4>
                  {selectedUser.company?._id && (
                    <Link
                      to={`/admin/companies?companyId=${selectedUser.company._id}`} state={{ companyName: selectedUser.company.company_name }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                    >
                      <span>Xem trên trang Doanh nghiệp</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  )}
                </div>

                {selectedUser.company ? (
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-start gap-3.5">
                      <div className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {selectedUser.company.logo ? (
                          <img src={selectedUser.company.logo} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-400 text-2xl">apartment</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {selectedUser.company.company_name}
                          </h4>
                          <span className={'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ' + (selectedUser.company.verified ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20')}>
                            {selectedUser.company.verified ? 'Đã xác minh' : 'Chưa xác minh'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 leading-normal">
                          {selectedUser.company.address || 'Chưa cập nhật địa chỉ'}
                        </p>
                        {selectedUser.company.website && (
                          <p className="mt-1 text-xs text-indigo-600 hover:underline truncate">
                            {selectedUser.company.website}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <Link
                        to={`/admin/companies?companyId=${selectedUser.company._id}`} state={{ companyName: selectedUser.company.company_name }}
                        className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition"
                      >
                        <span className="material-symbols-outlined text-[16px]">domain</span>
                        <span>Mở chi tiết doanh nghiệp</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                    Tài khoản nhà tuyển dụng này chưa đăng ký hoặc liên kết doanh nghiệp nào trên hệ thống.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'applications' && Number(selectedUser.role) === 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Lịch sử nộp hồ sơ ({userApplications.length})
                  </h4>
                </div>

                {applicationsLoading ? (
                  <div className="flex min-h-[180px] items-center justify-center text-xs font-medium text-slate-400">
                    Đang tải đơn ứng tuyển...
                  </div>
                ) : userApplications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                    Ứng viên này chưa nộp hồ sơ vào tin tuyển dụng nào.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
                    {userApplications.map((app) => (
                      <div key={app._id} className="p-3.5 hover:bg-slate-50/60 transition flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden mt-0.5">
                            {app.company?.logo ? (
                              <img src={app.company.logo} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <span className="material-symbols-outlined text-slate-400 text-base">domain</span>
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {app.job?.title || 'Tin tuyển dụng'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">apartment</span>
                              <span>{app.company?.company_name || 'Công ty'}</span>
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Nộp: {formatDate(app.applied_at || app.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ' + (applicationStatusToneMap[app.status] || 'bg-slate-100 text-slate-600')}>
                            {applicationStatusLabelMap[app.status] || app.status}
                          </span>
                          {app.company?.company_name && (
                            <Link
                              to={app.company?._id ? `/admin/companies?companyId=${app.company._id}` : `/admin/companies?keyword=${encodeURIComponent(app.company.company_name)}`} state={{ companyName: app.company?.company_name }}
                              className="text-[11px] font-medium text-indigo-600 hover:underline flex items-center gap-0.5"
                            >
                              <span>Xem cty</span>
                              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AdminDrawer>

      {/* Confirmation Dialog */}
      <AdminConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmAction}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        confirming={actionProcessing}
        tone={confirmDialog.tone}
      />
    </AdminLayout>
  )
}