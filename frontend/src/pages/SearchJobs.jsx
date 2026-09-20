import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/layout/PublicHeader.jsx'
import UserAvatar from '../components/UserAvatar.jsx'
import useCurrentUser from '../hooks/useCurrentUser.js'
import { useFavoriteStore } from '../stores/useFavoriteStore.js'
import { searchPublicJobs } from '../data/apiClient.js'
import { queryKeys } from '../lib/queryKeys.js'
const locationOptions = [
  { label: 'Tất cả địa điểm', value: '' },
  { label: 'Hồ Chí Minh', value: 'Ho Chi Minh' },
  { label: 'Hà Nội', value: 'Ha Noi' },
  { label: 'Đà Nẵng', value: 'Da Nang' },
  { label: 'Remote', value: 'Remote' },
]
const jobTypeOptions = [
  { label: 'Tất cả hình thức', value: '' },
  { label: 'Toàn thời gian', value: 'full-time' },
  { label: 'Bán thời gian', value: 'part-time' },
  { label: 'Thực tập', value: 'internship' },
  { label: 'Hợp đồng', value: 'contract' },
  { label: 'Từ xa', value: 'remote' },
]
const levelOptions = [
  { label: 'Tất cả cấp bậc', value: '' },
  { label: 'Intern', value: 'intern' },
  { label: 'Fresher', value: 'fresher' },
  { label: 'Junior', value: 'junior' },
  { label: 'Middle', value: 'middle' },
  { label: 'Senior', value: 'senior' },
  { label: 'Lead', value: 'lead' },
  { label: 'Manager', value: 'manager' },
]
const suggestedKeywords = ['tester tieng nhat', 'tester intern', 'manual tester', 'automation tester', 'fresher tester']
export default function SearchJobs() {
  const navigate = useNavigate()
  const session = useCurrentUser()
  const { isAuthenticated } = session
  const favoriteIds = useFavoriteStore((state) => state.favoriteIds)
  const toggleFavoriteInStore = useFavoriteStore((state) => state.toggle)
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState(searchParams.get('q') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [jobType, setJobType] = useState(searchParams.get('job_type') || '')
  const [level, setLevel] = useState(searchParams.get('level') || '')
  const searchFilters = useMemo(() => ({
    q: String(searchParams.get('q') || '').trim(),
    location: String(searchParams.get('location') || '').trim(),
    job_type: String(searchParams.get('job_type') || '').trim(),
    level: String(searchParams.get('level') || '').trim(),
    category_id: String(searchParams.get('category_id') || '').trim(),
    page: Number(searchParams.get('page') || 1),
    limit: 10,
  }), [searchParams])
  const {
    data: searchResult,
    isPending,
    isFetching,
    error: searchQueryError,
  } = useQuery({
    queryKey: queryKeys.jobs.search(searchFilters),
    queryFn: () => searchPublicJobs(searchFilters),
  })
  const filteredJobs = searchResult?.jobs || []
  const pagination = searchResult?.pagination || null
  const isSearching = isPending || isFetching
  const searchError = searchQueryError?.message || ''

  useEffect(() => {
    setKeyword(searchFilters.q)
    setLocation(searchFilters.location)
    setJobType(searchFilters.job_type)
    setLevel(searchFilters.level)
  }, [searchFilters])
  const page = Number(pagination?.page || searchParams.get('page') || 1)
  const limit = Number(pagination?.limit || 10)
  const totalResults = Number(pagination?.total ?? filteredJobs.length)
  const totalPages = Math.max(1, Number(pagination?.total_pages || Math.ceil(totalResults / limit) || 1))

  const submitSearch = () => {
    const next = {}
    if (keyword.trim()) next.q = keyword.trim()
    if (location) next.location = location
    if (jobType) next.job_type = jobType
    if (level) next.level = level
    const currentCategoryId = searchParams.get('category_id')
    const currentCategoryName = searchParams.get('category_name')
    if (currentCategoryId) next.category_id = currentCategoryId
    if (currentCategoryName) next.category_name = currentCategoryName
    next.page = '1'
    setSearchParams(next)
  }

  const updateSearchParams = (changes) => {
    const next = Object.fromEntries(searchParams.entries())
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next[key] = value
      else delete next[key]
    })
    next.page = '1'
    setSearchParams(next)
  }

  const goToPage = (nextPage) => {
    const boundedPage = Math.min(Math.max(1, nextPage), totalPages)
    const next = Object.fromEntries(searchParams.entries())
    next.page = String(boundedPage)
    setSearchParams(next)
  }

  const toggleFavorite = (jobId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/search-jobs', search: `?${searchParams.toString()}` } } })
      return
    }

    void toggleFavoriteInStore(jobId).catch((error) => {
      console.error('Failed to update favorite job', error)
    })
  }

  return (
    <div className="min-h-screen bg-[#f2f5fa] text-on-surface">
      <PublicHeader session={session} activeNav="/search-jobs" containerClassName="max-w-[1180px] px-4 sm:px-5" />

      <section className="search-hero-enter bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#0ea5e9] py-4 shadow-sm sm:py-5">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-4 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-2 rounded-xl bg-white p-3 lg:h-11 lg:flex-row lg:items-center lg:gap-0 lg:px-3 lg:py-0">
            <div className="flex h-10 items-center rounded-lg bg-slate-50 px-2 lg:bg-transparent lg:px-0">
              <span className="material-symbols-outlined text-slate-500">work</span>
              <select className="ml-2 h-10 min-w-0 flex-1 border-0 bg-transparent pr-8 text-[14px] font-semibold text-slate-700 outline-none lg:flex-none" value={jobType} onChange={(e) => setJobType(e.target.value)}>
              {jobTypeOptions.map((item) => (
                <option key={item.value || 'all-job-type'} value={item.value}>{item.label}</option>
              ))}
              </select>
            </div>
            <span className="mx-2 hidden h-6 w-px bg-slate-200 lg:block" />
            <div className="flex h-10 items-center rounded-lg bg-slate-50 px-2 lg:flex-1 lg:bg-transparent lg:px-0">
              <span className="material-symbols-outlined text-slate-400">search</span>
            <input
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-[14px] outline-none"
              placeholder="Tìm kiếm công việc..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch()
              }}
            />
            </div>
            <span className="mx-2 hidden h-6 w-px bg-slate-200 lg:block" />
            <div className="flex h-10 items-center rounded-lg bg-slate-50 px-2 lg:bg-transparent lg:px-0">
              <span className="material-symbols-outlined text-slate-400">location_on</span>
              <select className="ml-1 h-10 min-w-0 flex-1 border-0 bg-transparent text-[14px] font-semibold text-slate-700 outline-none lg:flex-none" value={location} onChange={(e) => setLocation(e.target.value)}>
              {locationOptions.map((item) => (
                <option key={item.value || 'all-location'} value={item.value}>{item.label}</option>
              ))}
              </select>
            </div>
            <span className="mx-2 hidden h-6 w-px bg-slate-200 lg:block" />
            <div className="flex h-10 items-center rounded-lg bg-slate-50 px-2 lg:bg-transparent lg:px-0">
              <span className="material-symbols-outlined text-slate-400">workspace_premium</span>
              <select className="ml-1 h-10 min-w-0 flex-1 border-0 bg-transparent text-[14px] font-semibold text-slate-700 outline-none lg:flex-none" value={level} onChange={(e) => setLevel(e.target.value)}>
              {levelOptions.map((item) => (
                <option key={item.value || 'all-level'} value={item.value}>{item.label}</option>
              ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={submitSearch}
            disabled={isSearching}
            className="search-cta h-11 rounded-xl bg-[#2b59ff] px-8 text-[15px] font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-[#1f4bf1] disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </div>
      </section>

      <main className="search-page-enter mx-auto max-w-[1180px] px-4 py-4 sm:px-5">
        <header className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="text-[20px] font-extrabold leading-tight text-slate-900 sm:text-[22px]">Tuyển dụng {totalResults} việc làm {keyword ? keyword : ''}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link to="/" className="font-semibold text-blue-600">Trang chủ</Link> {'>'} Việc làm {'>'} {keyword || 'Tất cả'}
            </p>
          </div>
          <button className="w-full rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 sm:w-auto">
            Tạo thông báo việc làm
          </button>
        </header>

        <section className="search-page-enter mb-4 rounded-2xl border border-slate-200 bg-white p-3" style={{ animationDelay: '70ms' }}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">Từ khóa gợi ý:</p>
            {suggestedKeywords.map((item, index) => (
              <button
                key={item}
                onClick={() => {
                  setKeyword(item)
                  setSearchParams({ q: item, page: '1' })
                }}
                className="search-chip-enter rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-blue-100 hover:text-blue-700"
                style={{ animationDelay: `${120 + index * 40}ms` }}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="search-page-enter order-2 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:order-none lg:block" style={{ animationDelay: '100ms' }}>
            <p className="mb-3 text-[20px] font-extrabold leading-none text-slate-900">Bộ lọc API</p>
            <p className="mb-4 text-xs leading-5 text-slate-500">Backend search hỗ trợ lọc theo địa điểm, hình thức làm việc và cấp bậc.</p>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-800">Địa điểm</span>
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value)
                    updateSearchParams({ location: event.target.value })
                  }}
                >
                  {locationOptions.map((item) => (
                    <option key={item.value || 'filter-all-location'} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-800">Hình thức</span>
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                  value={jobType}
                  onChange={(event) => {
                    setJobType(event.target.value)
                    updateSearchParams({ job_type: event.target.value })
                  }}
                >
                  {jobTypeOptions.map((item) => (
                    <option key={item.value || 'filter-all-job-type'} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-800">Cấp bậc</span>
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                  value={level}
                  onChange={(event) => {
                    setLevel(event.target.value)
                    updateSearchParams({ level: event.target.value })
                  }}
                >
                  {levelOptions.map((item) => (
                    <option key={item.value || 'filter-all-level'} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setLocation('')
                  setJobType('')
                  setLevel('')
                  updateSearchParams({ location: '', job_type: '', level: '' })
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Xóa bộ lọc
              </button>
            </div>
          </aside>

          <section className="order-1 space-y-2.5 lg:order-none">
            <div className="search-page-enter flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2" style={{ animationDelay: '130ms' }}>
              <div className="text-sm font-semibold text-slate-600">
                {keyword.trim().length >= 2 ? (
                  <span>Tìm thấy <b className="text-slate-900">{totalResults}</b> kết quả, trang <b className="text-slate-900">{page}</b>/<b className="text-slate-900">{totalPages}</b></span>
                ) : (
                  <span>Nhập từ khóa tối thiểu 2 ký tự để tìm kiếm bằng API.</span>
                )}
              </div>
              <span className="rounded-full bg-slate-100 px-4 py-1 text-sm font-bold text-slate-600">Giới hạn {limit}/trang</span>
            </div>

            {isSearching && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
                <p className="text-sm font-semibold text-slate-700">Đang tìm kiếm bằng AI...</p>
                <p className="mt-1 text-xs text-slate-500">Embedding search có thể mất vài giây.</p>
              </div>
            )}

            {!isSearching && searchError && (
              <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center text-rose-600">
                {searchError}
              </div>
            )}

            {!isSearching && !searchError && filteredJobs.map((job, index) => (
              <article key={job.id} className="search-card-enter soft-radius group border border-slate-100 bg-white p-5 shadow-sm" style={{ animationDelay: `${170 + index * 60}ms` }}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar src={job.avatar} name={job.company} className="h-10 w-10 border border-slate-50" textClassName="text-xs" />
                    <div className="min-w-0">
                      <h4 className="truncate text-[14px] font-bold text-slate-800">{job.company}</h4>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {job.postedAt} • <span className="material-symbols-outlined !text-[11px]">location_on</span> {job.location}
                        {job.workMode ? ` / ${job.workMode}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(job.id)}
                    className={`${favoriteIds.has(job.id) ? 'text-red-500' : 'text-slate-300'} transition hover:text-red-500`}
                    aria-label="Lưu việc"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: favoriteIds.has(job.id) ? "'FILL' 1" : "'FILL' 0" }}>
                      favorite
                    </span>
                  </button>
                </div>

                <Link to={`/job-detail/${job.id}`} className="mb-3 block text-[17px] font-bold text-[#0b7cff] transition-colors group-hover:text-blue-700 hover:text-blue-700">
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
                    {(job.tags || job.skills || []).slice(0, 5).map((tag) => (
                      <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link to={`/job-detail/${job.id}`} className="inline-flex justify-center rounded-lg bg-[#007bff] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-blue-700">
                    Xem chi tiết
                  </Link>
                </div>
              </article>
            ))}

            {!isSearching && !searchError && filteredJobs.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  Hiển thị {filteredJobs.length} / {totalResults} kết quả, trang {page} / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-bold text-white">{page}</span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}

            {!isSearching && !searchError && !filteredJobs.length && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                Không tìm thấy công việc phù hợp.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
