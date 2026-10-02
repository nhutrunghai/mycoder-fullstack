import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { adminLogout } from '../api/adminService.js'

const navGroups = [
  {
    title: 'Quản trị cốt lõi',
    items: [
      { key: 'dashboard', label: 'Tổng quan', to: '/admin/dashboard', icon: 'dashboard' },
      { key: 'users', label: 'Người dùng', to: '/admin/users', icon: 'group' },
      { key: 'companies', label: 'Doanh nghiệp', to: '/admin/companies', icon: 'apartment' },
      { key: 'jobs', label: 'Tin tuyển dụng', to: '/admin/jobs', icon: 'work' },
      { key: 'job-categories', label: 'Danh mục việc làm', to: '/admin/job-categories', icon: 'category' },
    ],
  },
  {
    title: 'Dịch vụ & Tài chính',
    items: [
      { key: 'job-promotions', label: 'Quảng cáo tuyển dụng', to: '/admin/job-promotions', icon: 'star' },
      { key: 'job-promotion-plans', label: 'Gói quảng cáo', to: '/admin/job-promotion-plans', icon: 'sell' },
      { key: 'wallet-transactions', label: 'Giao dịch ví', to: '/admin/wallet-transactions', icon: 'account_balance_wallet' },
    ],
  },
  {
    title: 'Cấu hình & Hệ thống',
    items: [
      { key: 'sepay-config', label: 'Cấu hình SePay', to: '/admin/sepay-config', icon: 'settings_ethernet' },
      { key: 'rag-chat-config', label: 'Cấu hình RAG Chat', to: '/admin/rag-chat-config', icon: 'smart_toy' },
      { key: 'audit-logs', label: 'Nhật ký admin', to: '/admin/audit-logs', icon: 'history' },
    ],
  },
]

const allNavItems = navGroups.flatMap((group) => group.items)

export default function AdminLayout({ title, subtitle, actions, children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeItem = allNavItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) || allNavItems[0]

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await adminLogout()
    } finally {
      navigate('/admin/login', { replace: true })
    }
  }

  return (
    <div className="admin-shell min-h-screen bg-[#f4f6f5] text-slate-900">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Đóng menu quản trị"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-[#172126]/45 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[232px] flex-col border-r border-[#334147] bg-[#202b30] text-[#eef5f3] transition-transform duration-200 lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:flex`}
      >
        <div className="admin-brand-block shrink-0 border-b border-white/10 px-3.5 py-3.5">
          <Link to="/admin/dashboard" className="admin-brand-link group flex items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.05]">
            <span className="admin-brand-mark relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#314047] text-teal-200 ring-1 ring-white/10">
              <span className="text-[19px] font-black tracking-[-0.08em]">M<span className="text-teal-400">.</span></span>
              <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[#202b30] bg-teal-400" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-extrabold tracking-[0.2em] text-white">MYCODER</span>
              <span className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9eb0ae]">
                <span className="h-1 w-1 rounded-full bg-teal-400" />
                Admin operations
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-3.5 space-y-4 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#829594]">{group.title}</p>
              <nav className="space-y-1 text-[12.5px]">
                {group.items.map((item) => {
                  const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
                  return (
                    <Link
                      key={item.key}
                      to={item.to}
                      className={`group relative flex items-center gap-2 rounded-md px-2 py-2 font-normal transition-colors ${
                        isActive ? 'bg-[#f5f8f7] text-[#1c2a2e] shadow-sm' : 'text-[#b4c4c3] hover:bg-[#2a383d] hover:text-white'
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full ${
                          isActive ? 'bg-teal-500' : 'bg-transparent'
                        }`}
                      />
                      <span
                        className={`flex h-[26px] w-[26px] items-center justify-center rounded-md ${
                          isActive ? 'bg-teal-50 text-teal-700' : 'bg-white/[0.06] text-[#b4c4c3] group-hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="admin-account-card rounded-lg border border-white/10 bg-[#26343a] p-3 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-[17px] font-black tracking-[-0.08em] text-teal-200 ring-1 ring-teal-300/10">
                M<span className="text-teal-400">.</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-extrabold text-[#f4f8f7]">Quản trị viên</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#91a3a2]">Admin console</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] text-[12px] font-extrabold text-[#d5e0de] transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:ml-[232px]">
        <header className="sticky top-0 z-40 border-b border-[#dbe3e0] bg-white/90 backdrop-blur">
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-3 py-2 sm:px-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  aria-label="Mo menu quan tri"
                  onClick={() => setMobileNavOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d7e1de] bg-white text-slate-600 transition hover:bg-[#f5f8f7] hover:text-slate-900"
                >
                  <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>
                <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">MYCODER Admin</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <span>Quản trị</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-600">{activeItem.label}</span>
              </div>
              <h1 className="mt-0.5 text-[16px] font-extrabold tracking-tight text-slate-950 sm:truncate sm:text-[17px]">{title}</h1>
            </div>

            <div className="flex items-center justify-end gap-2 self-start sm:self-auto lg:min-w-[310px]">
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
              <label className="relative hidden flex-1 lg:block">
                <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-slate-400">
                  search
                </span>
                <input
                  type="search"
                  className="h-8 w-full rounded-md border border-[#d7e1de] bg-[#f7f9f8] pl-8 pr-2.5 text-[12.5px] font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  placeholder="Tìm nhanh trong hệ thống..."
                />
              </label>
              <div className="hidden h-8 items-center gap-1.5 rounded-md border border-[#d7e1de] bg-white px-2.5 text-[12px] font-semibold text-[#4d5d5c] md:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Đang hoạt động
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d7e1de] bg-white text-slate-500 transition hover:bg-[#f5f8f7] hover:text-slate-900"
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
              </button>
            </div>
          </div>
        </header>

        <main className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
          {subtitle ? (
            <div className="border-l-4 border-[#b7d8d0] pl-3">
              <p className="max-w-3xl text-[12.5px] font-medium leading-5 text-[#5f726f]">{subtitle}</p>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
