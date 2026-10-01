import { Link } from 'react-router-dom'

const FOOTER_COLUMNS = [
  {
    title: 'Việc làm',
    links: [
      { label: 'Tìm việc', to: '/search-jobs' },
      { label: 'Việc làm mới nhất', to: '/search-jobs' },
      { label: 'Việc làm nổi bật', to: '/search-jobs' },
      { label: 'AI Agent', to: '/ai-agent' },
    ],
  },
  {
    title: 'Ứng viên',
    links: [
      { label: 'Hồ sơ cá nhân', to: '/user/profile' },
      { label: 'Việc đã ứng tuyển', to: '/jobs' },
      { label: 'Việc yêu thích', to: '/favorites' },
      { label: 'Quản lý CV', to: '/uploaded-cvs' },
    ],
  },
  {
    title: 'Nhà tuyển dụng',
    links: [
      { label: 'Đăng tin tuyển dụng', to: '/employer-post-job' },
      { label: 'Quản lý tin tuyển dụng', to: '/employer-job-list' },
      { label: 'Tìm hồ sơ ứng viên', to: '/employer-received-cv' },
      { label: 'Gói quảng bá', to: '/employer-job-promotions' },
    ],
  },
  {
    title: 'Hỗ trợ',
    links: [
      { label: 'Trung tâm hỗ trợ', to: '#' },
      { label: 'Góp ý cho MYCODER', to: '#' },
      { label: 'Điều khoản sử dụng', to: '#' },
      { label: 'Chính sách bảo mật', to: '#' },
    ],
  },
]

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10 text-slate-600">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-2">
            <Link to="/" className="mb-4 flex items-center text-xl font-bold tracking-tight text-[#2b59ff]">
              <span className="material-symbols-outlined mr-1 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>code</span>
              MYCODER
            </Link>
            <p className="mb-6 max-w-xs text-[13px] leading-relaxed text-slate-500">
              Nền tảng kết nối nhà tuyển dụng và developer chất lượng cao tại Việt Nam.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-slate-900">{column.title}</h2>
              <ul className="space-y-2.5 text-[13px]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to === '#' ? (
                      <a className="transition-colors hover:text-primary" href="#">{link.label}</a>
                    ) : (
                      <Link className="transition-colors hover:text-primary" to={link.to}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 text-[12px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 MYCODER. Kết nối đúng người, đúng cơ hội.</span>
          <div className="flex items-center gap-4">
            <a className="transition-colors hover:text-primary" href="#">Điều khoản</a>
            <a className="transition-colors hover:text-primary" href="#">Bảo mật</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
