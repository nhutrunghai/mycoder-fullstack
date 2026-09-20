import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getUserNotificationUnreadCount, subscribeUnreadNotificationCount } from '../api/notificationService.js'
import useCurrentUser from '../hooks/useCurrentUser.js'
import UserAvatar from './UserAvatar.jsx'

const candidateSections = [
  {
    items: [
      { key: 'home', icon: 'home', label: 'Trang chủ', to: '/' },
      { key: 'dashboard', icon: 'dashboard', label: 'Dashboard', to: '/dashboard' },
      { key: 'switch-role', icon: 'shield', label: 'Sang nhà tuyển dụng', to: '/employer-dashboard' },
    ],
  },
  {
    title: 'Quản lý Job',
    items: [
      { key: 'uploaded-cvs', icon: 'description', label: 'CV đã tải lên', to: '/uploaded-cvs' },
      { key: 'applied-jobs', icon: 'assignment_turned_in', label: 'Việc đã ứng tuyển', to: '/jobs' },
      { key: 'wallet', icon: 'account_balance_wallet', label: 'Ví & nạp tiền', to: '/wallet/top-up' },
    ],
  },
  {
    title: 'Giao tiếp',
    items: [
      { key: 'notifications', icon: 'notifications_none', label: 'Thông báo', to: '/notifications', badge: '', badgeTone: 'sky' },
    ],
  },
]

const employerSections = [
  {
    items: [
      { key: 'home', icon: 'home', label: 'Trang chủ', to: '/' },
      { key: 'dashboard', icon: 'dashboard', label: 'Dashboard', to: '/employer-dashboard' },
      { key: 'switch-role', icon: 'shield', label: 'Sang người dùng', to: '/dashboard' },
    ],
  },
  {
    title: 'Quản lý tuyển dụng',
    items: [
      { key: 'job-list', icon: 'checklist', label: 'Danh sách job', to: '/employer-job-list' },
      { key: 'post-job', icon: 'add', label: 'Đăng tin mới', to: '/employer-post-job' },
      { key: 'job-promotions', icon: 'rocket_launch', label: 'Quảng cáo', to: '/employer-job-promotions' },
    ],
  },
  {
    title: 'Quản lý ứng viên',
    items: [
      { key: 'received-cv', icon: 'description', label: 'Hồ sơ đã nhận', to: '/employer-received-cv' },
      { key: 'wallet', icon: 'account_balance_wallet', label: 'Ví & nạp tiền', to: '/wallet/top-up' },
    ],
  },
  {
    title: 'Giao tiếp',
    items: [
      { key: 'notifications', icon: 'notifications_none', label: 'Thông báo', to: '/employer-notifications', badge: '', badgeTone: 'sky' },
    ],
  },
]

function toneClass(tone) {
  if (tone === 'rose') return 'bg-rose-100 text-rose-500'
  if (tone === 'sky') return 'bg-sky-100 text-sky-500'
  return 'bg-slate-100 text-slate-500'
}

const activeKeyAliases = {
  jobs: 'job-list',
  'employer-dashboard': 'dashboard',
  'employer-notifications': 'notifications',
  'employer-job-promotions': 'job-promotions',
}

const roleSwitchToastByPath = {
  '/employer-dashboard': { type: 'success', message: 'Đã chuyển sang chế độ nhà tuyển dụng.' },
  '/dashboard': { type: 'success', message: 'Đã chuyển sang chế độ người dùng.' },
}

function RoleSwitchOverlay({ message }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex min-w-[240px] flex-col items-center rounded-3xl border border-white/20 bg-white/95 px-8 py-7 text-center shadow-2xl">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-extrabold text-slate-900">Đang chuyển chế độ</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{message}</p>
      </div>
    </div>
  )
}

