import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import UserAvatar from './components/UserAvatar.jsx'
import PublicHeader from './components/layout/PublicHeader.jsx'
import useCurrentUser from './hooks/useCurrentUser.js'
import { useFavoriteStore } from './stores/useFavoriteStore.js'
import { loadFeaturedJobs, loadHomeMeta, loadLatestJobs } from './data/apiClient.js'

const FEATURED_PAGE_LIMIT = 2
const LATEST_PAGE_LIMIT = 6
const CATEGORY_TONES = [
  { icon: 'code_blocks', ring: 'border-blue-100 bg-blue-50 text-blue-700', badge: 'bg-blue-600 text-white' },
  { icon: 'dns', ring: 'border-emerald-100 bg-emerald-50 text-emerald-700', badge: 'bg-emerald-600 text-white' },
  { icon: 'hub', ring: 'border-violet-100 bg-violet-50 text-violet-700', badge: 'bg-violet-600 text-white' },
  { icon: 'smart_toy', ring: 'border-cyan-100 bg-cyan-50 text-cyan-700', badge: 'bg-cyan-600 text-white' },
  { icon: 'cloud', ring: 'border-amber-100 bg-amber-50 text-amber-700', badge: 'bg-amber-500 text-white' },
  { icon: 'phone_iphone', ring: 'border-rose-100 bg-rose-50 text-rose-700', badge: 'bg-rose-500 text-white' },
]

function JobCard({ job, favoriteSet, onToggleFavorite, animationDelay = '0ms' }) {
  const fav = favoriteSet.has(job.id)

  return (
    <article className="soft-radius group card-enter border border-slate-100 bg-white p-5 shadow-sm" style={{ animationDelay }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <UserAvatar src={job.avatar} name={job.company} className="h-10 w-10 border border-slate-50" textClassName="text-xs" />
          <div className="min-w-0">
            <h4 className="truncate text-[14px] font-bold text-slate-800">{job.company}</h4>
            <p className="text-[11px] text-slate-400">{job.postedAt} • <span className="material-symbols-outlined !text-[11px]">location_on</span> {job.location}</p>
          </div>
        </div>
        <button className={`${fav ? 'text-red-500' : 'text-slate-300'} transition hover:text-red-500`} onClick={() => onToggleFavorite(job.id)}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: fav ? "'FILL' 1" : "'FILL' 0" }}>
            favorite
          </span>
        </button>
      </div>
      <Link to={`/job-detail/${job.id}`} className="mb-3 block text-[17px] font-bold text-slate-900 transition-colors group-hover:text-primary hover:text-primary">
        {job.title}
      </Link>
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#28a745]">
        <span className="material-symbols-outlined !text-[16px]">payments</span> {job.salary}
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-700">Yêu cầu:</span> {job.requirements}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(job.skills || []).map((skill) => (
            <span key={skill} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200">
              {skill}
            </span>
          ))}
        </div>
        <Link to={`/job-detail/${job.id}`} className="inline-flex justify-center rounded-lg bg-[#007bff] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-blue-700">
          Xem chi tiết
        </Link>
      </div>
    </article>
  )
}

