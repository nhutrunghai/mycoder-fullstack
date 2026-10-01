import { Link } from 'react-router-dom'
import PublicHeader from '../components/layout/PublicHeader.jsx'
import PublicFooter from '../components/layout/PublicFooter.jsx'
import useCurrentUser from '../hooks/useCurrentUser.js'

const TOOLS = [
  {
    icon: 'smart_toy',
    eyebrow: 'AI hỗ trợ',
    title: 'MYCODER AI Agent',
    description: 'Tìm job theo kỹ năng, so sánh cơ hội và nhận góp ý CV bằng hội thoại tự nhiên.',
    action: 'Mở AI Agent',
    to: '/ai-agent',
    tone: 'bg-[#e7fbfd] text-[#168fa5]',
  },
  {
    icon: 'search',
    eyebrow: 'Khám phá',
    title: 'Tìm kiếm việc làm',
    description: 'Lọc theo kỹ năng, địa điểm và nhu cầu để tập trung vào những cơ hội phù hợp.',
    action: 'Tìm việc ngay',
    to: '/search-jobs',
    tone: 'bg-blue-50 text-[#2b59ff]',
  },
  {
    icon: 'description',
    eyebrow: 'Hồ sơ',
    title: 'Quản lý CV',
    description: 'Tập hợp các phiên bản CV để dùng đúng hồ sơ cho từng mục tiêu ứng tuyển.',
    action: 'Xem CV của tôi',
    to: '/uploaded-cvs',
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    icon: 'favorite',
    eyebrow: 'Theo dõi',
    title: 'Việc làm yêu thích',
    description: 'Lưu lại các vị trí đáng chú ý để quay lại so sánh và ứng tuyển sau.',
    action: 'Mở danh sách đã lưu',
    to: '/favorites',
    tone: 'bg-rose-50 text-rose-600',
  },
]

export default function Tools() {
  const session = useCurrentUser()

  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-900">
      <PublicHeader session={session} activeNav="/tools" />
      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-12">
        <section className="mb-10 max-w-2xl">
          <p className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#168fa5]">MYCODER Toolkit</p>
          <h1 className="text-[36px] font-black leading-tight tracking-[-0.03em] text-slate-950 sm:text-[48px]">Công cụ cho bước tiếp theo.</h1>
          <p className="mt-4 text-[15px] leading-7 text-slate-600 sm:text-base">
            Một nơi để bạn tìm kiếm, chuẩn bị hồ sơ và đưa ra quyết định nghề nghiệp rõ ràng hơn.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2" aria-label="Danh sách công cụ">
          {TOOLS.map((tool, index) => (
            <Link
              key={tool.title}
              to={tool.to}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_42px_-28px_rgba(37,99,235,0.45)] ${
                index === 0 ? 'sm:col-span-2 lg:p-8' : ''
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tool.tone}`}>
                <span className="material-symbols-outlined text-[24px]">{tool.icon}</span>
              </div>
              <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{tool.eyebrow}</p>
              <h2 className={`${index === 0 ? 'text-[28px]' : 'text-[22px]'} mt-2 font-extrabold text-slate-950`}>{tool.title}</h2>
              <p className="mt-3 max-w-xl text-[14px] leading-6 text-slate-600">{tool.description}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-[13px] font-extrabold text-[#2b59ff]">
                {tool.action}
                <span className="material-symbols-outlined text-[17px] transition group-hover:translate-x-1">arrow_forward</span>
              </span>
            </Link>
          ))}
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