function SidebarSections({ sections, normalizedActiveKey, onNavigateClose, onRoleSwitch }) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.title || 'main'} className="min-w-0">
          {section.title ? <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{section.title}</p> : null}
          <div className="min-w-0 space-y-1">
            {section.items.map((item) => {
              const isActive = normalizedActiveKey === item.key
              const rowClass = isActive
                ? item.key === 'milestone'
                  ? 'bg-emerald-50 font-semibold text-emerald-600'
                  : 'bg-blue-500 font-semibold text-white'
                : item.key === 'switch-role'
                  ? 'bg-emerald-50 font-bold text-emerald-500'
                  : 'font-semibold text-slate-500 hover:bg-slate-50'

              const isRoleSwitch = item.key === 'switch-role'

              return (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={(event) => {
                    if (isRoleSwitch) {
                      event.preventDefault()
                      onRoleSwitch?.(item)
                      return
                    }
                    onNavigateClose?.()
                  }}
                  state={
                    item.key === 'switch-role' && item.to === '/employer-dashboard'
                      ? { toast: { type: 'success', message: 'Đã chuyển sang chế độ nhà tuyển dụng.' } }
                      : item.key === 'switch-role' && item.to === '/dashboard'
                        ? { toast: { type: 'success', message: 'Đã chuyển sang chế độ người dùng.' } }
                        : undefined
                  }
                  className={`box-border flex h-10 w-full max-w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg px-3 text-sm transition-colors ${rowClass}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="material-symbols-outlined shrink-0 text-[20px]">{item.icon}</span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </div>
                  {item.badge ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${toneClass(item.badgeTone)}`}>{item.badge}</span> : null}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

export default function DashboardSidebar({ activeKey }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile } = useCurrentUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [roleSwitchLoading, setRoleSwitchLoading] = useState(null)

  const isEmployerDashboard =
    pathname.startsWith('/employer-dashboard') ||
    pathname.startsWith('/employer-') ||
    pathname.startsWith('/employer/')

  const baseSections = isEmployerDashboard ? employerSections : candidateSections
  const normalizedActiveKey = activeKeyAliases[activeKey] || activeKey
  const displayName = profile?.fullName || profile?.username || 'Tài khoản'
  const displaySubtext = profile?.username ? `@${profile.username}` : isEmployerDashboard ? 'Nhà tuyển dụng' : 'Ứng viên'

  const handleRoleSwitch = (item) => {
    const toast = roleSwitchToastByPath[item.to]
    setMobileOpen(false)
    setRoleSwitchLoading(item.to === '/employer-dashboard' ? 'Vui lòng chờ trong giây lát...' : 'Đang quay về dashboard người dùng...')

    window.setTimeout(() => {
      navigate(item.to, { state: { toast } })
    }, 750)
  }

  useEffect(() => {
    let active = true

    getUserNotificationUnreadCount()
      .then((count) => {
        if (active) setUnreadCount(count)
      })
      .catch(() => {
        if (active) setUnreadCount(0)
      })

    const unsubscribe = subscribeUnreadNotificationCount((count) => {
      setUnreadCount(count)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const sections = useMemo(
    () =>
      baseSections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.key === 'notifications'
            ? { ...item, badge: unreadCount > 0 ? String(unreadCount) : '' }
            : item
        ),
      })),
    [baseSections, unreadCount]
  )

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200"
              aria-label="Mở menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <Link to={isEmployerDashboard ? '/employer-dashboard' : '/dashboard'} className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <span className="material-symbols-outlined text-[20px]">code</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-extrabold tracking-[0.12em] text-blue-600">MYCODER</span>
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {isEmployerDashboard ? 'Tuyển dụng' : 'Ứng viên'}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-full bg-slate-50 px-2 py-1">
            <UserAvatar src={profile?.avatar} name={displayName} className="h-8 w-8" textClassName="text-xs" />
            <span className="max-w-[96px] truncate text-xs font-bold text-slate-700">{displayName}</span>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          />
          <aside className="relative flex h-full w-[82vw] max-w-[320px] flex-col border-r border-slate-100 bg-white px-4 py-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3 px-1">
              <Link to={isEmployerDashboard ? '/employer-dashboard' : '/dashboard'} onClick={() => setMobileOpen(false)} className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <span className="material-symbols-outlined text-[20px]">code</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-extrabold tracking-[0.12em] text-blue-600">MYCODER</span>
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {isEmployerDashboard ? 'Tuyển dụng' : 'Ứng viên'}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Đóng menu"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto">
              <SidebarSections sections={sections} normalizedActiveKey={normalizedActiveKey} onNavigateClose={() => setMobileOpen(false)} onRoleSwitch={handleRoleSwitch} />
            </nav>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 shadow-sm">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar src={profile?.avatar} name={displayName} className="h-11 w-11" textClassName="text-sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{displaySubtext}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-slate-100 bg-white px-4 py-6 lg:flex">
        <div className="mb-6 px-2">
          <Link to={isEmployerDashboard ? '/employer-dashboard' : '/dashboard'} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <span className="material-symbols-outlined text-[20px]">code</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold tracking-[0.12em] text-blue-600">MYCODER</span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {isEmployerDashboard ? 'Tuyển dụng' : 'Ứng viên'}
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto">
          <SidebarSections sections={sections} normalizedActiveKey={normalizedActiveKey} onRoleSwitch={handleRoleSwitch} />
        </nav>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar src={profile?.avatar} name={displayName} className="h-11 w-11" textClassName="text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
              <p className="truncate text-xs font-medium text-slate-500">{displaySubtext}</p>
            </div>
          </div>
        </div>
      </aside>
      {roleSwitchLoading ? <RoleSwitchOverlay message={roleSwitchLoading} /> : null}
    </>
  )
}
