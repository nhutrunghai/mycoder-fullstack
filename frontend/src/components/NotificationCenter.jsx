import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardSidebar from './DashboardSidebar.jsx'
import { formatDateTimeVi as formatDateTime } from '../utils/formatters.js'
import Toast from './Toast.jsx'
import {
  emitUnreadNotificationCount,
  getUserNotificationUnreadCount,
  getUserNotifications,
  markAllUserNotificationsAsRead,
  markUserNotificationAsRead,
} from '../api/notificationService.js'

const typeLabelMap = {
  job_application_submitted: 'Ứng tuyển',
  job_application_status_updated: 'Cập nhật hồ sơ',
  company_verification_updated: 'Xác minh công ty',
  wallet_topup_succeeded: 'Nạp ví',
  wallet_adjusted: 'Điều chỉnh ví',
}

function normalizeTitle(title) {
  if (!title) return 'Thông báo'
  if (title === 'So du vi da duoc dieu chinh') return 'Số dư ví đã được điều chỉnh'
  if (title === 'Co ung vien moi') return 'Có ứng viên mới'
  if (title === 'Nap tien thanh cong') return 'Nạp tiền ví thành công'
  return title
}

function normalizeContent(content) {
  if (!content) return ''
  if (content.startsWith('Vi cua ban duoc cong')) {
    return content.replace('Vi cua ban duoc cong', 'Ví của bạn được cộng')
  }
  if (content.startsWith('Vi cua ban bi tru')) {
    return content.replace('Vi cua ban bi tru', 'Ví của bạn bị trừ')
  }
  return content
}

export default function NotificationCenter({ title, activeKey }) {
  const [activeTab, setActiveTab] = useState('all')
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, total_pages: 1 })
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [toast, setToast] = useState(null)

  const loadNotifications = useCallback(async ({ page = pagination.page, limit = pagination.limit, tab = activeTab } = {}) => {
    const response = await getUserNotifications({
      page,
      limit,
      is_read: tab === 'unread' ? false : undefined,
    })
    const nextItems = response?.notifications || []
    const nextPagination = response?.pagination || { page, limit, total: nextItems.length, total_pages: 1 }
    setItems(nextItems)
    setPagination(nextPagination)
    return nextItems
  }, [activeTab, pagination.limit, pagination.page])

  const loadUnreadCount = useCallback(async () => {
    const count = await getUserNotificationUnreadCount()
    setUnreadCount(count)
    emitUnreadNotificationCount(count)
    return count
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadNotifications({ page: pagination.page, limit: pagination.limit, tab: activeTab }), loadUnreadCount()])
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải thông báo.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeTab, loadNotifications, loadUnreadCount, pagination.limit, pagination.page])

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }))
  }, [activeTab])

  const tabItems = useMemo(
    () => [
      { key: 'all', label: 'Tất cả', count: pagination.total || items.length, icon: 'notifications' },
      { key: 'unread', label: 'Chưa đọc', count: unreadCount, icon: 'mark_email_unread' },
    ],
    [items.length, pagination.total, unreadCount]
  )

  const handleMarkOne = async (notificationId) => {
    setMarkingId(notificationId)
    try {
      const updated = await markUserNotificationAsRead(notificationId)
      setItems((current) =>
        activeTab === 'unread'
          ? current.filter((item) => item._id !== notificationId)
          : current.map((item) =>
              item._id === notificationId
                ? { ...item, ...(updated || {}), is_read: true, read_at: updated?.read_at || new Date().toISOString() }
                : item
            )
      )
      const nextCount = Math.max(0, unreadCount - 1)
      setUnreadCount(nextCount)
      if (activeTab === 'unread') {
        setPagination((current) => ({
          ...current,
          total: Math.max(0, Number(current.total || 0) - 1),
          total_pages: Math.max(1, Math.ceil(Math.max(0, Number(current.total || 0) - 1) / Number(current.limit || 1))),
        }))
      }
      emitUnreadNotificationCount(nextCount)
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể đánh dấu đã đọc.' })
    } finally {
      setMarkingId('')
    }
  }

  const handleMarkAll = async () => {
    if (!unreadCount) return
    setMarkingAll(true)
    try {
      await markAllUserNotificationsAsRead()
      setItems((current) =>
        activeTab === 'unread'
          ? []
          : current.map((item) => ({
              ...item,
              is_read: true,
              read_at: item.read_at || new Date().toISOString(),
            }))
      )
      setUnreadCount(0)
      if (activeTab === 'unread') {
        setPagination((current) => ({ ...current, total: 0, total_pages: 1, page: 1 }))
      }
      emitUnreadNotificationCount(0)
      setToast({ type: 'success', message: 'Đã đánh dấu tất cả là đã đọc.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể đánh dấu tất cả là đã đọc.' })
    } finally {
      setMarkingAll(false)
    }
  }

  const canGoPrev = Number(pagination.page) > 1
  const canGoNext = Number(pagination.page) < Number(pagination.total_pages || 1)

  return (
    <div className="bg-[#f7f9fc] text-on-surface">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <DashboardSidebar activeKey={activeKey} />
      <main className="min-h-screen p-5 lg:ml-64">
        <header className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[21px] font-semibold leading-tight text-slate-900">{title}</h1>
            <p className="mt-1 text-[13px] text-slate-500">{unreadCount} thông báo chưa đọc</p>
          </div>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={!unreadCount || markingAll}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? 'Đang xử lý...' : 'Đánh dấu đọc tất cả'}
          </button>
        </header>

        <section className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-bold transition ${
                    isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : items.length ? (
              items.map((item) => {
                const isUnread = !item.is_read
                const typeLabel = typeLabelMap[item.type] || item.type || 'Thông báo'
                return (
                  <article key={item._id} className={`flex items-start justify-between gap-4 p-4 transition ${isUnread ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50/60'}`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? 'bg-sky-500' : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{normalizeTitle(item.title)}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {typeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{normalizeContent(item.content || item.message)}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">{formatDateTime(item.created_at)}</p>
                      </div>
                    </div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => handleMarkOne(item._id)}
                        disabled={markingId === item._id}
                        className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        {markingId === item._id ? 'Đang xử lý...' : 'Đã đọc'}
                      </button>
                    ) : null}
                  </article>
                )
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                {activeTab === 'unread' ? 'Không có thông báo chưa đọc nào.' : 'Bạn chưa có thông báo nào.'}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
