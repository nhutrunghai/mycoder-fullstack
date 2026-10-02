import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  emitUnreadNotificationCount,
  getUserNotificationUnreadCount,
  getUserNotifications,
  markUserNotificationAsRead,
  subscribeUnreadNotificationCount,
} from '../api/notificationService.js'

function formatNotificationTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getNotificationTitle(item) {
  const raw = item?.title || item?.data?.title || item?.metadata?.title || ''
  if (!raw) return 'Thông báo'
  // Auto-normalize unaccented titles for backward compatibility with old database records
  if (raw === 'So du vi da duoc dieu chinh') return 'Số dư ví đã được điều chỉnh'
  if (raw === 'Co ung vien moi') return 'Có ứng viên mới'
  if (raw === 'Nap tien thanh cong') return 'Nạp tiền ví thành công'
  return raw
}

function getNotificationMessage(item) {
  const raw = item?.message || item?.content || item?.data?.message || item?.metadata?.message || ''
  if (!raw) return 'Bạn có một thông báo mới.'
  // Auto-normalize unaccented contents for backward compatibility with old database records
  if (raw.startsWith('Vi cua ban duoc cong')) {
    return raw.replace('Vi cua ban duoc cong', 'Ví của bạn được cộng')
  }
  if (raw.startsWith('Vi cua ban bi tru')) {
    return raw.replace('Vi cua ban bi tru', 'Ví của bạn bị trừ')
  }
  return raw
}

export default function NotificationBell({ className = '', iconClassName = '', badgeClassName = '' }) {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState('')

  const loadUnreadCount = async () => {
    try {
      const count = await getUserNotificationUnreadCount()
      setUnreadCount(count)
      emitUnreadNotificationCount(count)
    } catch {
      setUnreadCount(0)
    }
  }

  const loadPreview = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getUserNotifications({ page: 1, limit: 5 })
      setItems(Array.isArray(response?.notifications) ? response.notifications : [])
      await loadUnreadCount()
    } catch (loadError) {
      setItems([])
      setError(loadError?.message || 'Không thể tải thông báo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUnreadCount()
    const unsubscribe = subscribeUnreadNotificationCount((count) => setUnreadCount(count))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const handleToggle = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) loadPreview()
  }

  const handleNotificationClick = async (item) => {
    const notificationId = item?._id || item?.id
    if (notificationId && !item?.is_read) {
      try {
        await markUserNotificationAsRead(notificationId)
        const nextCount = Math.max(0, unreadCount - 1)
        setUnreadCount(nextCount)
        emitUnreadNotificationCount(nextCount)
      } catch {
        // Keep navigation available
      }
    }
    setOpen(false)
    navigate('/notifications')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={className || 'relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200'}
        aria-label="Mở thông báo"
      >
        <span className={iconClassName || 'material-symbols-outlined'}>notifications</span>
        {unreadCount > 0 ? (
          <span className={badgeClassName || 'absolute -right-1 -top-1 min-w-[18px] rounded-full bg-sky-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white'}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <div
        className={`absolute right-0 top-full z-[70] mt-3 w-[340px] max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-slate-100 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] ring-1 ring-slate-950/5 transition-all duration-200 ${
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-extrabold text-slate-900">Thông báo</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Cập nhật mới nhất của bạn'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              navigate('/notifications')
            }}
            className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            Xem tất cả
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-rose-50 px-3 py-4 text-sm font-semibold text-rose-600">{error}</div>
          ) : items.length ? (
            <div className="space-y-1">
              {items.map((item) => {
                const id = item?._id || item?.id || `${getNotificationTitle(item)}-${item?.created_at || ''}`
                const isUnread = !item?.is_read
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isUnread ? 'bg-sky-500' : 'bg-slate-200'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{getNotificationTitle(item)}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{getNotificationMessage(item)}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-slate-400">{formatNotificationTime(item?.created_at || item?.updated_at)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300">notifications_off</span>
              <p className="mt-2 text-sm font-bold text-slate-700">Không có thông báo</p>
              <p className="mt-1 text-xs text-slate-500">Khi có cập nhật mới, thông báo sẽ hiện ở đây.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
