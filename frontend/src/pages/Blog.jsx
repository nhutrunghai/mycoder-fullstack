import PublicHeader from '../components/layout/PublicHeader.jsx'
import PublicFooter from '../components/layout/PublicFooter.jsx'
import useCurrentUser from '../hooks/useCurrentUser.js'

const TOPICS = ['Định hướng nghề nghiệp', 'Bí kíp tìm việc', 'Kỹ năng công nghệ', 'CV & phỏng vấn', 'Thị trường tuyển dụng']

const ARTICLES = [
  {
    category: 'Định hướng nghề nghiệp',
    title: 'Xây lộ trình nghề nghiệp công nghệ từ những bước đầu tiên',
    excerpt: 'Một lộ trình tốt không bắt đầu từ chức danh, mà bắt đầu từ năng lực bạn muốn sở hữu trong 12 tháng tới.',
    date: '28/09/2026',
    readTime: '6 phút đọc',
    image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85',
    tone: 'blue',
  },
  {
    category: 'Bí kíp tìm việc',
    title: 'Portfolio developer: kể câu chuyện kỹ thuật sao cho thuyết phục',
    excerpt: 'Nhà tuyển dụng không chỉ nhìn vào công nghệ bạn dùng. Họ muốn thấy cách bạn giải quyết vấn đề.',
    date: '25/09/2026',
    readTime: '5 phút đọc',
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85',
    tone: 'cyan',
  },
  {
    category: 'Kỹ năng công nghệ',
    title: 'Từ junior đến mid-level: 5 năng lực tạo khác biệt',
    excerpt: 'Khi kỹ năng nền tảng đã ổn, khả năng giao tiếp và ownership sẽ quyết định bước tiến tiếp theo.',
    date: '22/09/2026',
    readTime: '4 phút đọc',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85',
    tone: 'violet',
  },
  {
    category: 'CV & phỏng vấn',
    title: 'Viết CV kỹ thuật ngắn gọn nhưng không bị mờ nhạt',
    excerpt: 'Dùng số liệu, bối cảnh và kết quả để biến một danh sách công việc thành bằng chứng năng lực.',
    date: '18/09/2026',
    readTime: '7 phút đọc',
    image: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=900&q=85',
    tone: 'amber',
  },
  {
    category: 'Thị trường tuyển dụng',
    title: 'Những thay đổi đang định hình tuyển dụng IT năm 2026',
    excerpt: 'AI, cloud và khả năng làm việc liên chức năng tiếp tục thay đổi cách đội ngũ công nghệ tuyển người.',
    date: '12/09/2026',
    readTime: '8 phút đọc',
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=85',
    tone: 'emerald',
  },
  {
    category: 'Bí kíp tìm việc',
    title: 'Chuẩn bị gì trước buổi phỏng vấn kỹ thuật đầu tiên?',
    excerpt: 'Checklist thực tế để bạn bước vào buổi phỏng vấn với câu chuyện rõ ràng và tâm thế chủ động.',
    date: '08/09/2026',
    readTime: '5 phút đọc',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=85',
    tone: 'rose',
  },
  {
    category: 'Định hướng nghề nghiệp',
    title: 'Chọn môi trường làm việc phù hợp với giai đoạn hiện tại',
    excerpt: 'Một công ty tốt không chỉ có thương hiệu lớn. Điều quan trọng là cách môi trường đó giúp bạn phát triển.',
    date: '04/09/2026',
    readTime: '6 phút đọc',
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85',
    tone: 'blue',
  },
  {
    category: 'Kỹ năng công nghệ',
    title: 'Học cloud thế nào để không bị ngợp giữa quá nhiều lựa chọn?',
    excerpt: 'Bắt đầu từ nền tảng, chọn một bài toán thực tế và xây lộ trình học đủ nhỏ để duy trì mỗi tuần.',
    date: '30/08/2026',
    readTime: '7 phút đọc',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=85',
    tone: 'cyan',
  },
  {
    category: 'CV & phỏng vấn',
    title: 'Những câu hỏi nên hỏi ngược nhà tuyển dụng',
    excerpt: 'Câu hỏi đúng giúp bạn hiểu rõ công việc, đồng thời thể hiện cách bạn suy nghĩ về sự phù hợp lâu dài.',
    date: '26/08/2026',
    readTime: '4 phút đọc',
    image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=900&q=85',
    tone: 'amber',
  },
  {
    category: 'Thị trường tuyển dụng',
    title: 'Kỹ năng nào đang được đội ngũ công nghệ ưu tiên?',
    excerpt: 'Bức tranh tuyển dụng đang dịch chuyển từ biết công cụ sang khả năng tạo ra kết quả đo được.',
    date: '20/08/2026',
    readTime: '5 phút đọc',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=85',
    tone: 'emerald',
  },
]

const TONE_STYLES = {
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700',
  violet: 'border-violet-100 bg-violet-50 text-violet-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
}

function ArticleMeta({ article }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-slate-400">
      <span>MYCODER Editorial</span>
      <span aria-hidden="true">•</span>
      <span>{article.date}</span>
      <span aria-hidden="true">•</span>
      <span>{article.readTime}</span>
    </div>
  )
}

function TopicPill({ children }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      {children}
    </button>
  )
}

