import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import Toast from '../../components/Toast.jsx'
import {
  adjustAdminWalletBalance,
  getAdminUserDetail,
  getAdminUsers,
  getAdminWalletTransactions,
} from '../../api/adminService.js'
import {
  compactId,
  formatCurrencyVi as formatMoney,
  formatDateTimeVi as formatDateTime,
} from '../../utils/formatters.js'

const typeLabelMap = {
  top_up: 'Nạp ví',
  promotion_purchase: 'Mua quảng cáo',
  refund: 'Hoàn tiền',
  adjustment: 'Điều chỉnh ví',
}

const statusLabelMap = {
  pending: 'Đang chờ',
  succeeded: 'Thành công',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
}

const statusToneMap = {
  succeeded: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/10',
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

export default function AdminWalletTransactions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const userIdParam = searchParams.get('user_id') || searchParams.get('userId') || ''

  const [transactions, setTransactions] = useState([])
  const [selectedTx, setSelectedTx] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [toast, setToast] = useState(null)

  // Filters
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [direction, setDirection] = useState('')
  const [filterUser, setFilterUser] = useState(null)

  // Adjustment Modal State
  const [adjustUserSearch, setAdjustUserSearch] = useState('')
  const [adjustUserResults, setAdjustUserResults] = useState([])
  const [adjustSelectedUser, setAdjustSelectedUser] = useState(null)
  const [adjustDirection, setAdjustDirection] = useState('credit')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [searchUserLoading, setSearchUserLoading] = useState(false)

  // Sync user filter info from URL param or location.state
  useEffect(() => {
    if (!userIdParam) {
      setFilterUser(null)
      return
    }

    if (location.state?.userPreview && String(location.state.userPreview._id) === userIdParam) {
      setFilterUser(location.state.userPreview)
      return
    }

    // Otherwise lookup user info
    getAdminUserDetail(userIdParam)
      .then((user) => {
        if (user) setFilterUser(user)
      })
      .catch(() => {
        setFilterUser({ _id: userIdParam, fullName: `Tài khoản ${compactId(userIdParam, { prefix: 6, suffix: 4 })}` })
      })
  }, [userIdParam, location.state])

  // Auto-open Adjust modal if navigated with openAdjust state
  useEffect(() => {
    if (location.state?.openAdjust && location.state?.userPreview) {
      setAdjustSelectedUser(location.state.userPreview)
      setAdjustOpen(true)
    }
  }, [location.state])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const data = await getAdminWalletTransactions({
        page: pagination.page,
        limit: pagination.limit,
        keyword: keyword || undefined,
        type: type || undefined,
        status: status || undefined,
        direction: direction || undefined,
        userId: userIdParam || undefined,
      })
      setTransactions(data?.transactions || data?.data?.transactions || [])
      setPagination((curr) => ({ ...curr, ...(data?.pagination || {}) }))
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải lịch sử giao dịch.' })
    } finally {
      setLoading(false)
    }
  }

  // Reset page when filter criteria change
  useEffect(() => {
    setPagination((curr) => ({ ...curr, page: 1 }))
  }, [keyword, type, status, direction, userIdParam])

  // Load transactions whenever any filter or pagination page changes
  useEffect(() => {
    loadTransactions()
  }, [pagination.page, keyword, type, status, direction, userIdParam])

  // User search debounce for adjustment modal
  useEffect(() => {
    if (!adjustOpen || !adjustUserSearch.trim()) {
      setAdjustUserResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchUserLoading(true)
      try {
        const data = await getAdminUsers({ page: 1, limit: 5, keyword: adjustUserSearch.trim() })
        setAdjustUserResults(data?.users ?? [])
      } catch {
        setAdjustUserResults([])
      } finally {
        setSearchUserLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [adjustUserSearch, adjustOpen])

  const stats = useMemo(() => {
    let creditTotal = 0
    let debitTotal = 0
    transactions.forEach((tx) => {
      const amt = Number(tx.amount || 0)
      if (tx.direction === 'credit') creditTotal += amt
      else debitTotal += amt
    })
    return { creditTotal, debitTotal }
  }, [transactions])

  const handleClearUserFilter = () => {
    setFilterUser(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('user_id')
      next.delete('userId')
      return next
    }, { replace: true })
  }

  const handleResetFilters = () => {
    setKeyword('')
    setType('')
    setStatus('')
    setDirection('')
    setFilterUser(null)
    setPagination((curr) => ({ ...curr, page: 1 }))
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('user_id')
      next.delete('userId')
      return next
    }, { replace: true })
  }

  const handleOpenDetail = (tx) => {
    setSelectedTx(tx)
    setDrawerOpen(true)
  }

  const handleOpenAdjust = () => {
    if (!adjustSelectedUser && filterUser) {
      setAdjustSelectedUser(filterUser)
    }
    setAdjustDirection('credit')
    setAdjustAmount('')
    setAdjustReason('')
    setAdjustOpen(true)
  }

  const handleConfirmAdjust = async (e) => {
    e.preventDefault()
    if (!adjustSelectedUser) {
      setToast({ type: 'error', message: 'Vui lòng tìm và chọn người dùng cần điều chỉnh.' })
      return
    }
    const amt = Number(adjustAmount)
    if (!amt || amt <= 0) {
      setToast({ type: 'error', message: 'Số tiền điều chỉnh phải lớn hơn 0.' })
      return
    }

    setAdjusting(true)
    try {
      await adjustAdminWalletBalance({
        userId: adjustSelectedUser._id,
        direction: adjustDirection,
        amount: amt,
        description: adjustReason.trim() || undefined,
      })
      setToast({ type: 'success', message: 'Đã điều chỉnh số dư ví thành công.' })
      setAdjustOpen(false)
      loadTransactions()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể điều chỉnh số dư ví.' })
    } finally {
      setAdjusting(false)
    }
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <AdminLayout
      title="Quản lý giao dịch số dư ví"
      subtitle="Theo dõi dòng tiền nạp ví SePay, thanh toán dịch vụ và lịch sử điều chỉnh số dư."
      actions={
        <button
          type="button"
          onClick={handleOpenAdjust}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20"
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          <span>Điều chỉnh số dư ví</span>
        </button>
      }
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Tổng GD trang này</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{transactions.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Dòng tiền nạp vào (+)</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-emerald-600 font-mono">
            +{formatMoney(stats.creditTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Dòng tiền thanh toán (-)</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-slate-800 font-mono">
            {stats.debitTotal > 0 ? `-${formatMoney(stats.debitTotal)}` : '0 ₫'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Tổng số GD phù hợp</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-indigo-600 font-mono">
            {pagination.total || transactions.length}
          </p>
        </div>
      </section>

      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_150px_150px_150px_auto]">
          <div className="relative">
            <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={userIdParam ? 'Tìm trong giao dịch của tài khoản này...' : 'Tìm theo mã GD, mã SePay hoặc ghi chú...'}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả loại GD</option>
            <option value="top_up">Nạp ví</option>
            <option value="promotion_purchase">Mua quảng cáo</option>
            <option value="refund">Hoàn tiền</option>
            <option value="adjustment">Điều chỉnh ví</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="succeeded">Thành công</option>
            <option value="pending">Đang chờ</option>
            <option value="failed">Thất bại</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:outline-none transition"
          >
            <option value="">Tất cả chiều</option>
            <option value="credit">Cộng ví (+)</option>
            <option value="debit">Trừ ví (-)</option>
          </select>
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Đặt lại
          </button>
        </div>

        {/* Filter User Tag */}
        {userIdParam ? (
          <div className="mt-3 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-fit">
            <span className="material-symbols-outlined text-[15px] text-indigo-500">account_circle</span>
            <span>
              Đang lọc theo tài khoản:{' '}
              <strong>
                {filterUser?.fullName || filterUser?.username || filterUser?.email || `Tài khoản ${compactId(userIdParam, { prefix: 6, suffix: 4 })}`}
              </strong>
              {filterUser?.email && filterUser.fullName ? (
                <span className="text-[11px] text-indigo-500 font-normal ml-1">({filterUser.email})</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={handleClearUserFilter}
              title="Hủy lọc theo người dùng này"
              className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-indigo-200/60 text-indigo-600 transition ml-1"
            >
              ✕
            </button>
          </div>
        ) : null}
      </section>

      {/* Transactions Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Mã giao dịch</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Loại nghiệp vụ</th>
                <th className="py-3 px-4 text-right">Số tiền biến động</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const user = tx.user || (typeof tx.user_id === 'object' ? tx.user_id : null) || {}
                const isCredit = tx.direction === 'credit'
                const displayName = user.fullName || user.username || (user.email ? user.email.split('@')[0] : 'Người dùng')
                const displayEmail = user.email || (typeof tx.user_id === 'string' ? compactId(tx.user_id) : '—')

                return (
                  <tr key={tx._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {tx.code || tx.transaction_code || tx._id?.slice(-8).toUpperCase()}
                      {tx.sepay_transaction_id ? (
                        <span className="block text-[10px] text-slate-400 font-normal">SePay #{tx.sepay_transaction_id}</span>
                      ) : null}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 truncate max-w-xs">{displayName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {typeLabelMap[tx.type] || tx.type}
                      </span>
                    </td>

                    <td className={`py-3 px-4 text-right font-mono text-xs font-bold whitespace-nowrap ${
                      isCredit ? 'text-emerald-600' : 'text-slate-800'
                    }`}>
                      {isCredit ? '+' : '-'}{formatMoney(tx.amount)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${statusToneMap[tx.status] || 'bg-slate-100 text-slate-600'}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusLabelMap[tx.status] || tx.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(tx)}
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
          {!transactions.length ? (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải lịch sử giao dịch...' : 'Không có giao dịch nào phù hợp.'}
            </div>
          ) : null}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between bg-slate-50/40">
          <span>
            Trang <strong className="text-slate-900 font-semibold">{pagination.page || 1}</strong> / {pagination.total_pages || 1} · Tổng <strong className="text-slate-900 font-semibold">{pagination.total || transactions.length}</strong> giao dịch
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

      {/* Transaction Detail Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Chi tiết giao dịch số dư"
        subtitle={selectedTx?.code || selectedTx?.transaction_code}
      >
        {selectedTx ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Số tiền giao dịch</p>
                <p className={`text-2xl font-bold font-mono mt-0.5 ${
                  selectedTx.direction === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                }`}>
                  {selectedTx.direction === 'credit' ? '+' : '-'}{formatMoney(selectedTx.amount)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${statusToneMap[selectedTx.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabelMap[selectedTx.status] || selectedTx.status}
              </span>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Thông tin nghiệp vụ
              </h4>
              {(() => {
                const detailUser = selectedTx.user || (typeof selectedTx.user_id === 'object' ? selectedTx.user_id : null) || {}
                const customerName = detailUser.fullName || detailUser.username || (detailUser.email ? detailUser.email.split('@')[0] : compactId(selectedTx.user_id))

                return (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50 px-3">
                    <PropertyRow label="Mã giao dịch (Code)" value={selectedTx.code || selectedTx.transaction_code} mono />
                    <PropertyRow label="Khách hàng" value={customerName} />
                    <PropertyRow label="Email khách hàng" value={detailUser.email} />
                    <PropertyRow label="Loại giao dịch" value={typeLabelMap[selectedTx.type] || selectedTx.type} />
                    <PropertyRow label="Chiều dòng tiền" value={selectedTx.direction === 'credit' ? 'Cộng tiền vào ví' : 'Trừ tiền khỏi ví'} />
                    <PropertyRow label="Mã tham chiếu SePay" value={selectedTx.sepay_transaction_id} mono />
                    <PropertyRow label="Ngân hàng thụ hưởng" value={selectedTx.payment_details?.bank_brand_name || selectedTx.bank_brand_name} />
                    <PropertyRow label="Nội dung chuyển khoản" value={selectedTx.payment_details?.content || selectedTx.description} />
                    <PropertyRow label="Thời gian tạo" value={formatDateTime(selectedTx.created_at)} mono />
                  </div>
                )
              })()}
            </div>
          </div>
        ) : null}
      </AdminDrawer>

      {/* Adjust Wallet Balance Modal */}
      <AdminModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Điều chỉnh số dư ví khách hàng"
        subtitle="Cộng hoặc trừ số dư ví thủ công kèm ghi chú kiểm toán."
      >
        <form onSubmit={handleConfirmAdjust} className="space-y-4 text-xs">
          {/* User Search & Select */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Tìm khách hàng cần điều chỉnh <span className="text-rose-500">*</span>
            </label>
            {adjustSelectedUser ? (
              <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {adjustSelectedUser.fullName || adjustSelectedUser.username}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{adjustSelectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustSelectedUser(null)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition px-2 py-1"
                >
                  Thay đổi
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    search
                  </span>
                  <input
                    value={adjustUserSearch}
                    onChange={(e) => setAdjustUserSearch(e.target.value)}
                    placeholder="Nhập email, họ tên hoặc username để tìm..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
                  />
                </div>
                {searchUserLoading ? (
                  <div className="p-2 text-center text-slate-400 text-xs">Đang tìm tài khoản...</div>
                ) : adjustUserResults.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {adjustUserResults.map((u) => (
                      <button
                        key={u._id}
                        type="button"
                        onClick={() => { setAdjustSelectedUser(u); setAdjustUserSearch('') }}
                        className="w-full text-left p-2 hover:bg-slate-50 transition flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{u.fullName || u.username}</p>
                          <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-indigo-600 shrink-0">Chọn</span>
                      </button>
                    ))}
                  </div>
                ) : adjustUserSearch ? (
                  <div className="p-2 text-center text-slate-400 text-xs">Không tìm thấy người dùng phù hợp.</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Thao tác</label>
              <select
                value={adjustDirection}
                onChange={(e) => setAdjustDirection(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
              >
                <option value="credit">Cộng tiền (+)</option>
                <option value="debit">Trừ tiền (-)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Số tiền (VND) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Ví dụ: 100000"
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Lý do điều chỉnh / Ghi chú</label>
            <textarea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Nhập lý do điều chỉnh số dư (ví dụ: Hoàn tiền dịch vụ quảng cáo theo yêu cầu)..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAdjustOpen(false)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={adjusting || !adjustSelectedUser}
              className="h-8 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            >
              {adjusting ? 'Đang thực hiện...' : 'Xác nhận điều chỉnh'}
            </button>
          </div>
        </form>
      </AdminModal>
    </AdminLayout>
  )
}