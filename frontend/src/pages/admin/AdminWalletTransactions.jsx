import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import { adjustAdminWalletBalance, getAdminUsers, getAdminWalletTransactions } from '../../api/adminService.js'
import { compactId, formatCurrencyVi as formatMoney, formatDateTimeVi as formatDateTime } from '../../utils/formatters.js'

const transactionTypeOptions = [
  { value: '', label: 'Tất cả loại giao dịch' },
  { value: 'top_up', label: 'Nạp ví' },
  { value: 'promotion_purchase', label: 'Mua quảng cáo' },
  { value: 'refund', label: 'Hoàn tiền' },
  { value: 'adjustment', label: 'Điều chỉnh ví' },
]

const transactionStatusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Đang chờ' },
  { value: 'succeeded', label: 'Thành công' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'cancelled', label: 'Đã hủy' },
]

const directionOptions = [
  { value: '', label: 'Tất cả chiều giao dịch' },
  { value: 'credit', label: 'Cộng vào ví' },
  { value: 'debit', label: 'Trừ khỏi ví' },
]

const directionAdjustOptions = [
  { value: 'credit', label: 'Cộng tiền' },
  { value: 'debit', label: 'Trừ tiền' },
]

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
  pending: 'border-amber-100 bg-amber-50 text-amber-700',
  succeeded: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-100 bg-rose-50 text-rose-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
}

const directionToneMap = {
  credit: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  debit: 'border-rose-100 bg-rose-50 text-rose-700',
}

function StatCard({ label, value, tone = 'text-slate-950' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1 text-[12px] font-bold text-slate-800">{value || 'Chưa có'}</p>
    </div>
  )
}

function PickerModal({ title, subtitle, open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-extrabold text-slate-950">{title}</h3>
            <p className="mt-1 text-[12px] font-medium text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="max-h-[calc(85vh-76px)] overflow-auto">{children}</div>
      </div>
    </div>
  )
}