function ArticleCard({ article, featured = false }) {
  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_42px_-28px_rgba(37,99,235,0.45)] ${
        featured ? 'blog-featured-card' : ''
      }`}
    >
      <div className={`overflow-hidden bg-slate-100 ${featured ? 'blog-featured-media' : 'aspect-[16/9]'}`}>
        <img
          src={article.image}
          alt=""
          loading={featured ? 'eager' : 'lazy'}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className={`flex flex-col ${featured ? 'blog-featured-content justify-center p-6 sm:p-8' : 'p-5'}`}>
        <span className={`mb-3 inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${TONE_STYLES[article.tone]}`}>
          {article.category}
        </span>
        <h2 className={`${featured ? 'text-[25px] leading-tight sm:text-[32px]' : 'text-[19px] leading-7'} font-extrabold text-slate-900`}>
          {article.title}
        </h2>
        <ArticleMeta article={article} />
        <p className={`${featured ? 'mt-5 text-[15px] leading-7' : 'mt-3 text-[14px] leading-6'} text-slate-600`}>
          {article.excerpt}
        </p>
        <div className="mt-5 flex items-center gap-2 text-[13px] font-extrabold text-[#2b59ff]">
          Đọc bản tin
          <span className="material-symbols-outlined text-[17px] transition group-hover:translate-x-1">arrow_forward</span>
        </div>
      </div>
    </article>
  )
}

function ArticleListRow({ article }) {
  return (
    <article className="group grid gap-4 border-b border-slate-200 py-5 first:pt-0 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_150px]">
      <div className="min-w-0">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${TONE_STYLES[article.tone]}`}>
          {article.category}
        </span>
        <h3 className="mt-3 text-[18px] font-extrabold leading-7 text-slate-900 transition group-hover:text-[#2b59ff]">
          {article.title}
        </h3>
        <ArticleMeta article={article} />
        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-slate-600">{article.excerpt}</p>
      </div>
      <div className="aspect-[16/10] overflow-hidden rounded-xl bg-slate-100">
        <img src={article.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      </div>
    </article>
  )
}

export default function Blog() {
  const session = useCurrentUser()

  return (
    <div className="min-h-screen bg-[#f7fafc] text-slate-900">
      <PublicHeader session={session} activeNav="/blog" />

      <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="mb-8 flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#168fa5]">MYCODER Editorial</p>
            <h1 className="text-[36px] font-black leading-tight tracking-[-0.03em] text-slate-950 sm:text-[50px]">
              Góc nhìn cho hành trình nghề nghiệp.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-base">
              Những bài viết ngắn, thực tế và có thể áp dụng ngay cho developer, ứng viên công nghệ và đội ngũ tuyển dụng.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[#2b59ff]">
              <span className="material-symbols-outlined text-[19px]">auto_stories</span>
            </span>
            12 bài viết đang chọn lọc
          </div>
        </section>

        <nav className="mb-9 flex gap-2 overflow-x-auto pb-1" aria-label="Chủ đề bài viết">
          {TOPICS.map((topic) => <TopicPill key={topic}>{topic}</TopicPill>)}
        </nav>

        <section aria-labelledby="featured-articles">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Đọc trước</p>
              <h2 id="featured-articles" className="mt-1 text-[25px] font-extrabold tracking-tight text-slate-950">Bài viết nổi bật</h2>
            </div>
            <span className="hidden text-[12px] font-medium text-slate-400 sm:block">Biên tập theo chủ đề nghề nghiệp</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <ArticleCard article={ARTICLES[0]} featured />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {ARTICLES.slice(1, 3).map((article) => (
                <ArticleCard key={article.title} article={article} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="latest-articles">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Cập nhật mới</p>
              <h2 id="latest-articles" className="mt-1 text-[25px] font-extrabold tracking-tight text-slate-950">Khám phá thêm</h2>
            </div>
            <button type="button" className="hidden items-center gap-1 text-[13px] font-bold text-[#2b59ff] sm:inline-flex">
              Xem tất cả
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {ARTICLES.slice(3, 7).map((article) => <ArticleCard key={article.title} article={article} />)}
          </div>
        </section>

        <section className="mt-12 grid gap-8 border-t border-slate-200 pt-8 lg:grid-cols-[1.35fr_0.65fr]" aria-labelledby="career-stream">
          <div>
            <div className="mb-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#168fa5]">Đọc theo dòng chảy</p>
              <h2 id="career-stream" className="mt-1 text-[25px] font-extrabold tracking-tight text-slate-950">Thị trường và hành trang nghề nghiệp</h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-1 sm:px-6">
              {ARTICLES.slice(6).map((article) => <ArticleListRow key={article.title} article={article} />)}
            </div>
          </div>
          <aside className="border-l border-slate-200 pl-0 lg:pl-8">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#168fa5]">Hành trang nghề nghiệp</p>
            <h2 className="mt-1 text-[25px] font-extrabold tracking-tight text-slate-950">Chủ đề được quan tâm</h2>
            <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
              {TOPICS.slice(0, 4).map((topic, index) => (
                <button key={topic} type="button" className="group flex w-full items-start gap-4 py-4 text-left">
                  <span className="text-[18px] font-black text-[#168fa5]">0{index + 1}</span>
                  <span className="text-[15px] font-extrabold leading-6 text-slate-800 transition group-hover:text-[#2b59ff]">{topic}</span>
                </button>
              ))}
            </div>
          </aside>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