export default function App() {
  const navigate = useNavigate()
  const session = useCurrentUser()
  const { isAuthenticated, profileName, profileHandle, profileAvatar } = session
  const favoriteSet = useFavoriteStore((state) => state.favoriteIds)
  const toggleFavoriteInStore = useFavoriteStore((state) => state.toggle)
  const [featuredJobs, setFeaturedJobs] = useState([])
  const [latestJobs, setLatestJobs] = useState([])
  const [search, setSearch] = useState('')
  const [searchError, setSearchError] = useState('')
  const [bannerOpen, setBannerOpen] = useState(true)
  const [homeMeta, setHomeMeta] = useState(null)
  const [typedHeroTitle, setTypedHeroTitle] = useState('')
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [featuredPagination, setFeaturedPagination] = useState(null)
  const [latestPagination, setLatestPagination] = useState(null)
  const [isLoadingMoreFeatured, setIsLoadingMoreFeatured] = useState(false)
  const [isLoadingMoreLatest, setIsLoadingMoreLatest] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingJobs(true)
      try {
        const [featuredData, latestData, homeData] = await Promise.all([
          loadFeaturedJobs({ page: 1, limit: FEATURED_PAGE_LIMIT }).catch(() => ({ jobs: [], pagination: null })),
          loadLatestJobs({ page: 1, limit: LATEST_PAGE_LIMIT }).catch(() => ({ jobs: [], pagination: null })),
          loadHomeMeta().catch(() => null),
        ])
        setFeaturedJobs(featuredData?.jobs || [])
        setLatestJobs(latestData?.jobs || [])
        setFeaturedPagination(featuredData?.pagination || null)
        setLatestPagination(latestData?.pagination || null)
        setHomeMeta(homeData)
      } finally {
        setIsLoadingJobs(false)
      }
    }
    loadData()
  }, [])

  const sidebarJobs = useMemo(() => {
    const merged = [...featuredJobs, ...latestJobs]
    const seen = new Set()
    return merged.filter((job) => {
      if (!job?.id || seen.has(job.id)) return false
      seen.add(job.id)
      return true
    })
  }, [featuredJobs, latestJobs])

  const appendUniqueJobs = (currentJobs, nextJobs) => {
    const seen = new Set(currentJobs.map((job) => job.id))
    const merged = [...currentJobs]

    nextJobs.forEach((job) => {
      if (!job?.id || seen.has(job.id)) return
      seen.add(job.id)
      merged.push(job)
    })

    return merged
  }

  const handleLoadMoreFeatured = async () => {
    if (isLoadingMoreFeatured || !featuredPagination?.has_next) return

    setIsLoadingMoreFeatured(true)
    try {
      const nextPage = Number(featuredPagination?.page || 1) + 1
      const response = await loadFeaturedJobs({ page: nextPage, limit: FEATURED_PAGE_LIMIT })
      setFeaturedJobs((current) => appendUniqueJobs(current, response?.jobs || []))
      setFeaturedPagination(response?.pagination || null)
    } catch (error) {
      console.error('Failed to load more featured jobs', error)
    } finally {
      setIsLoadingMoreFeatured(false)
    }
  }

  const handleLoadMoreLatest = async () => {
    if (isLoadingMoreLatest || !latestPagination?.has_next) return

    setIsLoadingMoreLatest(true)
    try {
      const nextPage = Number(latestPagination?.page || 1) + 1
      const response = await loadLatestJobs({ page: nextPage, limit: LATEST_PAGE_LIMIT })
      setLatestJobs((current) => appendUniqueJobs(current, response?.jobs || []))
      setLatestPagination(response?.pagination || null)
    } catch (error) {
      console.error('Failed to load more latest jobs', error)
    } finally {
      setIsLoadingMoreLatest(false)
    }
  }

  const heroTitle = homeMeta?.hero?.title || 'MYCODER.COM'

  useEffect(() => {
    let index = 0
    let typingTimer

    const startTimer = window.setTimeout(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setTypedHeroTitle(heroTitle)
        return
      }

      setTypedHeroTitle('')
      typingTimer = window.setInterval(() => {
        index += 1
        setTypedHeroTitle(heroTitle.slice(0, index))

        if (index >= heroTitle.length) {
          window.clearInterval(typingTimer)
        }
      }, 95)
    }, 260)

    return () => {
      window.clearTimeout(startTimer)
      if (typingTimer) window.clearInterval(typingTimer)
    }
  }, [heroTitle])
  const heroSubtitle = homeMeta?.hero?.subtitle || 'Nền tảng việc làm công nghệ chất lượng cho developer Việt Nam.'

  const toggleFavorite = (key) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/', search: '' } } })
      return
    }

    void toggleFavoriteInStore(key).catch((error) => {
      console.error('Failed to update favorite job', error)
    })
  }

  const popularCategories = useMemo(() => (homeMeta?.categories || []).filter((item) => item?.name).slice(0, 6), [homeMeta])
  const featuredCategory = popularCategories[0]
  const compactCategories = popularCategories.slice(1, 5)
  const buildCategorySearchLink = (category) => {
    const params = new URLSearchParams({
      category_id: String(category.id),
      category_name: category.name,
    })
    return `/search-jobs?${params.toString()}`
  }

  const handleSearchNavigate = () => {
    const q = search.trim()

    if (!q) {
      setSearchError('Vui lòng nhập từ khóa trước khi tìm kiếm.')
      return
    }

    setSearchError('')
    navigate(`/search-jobs?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="bg-white text-on-surface">
      <PublicHeader session={session} />

      <main className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 sm:py-4">
        <div className={`soft-radius mb-4 flex flex-col items-start justify-between gap-2 border border-slate-100 bg-white p-2.5 shadow-sm transition-all duration-300 sm:mb-6 sm:flex-row sm:items-center ${bannerOpen ? 'max-h-32 opacity-100 sm:max-h-28' : 'pointer-events-none max-h-0 overflow-hidden opacity-0'}`}>
          <div className="flex items-start gap-2 text-sm sm:items-center sm:gap-3">
            <span className="font-semibold text-orange-500">Tin hot:</span>
            <span className="text-slate-600">{homeMeta?.hero?.announcement || 'Cập nhật việc làm mới mỗi ngày cho cộng đồng lập trình viên.'}</span>
          </div>
          <button className="self-end text-slate-400 hover:text-slate-600 sm:self-auto" onClick={() => setBannerOpen(false)}>
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <section className="mx-auto mb-6 max-w-[1360px] animate-fade-up lg:mb-10">
          <div className="soft-radius relative flex h-[220px] items-center overflow-hidden bg-gradient-to-r from-[#20c3d0] via-[#2489d2] to-[#1e58b1] shadow-lg md:h-[280px]">
            <div className="z-10 w-full px-5 text-left text-white md:w-[72%] md:px-14">
              <h1 className="typewriter-title mb-2 text-[32px] font-black leading-tight tracking-tight md:text-[56px]" aria-label={heroTitle}>
                {typedHeroTitle || '\u00a0'}
              </h1>
              <p className="text-base font-medium leading-7 opacity-95 md:text-2xl">{heroSubtitle}</p>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          </div>
        </section>

        <div className="mx-auto max-w-[1360px]">
          <div className="grid grid-cols-1 gap-8 pb-12 lg:grid-cols-12">
            <aside className="order-2 space-y-4 lg:order-none lg:col-span-2 animate-fade-up" style={{ animationDelay: '70ms' }}>
              <div className="soft-radius border border-slate-100 bg-white p-4 shadow-sm">
                {isAuthenticated ? (
                  <>
                    <div className="mb-6 flex flex-col items-center text-center">
                      <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border border-slate-100 bg-slate-100">
                        <UserAvatar src={profileAvatar} name={profileName} className="h-full w-full" textClassName="text-lg" />
                      </div>
                      <p className="max-w-full truncate text-sm font-bold text-slate-800">{profileName}</p>
                      <p className="max-w-full truncate text-[11px] text-slate-400">{profileHandle}</p>
                    </div>
                    <nav className="space-y-1">
                      {[
                        { label: 'Việc làm', to: '#' },
                        { label: 'Việc đã ứng tuyển', to: '/jobs' },
                        { label: 'Việc yêu thích', to: '/favorites' },
                        { label: 'Quản lý việc', to: '/dashboard' },
                      ].map((item, i) =>
                        item.to === '#' ? (
                          <a key={item.label} className={`soft-radius flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors ${i === 0 ? 'bg-blue-50 font-semibold text-primary' : 'text-slate-600 hover:bg-slate-50'}`} href="#">
                            {item.label}
                          </a>
                        ) : (
                          <Link key={item.label} className={`soft-radius flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors ${i === 0 ? 'bg-blue-50 font-semibold text-primary' : 'text-slate-600 hover:bg-slate-50'}`} to={item.to}>
                            {item.label}
                          </Link>
                        ),
                      )}
                    </nav>
                  </>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#2b59ff]">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Tham gia MYCODER</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Đăng nhập để lưu việc, ứng tuyển và quản lý hồ sơ.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link to="/login" className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-800">
                        Đăng nhập
                      </Link>
                      <Link to="/register" className="inline-flex h-10 items-center justify-center rounded-full bg-[#2b59ff] px-3 text-xs font-bold text-white transition hover:bg-[#1f4bf1]">
                        Đăng ký
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="soft-radius overflow-hidden border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),linear-gradient(135deg,#ffffff,#f8fbff)] p-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="text-[14px] font-bold text-slate-800">Danh mục phổ biến</h3>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-600">Hot</span>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500">Khám phá nhanh các nhóm việc làm đang có nhiều cơ hội.</p>
                </div>

                <div className="p-3">
                  {featuredCategory ? (
                    <Link to={buildCategorySearchLink(featuredCategory)} className="group mb-3 block rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-cyan-500 p-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/18 backdrop-blur">
                          <span className="material-symbols-outlined !text-[20px]">rocket_launch</span>
                        </span>
                        <span className="rounded-full bg-white/18 px-2 py-1 text-[10px] font-bold">Top trend</span>
                      </div>
                      <p className="line-clamp-1 text-[14px] font-black">{featuredCategory.name}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/85">
                        <span>{featuredCategory.count ? `${featuredCategory.count} việc đang mở` : 'Khám phá ngay'}</span>
                        <span className="material-symbols-outlined !text-[16px] transition group-hover:translate-x-0.5">arrow_forward</span>
                      </div>
                    </Link>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    {compactCategories.map((item, index) => {
                      const tone = CATEGORY_TONES[index % CATEGORY_TONES.length]

                      return (
                        <Link key={item.name} to={buildCategorySearchLink(item)} className={`group rounded-2xl border p-2.5 transition hover:-translate-y-0.5 hover:shadow-sm ${tone.ring}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="material-symbols-outlined !text-[18px]">{tone.icon}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tone.badge}`}>{item.count || 'Go'}</span>
                          </div>
                          <p className="line-clamp-2 min-h-8 text-[12px] font-extrabold leading-4">{item.name}</p>
                        </Link>
                      )
                    })}
                  </div>

                  <Link to="/search-jobs" className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-2 text-[12px] font-bold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                    Xem tất cả danh mục
                    <span className="material-symbols-outlined !text-[15px]">chevron_right</span>
                  </Link>
                </div>
              </div>
            </aside>

            <div className="order-1 space-y-5 lg:order-none lg:col-span-7 animate-fade-up" style={{ animationDelay: '120ms' }}>
              <div className="soft-radius border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
                  Tìm kiếm việc làm
                </div>
                <div className="relative mb-4 flex flex-col gap-2 sm:block">
                  <span className="material-symbols-outlined absolute left-4 top-[22px] -translate-y-1/2 text-slate-400 sm:top-1/2">search</span>
                  <input
                    className="soft-radius w-full border border-slate-200 py-2.5 pl-11 pr-4 text-[14px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:pr-32"
                    placeholder="Tìm kiếm công việc, kỹ năng, công ty..."
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      if (searchError) setSearchError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchNavigate()
                    }}
                  />
                  <button type="button" onClick={handleSearchNavigate} className="h-10 rounded-md bg-[#2b59ff] px-4 text-xs font-bold text-white transition hover:bg-[#1f4bf1] sm:absolute sm:right-1.5 sm:top-1/2 sm:h-9 sm:-translate-y-1/2">
                    Tìm kiếm
                  </button>
                  {searchError ? <p className="mt-2 text-[12px] font-semibold text-rose-500 sm:absolute sm:left-0 sm:top-full">{searchError}</p> : null}
                </div>
              </div>

              <section>
                <div className="soft-radius mb-5 overflow-hidden border border-[#cae5ff] bg-[linear-gradient(135deg,#eff8ff_0%,#f8fbff_45%,#ffffff_100%)] shadow-sm">
                  <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#2b59ff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#2b59ff]">
                        <span className="material-symbols-outlined !text-[15px]">workspace_premium</span>
                        Gợi ý nổi bật
                      </div>
                      <h2 className="text-[20px] font-black tracking-tight text-slate-900">Việc làm tốt nhất</h2>
                      <p className="mt-1 text-[13px] text-slate-600">Những cơ hội được ưu tiên hiển thị nhằm phù hợp hơn với mục tiêu của bạn.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {featuredJobs.map((job, index) => (
                    <JobCard key={`featured-${job.id}`} job={job} favoriteSet={favoriteSet} onToggleFavorite={toggleFavorite} animationDelay={`${180 + index * 50}ms`} />
                  ))}
                  {!isLoadingJobs && featuredJobs.length === 0 && (
                    <div className="soft-radius border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-[13px] text-slate-500">
                      Chưa có job promotion để hiển thị.
                    </div>
                  )}
                  {featuredPagination?.has_next && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleLoadMoreFeatured}
                        disabled={isLoadingMoreFeatured}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-[#b7d7ff] bg-white px-5 text-[13px] font-bold text-[#2b59ff] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingMoreFeatured ? 'Đang tải...' : 'Xem thêm'}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="soft-radius mb-5 overflow-hidden border border-[#d7eef2] bg-[linear-gradient(135deg,#f2fbfd_0%,#f7fdff_48%,#ffffff_100%)] shadow-sm">
                  <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#20c3d0]/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#168fa5]">
                        <span className="material-symbols-outlined !text-[15px]">schedule</span>
                        Mới cập nhật
                      </div>
                      <h2 className="text-[20px] font-black tracking-tight text-slate-900">Việc làm mới nhất</h2>
                      <p className="mt-1 text-[13px] text-slate-600">Cập nhật liên tục các tin đăng mới để bạn theo dõi và ứng tuyển nhanh hơn.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {latestJobs.map((job, index) => (
                    <JobCard key={`latest-${job.id}`} job={job} favoriteSet={favoriteSet} onToggleFavorite={toggleFavorite} animationDelay={`${320 + index * 50}ms`} />
                  ))}
                  {!isLoadingJobs && latestJobs.length === 0 && (
                    <div className="soft-radius border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-[13px] text-slate-500">
                      Chưa có job mới nhất để hiển thị.
                    </div>
                  )}
                  {latestPagination?.has_next && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleLoadMoreLatest}
                        disabled={isLoadingMoreLatest}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-[#bce8ee] bg-white px-5 text-[13px] font-bold text-[#168fa5] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingMoreLatest ? 'Đang tải...' : 'Xem thêm'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="order-3 space-y-5 lg:order-none lg:col-span-3 animate-fade-up" style={{ animationDelay: '170ms' }}>
              <div className="soft-radius border border-slate-100 bg-white p-6 shadow-sm lg:sticky lg:top-20">
                <h2 className="mb-6 flex items-center gap-2 text-[16px] font-bold text-slate-800">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                  Công việc nổi bật
                </h2>
                <div className="space-y-2.5">
                  {sidebarJobs.slice(0, 5).map((job, i) => (
                    <Link key={job.id} to={`/job-detail/${job.id}`} className="soft-radius flex cursor-pointer items-start gap-3 px-2 py-1.5 transition-all hover:bg-slate-50">
                      <span className="pt-0.5 text-[17px] font-bold text-primary">{i + 1}.</span>
                      <p className="text-[13.5px] font-medium leading-6 text-slate-700">{job.title}</p>
                    </Link>
                  ))}
                  {!isLoadingJobs && sidebarJobs.length === 0 && (
                    <p className="text-[13px] text-slate-500">Chưa có dữ liệu công việc để hiển thị.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-10 text-slate-600">
        <div className="mx-auto max-w-[1440px] px-6">
          <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-6">
            <div className="col-span-2">
              <div className="mb-4 flex items-center text-xl font-bold tracking-tight text-[#2b59ff]">
                <span className="material-symbols-outlined mr-1 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>code</span>
                MYCODER
              </div>
              <p className="mb-6 max-w-xs text-[13px] leading-relaxed text-slate-500">{homeMeta?.footer?.brandDescription || 'Nền tảng kết nối nhà tuyển dụng và developer chất lượng cao tại Việt Nam.'}</p>
            </div>
            {(homeMeta?.footer?.columns || []).map((col) => (
              <div key={col.title}>
                <h4 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-slate-900">{col.title}</h4>
                <ul className="space-y-2.5 text-[13px]">
                  {(col.links || []).map((link) => (
                    <li key={link}>
                      <a className="transition-colors hover:text-primary" href="#">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