function UserPickerModal({ open, onClose, onSelect }) {
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      getAdminUsers({ page: 1, limit: 8, keyword: keyword || undefined })
        .then((data) => {
          if (!active) return
          setUsers(data?.users ?? [])
        })
        .catch((err) => {
          if (active) setError(err.message || 'Không thể tải danh sách người dùng.')
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

  return (
    <PickerModal
      open={open}
      onClose={onClose}
      title="Chọn người dùng"
      subtitle="Tìm kiếm và chọn người dùng cho giao dịch ví."
    >
      <div className="p-5">
        <label className="relative block">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên, email hoặc username..."
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
          />
        </label>

        <div className="mt-4 space-y-2">
          {users.map((user) => (
            <article key={user._id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-extrabold text-slate-950">{user.fullName || user.username || user.email || 'Người dùng chưa đặt tên'}</p>
                <p className="mt-1 truncate text-[12px] font-medium text-slate-500">{user.email || 'Chưa có email'} · {compactId(user._id)}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelect(user)}
                className="h-9 shrink-0 rounded-md border border-teal-200 bg-teal-50 px-4 text-[12px] font-extrabold text-teal-700 transition hover:bg-teal-100"
              >
                Chọn người dùng này
              </button>
            </article>
          ))}

          {!users.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
              {loading ? 'Đang tải danh sách người dùng...' : error || 'Không tìm thấy người dùng phù hợp.'}
            </div>
          ) : null}
        </div>
      </div>
    </PickerModal>
  )
}

const inputClassName =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

export default function AdminWalletTransactions() {
  const location = useLocation()
  const [transactions, setTransactions] = useState([])
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submittingAdjust, setSubmittingAdjust] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedUserPreview, setSelectedUserPreview] = useState(location.state?.userPreview || null)
  const [userSearchKeyword, setUserSearchKeyword] = useState(() => {
    const p = location.state?.userPreview
    return p ? (p.fullName || p.username || p.email || '') : ''
  })
  const [searchUsersList, setSearchUsersList] = useState([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchContainerRef = useRef(null)

  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    direction: '',
  })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 })
  const [adjustForm, setAdjustForm] = useState({
    amount: '',
    direction: 'credit',
    description: '',
  })

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (location.state?.userPreview?._id) {
      setSelectedUserPreview(location.state.userPreview)
      setUserSearchKeyword(location.state.userPreview.fullName || location.state.userPreview.username || location.state.userPreview.email || '')
    }
  }, [location.state])

  useEffect(() => {
    if (!userSearchKeyword.trim() || selectedUserPreview) {
      setSearchUsersList([])
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      setSearchingUsers(true)
      getAdminUsers({ page: 1, limit: 6, keyword: userSearchKeyword.trim() })
        .then((data) => {
          if (!active) return
          setSearchUsersList(data?.users ?? [])
        })
        .catch(() => {
          if (!active) return
          setSearchUsersList([])
        })
        .finally(() => {
          if (active) setSearchingUsers(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [userSearchKeyword, selectedUserPreview])

  useEffect(() => {
    let active = true
    setLoading(true)

    const userIdToFilter = selectedUserPreview?._id || (/^[a-fA-F0-9]{24}$/.test(userSearchKeyword.trim()) ? userSearchKeyword.trim() : undefined)

    getAdminWalletTransactions({
      page: pagination.page,
      limit: pagination.limit,
      userId: userIdToFilter,
      type: filters.type || undefined,
      status: filters.status || undefined,
      direction: filters.direction || undefined,
    })
      .then((data) => {
        if (!active) return
        const nextTransactions = data?.transactions ?? []
        setTransactions(nextTransactions)
        setPagination((current) => ({ ...current, ...(data?.pagination || {}) }))

        if (selectedTransaction?._id) {
          const updated = nextTransactions.find((item) => item._id === selectedTransaction._id)
          if (updated) setSelectedTransaction(updated)
        }
      })
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh sách giao dịch ví.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [filters.direction, filters.status, filters.type, pagination.limit, pagination.page, selectedTransaction?._id, selectedUserPreview?._id, userSearchKeyword])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [filters.direction, filters.status, filters.type, selectedUserPreview?._id, userSearchKeyword])

  const stats = useMemo(
    () => ({
      succeeded: transactions.filter((item) => item.status === 'succeeded').length,
      topup: transactions.filter((item) => item.type === 'top_up').length,
      promotion: transactions.filter((item) => item.type === 'promotion_purchase').length,
      adjusted: transactions.filter((item) => item.type === 'adjustment').length,
    }),
    [transactions]
  )

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  const handleSubmitAdjust = async (event) => {
    event.preventDefault()
    if (!selectedUserPreview?._id) {
      setToast({ type: 'error', message: 'Hãy chọn người dùng trước khi điều chỉnh ví.' })
      return
    }

    const normalizedUserId = String(selectedUserPreview._id || '').trim()
    const normalizedAmount = Number.parseInt(String(adjustForm.amount || '').trim(), 10)
    const normalizedDescription = String(adjustForm.description || '').trim()
    const finalDescription =
      normalizedDescription ||
      (adjustForm.direction === 'debit'
        ? `Dieu chinh tru tien thu cong ${normalizedAmount.toLocaleString('vi-VN')} VND`
        : `Dieu chinh cong tien thu cong ${normalizedAmount.toLocaleString('vi-VN')} VND`)

    if (!/^[a-fA-F0-9]{24}$/.test(normalizedUserId)) {
      setToast({ type: 'error', message: 'Người dùng đang chọn không hợp lệ. Hãy chọn lại người dùng trước khi điều chỉnh ví.' })
      return
    }

    if (!Number.isInteger(normalizedAmount) || normalizedAmount < 1) {
      setToast({ type: 'error', message: 'So tien phai la so nguyen duong.' })
      return
    }

    setSubmittingAdjust(true)
    try {
      const result = await adjustAdminWalletBalance({
        userId: normalizedUserId,
        amount: normalizedAmount,
        direction: adjustForm.direction,
        description: finalDescription,
      })

      setAdjustForm({
        amount: '',
        direction: 'credit',
        description: '',
      })

      if (result?.transaction) setSelectedTransaction(result.transaction)
      setToast({ type: 'success', message: 'Đã điều chỉnh số dư ví thành công.' })
      setIsAdjustOpen(false)
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể điều chỉnh số dư ví.' })
    } finally {
      setSubmittingAdjust(false)
    }
  }

  const handlePickUser = (user) => {
    setSelectedUserPreview({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
    })
    setIsUserPickerOpen(false)
  }

  return (
    <AdminLayout
      title="Giao Dịch Ví"
      subtitle="Theo dõi giao dịch ví toàn hệ thống và thực hiện cộng hoặc trừ tiền trực tiếp vào ví người dùng khi cần."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />
      <UserPickerModal open={isUserPickerOpen} onClose={() => setIsUserPickerOpen(false)} onSelect={handlePickUser} />

      <section className="admin-metrics mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Thành công" value={stats.succeeded} tone="text-emerald-700" />
        <StatCard label="Nạp ví" value={stats.topup} tone="text-slate-950" />
        <StatCard label="Mua quảng cáo" value={stats.promotion} tone="text-teal-700" />
        <StatCard label="Điều chỉnh ví" value={stats.adjusted} tone="text-amber-700" />
      </section>

      <section className="mb-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="text-sm font-extrabold text-slate-950">Bộ lọc giao dịch</p><p className="mt-1 text-xs font-medium text-slate-500">Lọc theo user, loại, chiều và trạng thái giao dịch.</p></div>
          <button type="button" onClick={() => setIsAdjustOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-[13px] font-extrabold text-white transition hover:bg-teal-800"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit_square</span>Điều chỉnh ví</button>
        </div>
        {isAdjustOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
            <div className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-[16px] font-extrabold text-slate-950">Điều chỉnh số dư ví</h3>
                  <p className="mt-0.5 text-[12px] font-medium text-slate-500">Chọn người dùng, nhập số tiền và ghi rõ lý do trước khi thực hiện.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmitAdjust} className="max-h-[calc(90vh-76px)] overflow-y-auto p-5">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Người dùng đang chọn</p>
                      <button
                        type="button"
                        onClick={() => setIsUserPickerOpen(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-[12px] font-extrabold text-teal-700 transition hover:bg-teal-100"
                      >
                        <span className="material-symbols-outlined text-[16px]">person_search</span>
                        {selectedUserPreview ? 'Đổi người dùng' : 'Chọn người dùng'}
                      </button>
                    </div>

                    {selectedUserPreview ? (
                      <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-extrabold text-slate-900">
                              {selectedUserPreview.fullName || selectedUserPreview.username || selectedUserPreview.email || 'Người dùng đã chọn'}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">
                              {selectedUserPreview.email || compactId(selectedUserPreview._id)} · <span className="font-mono">{compactId(selectedUserPreview._id)}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedUserPreview(null)}
                            className="inline-flex h-7 shrink-0 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] font-extrabold text-rose-700 transition hover:bg-rose-100"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-center py-3">
                        <p className="text-[12px] font-medium text-slate-500">Chưa có người dùng nào được chọn. Bấm "Chọn người dùng" để tìm kiếm.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">Số tiền (VNĐ)</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="VD: 50000"
                        value={adjustForm.amount}
                        onChange={(event) => setAdjustForm((current) => ({ ...current, amount: event.target.value }))}
                        className={inputClassName}
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">Chiều giao dịch</span>
                      <select
                        value={adjustForm.direction}
                        onChange={(event) => setAdjustForm((current) => ({ ...current, direction: event.target.value }))}
                        className={inputClassName}
                      >
                        {directionAdjustOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">Mô tả lý do</span>
                    <textarea
                      rows="3"
                      value={adjustForm.description}
                      onChange={(event) => setAdjustForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Ví dụ: Điều chỉnh thủ công theo yêu cầu đối soát"
                      className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAdjustOpen(false)}
                      className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAdjust || !selectedUserPreview?._id}
                      className="flex h-10 items-center justify-center rounded-lg bg-teal-700 px-5 text-[13px] font-extrabold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {submittingAdjust ? 'Đang xử lý...' : 'Thực hiện điều chỉnh'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <section className="admin-filter-bar rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_160px_160px_160px_100px]">
            <div className="relative" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 text-[18px] text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={userSearchKeyword}
                  onChange={(event) => {
                    const val = event.target.value
                    setUserSearchKeyword(val)
                    setIsDropdownOpen(true)
                    if (!val.trim()) {
                      setSelectedUserPreview(null)
                    }
                  }}
                  onFocus={() => {
                    if (userSearchKeyword.trim() || searchUsersList.length > 0) {
                      setIsDropdownOpen(true)
                    }
                  }}
                  placeholder="Tìm theo tên người dùng, email hoặc mã ID..."
                  className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-9 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
                {userSearchKeyword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUserSearchKeyword('')
                      setSelectedUserPreview(null)
                      setIsDropdownOpen(false)
                    }}
                    className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    title="Xóa tìm kiếm"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                ) : null}
              </div>

              {isDropdownOpen && userSearchKeyword.trim() && !selectedUserPreview && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                  {searchingUsers ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-slate-500">
                      <span className="material-symbols-outlined animate-spin text-[16px] text-teal-600">progress_activity</span>
                      Đang tìm người dùng...
                    </div>
                  ) : searchUsersList.length > 0 ? (
                    searchUsersList.map((user) => (
                      <button
                        key={user._id}
                        type="button"
                        onClick={() => {
                          setSelectedUserPreview(user)
                          setUserSearchKeyword(user.fullName || user.username || user.email || user._id)
                          setIsDropdownOpen(false)
                        }}
                        className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2 text-left transition hover:bg-teal-50/50 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-extrabold text-slate-900">
                            {user.fullName || user.username || user.email || 'Người dùng'}
                          </p>
                          <p className="truncate text-[11px] font-medium text-slate-500">
                            {user.email || 'Chưa có email'} · <span className="font-mono text-slate-400">{compactId(user._id)}</span>
                          </p>
                        </div>
                        <span className="shrink-0 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-extrabold text-teal-700">
                          Lọc
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-center text-[12px] text-slate-400">
                      Không tìm thấy người dùng phù hợp
                    </div>
                  )}
                </div>
              )}
            </div>

            <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className={inputClassName}>
              {transactionTypeOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className={inputClassName}>
              {transactionStatusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={filters.direction} onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value }))} className={inputClassName}>
              {directionOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setUserSearchKeyword('')
                setSelectedUserPreview(null)
                setIsDropdownOpen(false)
                setFilters({ type: '', status: '', direction: '' })
              }}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50"
            >
              Đặt lại
            </button>
          </div>
        </section>
      </section>

      <section>
        <section className="admin-data-panel overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1.05fr)_130px_110px_105px_120px_184px] bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 lg:grid">
            <span>Người dùng</span>
            <span>Loại</span>
            <span>Chiều</span>
            <span>Trạng thái</span>
            <span>Số tiền</span>
            <span></span>
          </div>

          {transactions.map((transaction) => (
            <article
              key={transaction._id}
              className={`border-t border-slate-100 px-4 py-3 text-[12px] transition hover:bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1.05fr)_130px_110px_105px_120px_184px] lg:items-center lg:gap-3 ${
                selectedTransaction?._id === transaction._id ? 'bg-teal-50/60' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-extrabold text-slate-950">{transaction.user?.fullName || transaction.user?.username || transaction.user?.email || 'Không rõ người dùng'}</p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{transaction.user?.email || compactId(transaction.user_id)}</p>
              </div>

              <div className="mt-3 lg:mt-0">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                  {typeLabelMap[transaction.type] || transaction.type}
                </span>
              </div>

              <div className="mt-3 lg:mt-0">
                <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-extrabold ${directionToneMap[transaction.direction] || directionToneMap.credit}`}>
                  {transaction.direction === 'credit' ? 'Cộng' : 'Trừ'}
                </span>
              </div>

              <div className="mt-3 lg:mt-0">
                <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-extrabold ${statusToneMap[transaction.status] || statusToneMap.pending}`}>
                  {statusLabelMap[transaction.status] || transaction.status}
                </span>
              </div>

              <div className="mt-3 text-[12px] font-extrabold lg:mt-0">
                <span className={transaction.direction === 'credit' ? 'text-emerald-700' : 'text-rose-700'}>
                  {transaction.direction === 'credit' ? '+' : '-'} {formatMoney(transaction.amount, transaction.currency)}
                </span>
              </div>

              <div className="mt-3 lg:mt-0">
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(transaction)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-slate-700 transition hover:bg-slate-50"
                >
                  Xem
                </button>
              </div>
            </article>
          ))}

          {!transactions.length ? (
            <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
              {loading ? 'Đang tải danh sách giao dịch ví...' : 'Không có giao dịch ví phù hợp.'}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Trang {pagination.page || 1}/{pagination.total_pages || 1} · Tổng {pagination.total || transactions.length} giao dịch</span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) - 1 }))}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setPagination((current) => ({ ...current, page: Number(current.page || 1) + 1 }))}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </section>

        <AdminDrawer open={Boolean(selectedTransaction)} onClose={() => setSelectedTransaction(null)} title="Chi tiết giao dịch" subtitle={selectedTransaction ? `${typeLabelMap[selectedTransaction.type] || selectedTransaction.type} · ${selectedTransaction.user?.email || compactId(selectedTransaction.user_id)}` : ''} wide>
          {selectedTransaction ? (
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold leading-6 text-slate-950">{typeLabelMap[selectedTransaction.type] || selectedTransaction.type}</h3>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">{selectedTransaction.user?.email || compactId(selectedTransaction.user_id)}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-extrabold ${statusToneMap[selectedTransaction.status] || statusToneMap.pending}`}>
                  {statusLabelMap[selectedTransaction.status] || selectedTransaction.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Mã giao dịch" value={compactId(selectedTransaction._id)} />
                <Field label="Mã ví" value={compactId(selectedTransaction.wallet_id)} />
                <Field label="Mã người dùng" value={compactId(selectedTransaction.user_id)} />
                <Field label="Loại" value={typeLabelMap[selectedTransaction.type] || selectedTransaction.type} />
                <Field label="Chiều giao dịch" value={selectedTransaction.direction === 'credit' ? 'Cộng vào ví' : 'Trừ khỏi ví'} />
                <Field label="Trạng thái" value={statusLabelMap[selectedTransaction.status] || selectedTransaction.status} />
                <Field label="Số tiền" value={formatMoney(selectedTransaction.amount, selectedTransaction.currency)} />
                <Field label="Tiền tệ" value={selectedTransaction.currency} />
                <Field label="Số dư trước" value={formatMoney(selectedTransaction.balance_before, selectedTransaction.currency)} />
                <Field label="Số dư sau" value={formatMoney(selectedTransaction.balance_after, selectedTransaction.currency)} />
                <Field label="Reference type" value={selectedTransaction.reference_type || 'Chưa có'} />
                <Field label="Reference id" value={selectedTransaction.reference_id ? compactId(selectedTransaction.reference_id) : 'Chưa có'} />
                <Field label="Tạo lúc" value={formatDateTime(selectedTransaction.created_at)} />
                <Field label="Cập nhật" value={formatDateTime(selectedTransaction.updated_at)} />
              </div>



              {selectedTransaction.description ? (
                <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Mô tả</p>
                  <p className="mt-2 whitespace-pre-line text-[12px] font-medium leading-5 text-slate-600">{selectedTransaction.description}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </AdminDrawer>
      </section>
    </AdminLayout>
  )
}
