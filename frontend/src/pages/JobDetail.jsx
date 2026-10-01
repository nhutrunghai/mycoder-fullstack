import { Link, useNavigate, useParams } from 'react-router-dom'
import RichTextContent from '../components/RichTextContent.jsx'
import { useEffect, useMemo, useState } from 'react'
import Toast from '../components/Toast.jsx'
import LoginModal from '../components/auth/LoginModal.jsx'
import PublicHeader from '../components/layout/PublicHeader.jsx'
import UserAvatar from '../components/UserAvatar.jsx'
import useCurrentUser from '../hooks/useCurrentUser.js'
import { useFavoriteStore } from '../stores/useFavoriteStore.js'
import { hasAccessToken } from '../config/api.js'
import { applyToJob, loadJobDetail, loadOtherJobDetails, loadUserUploadedCvs, searchPublicJobs, withdrawAppliedJob } from '../data/apiClient.js'
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

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useCurrentUser()
  const { refreshSession } = session
  const favoriteIds = useFavoriteStore((state) => state.favoriteIds)
  const toggleFavoriteInStore = useFavoriteStore((state) => state.toggle)
  const [jobs, setJobs] = useState([])
  const [job, setJob] = useState(null)
  const [isLoadingJob, setIsLoadingJob] = useState(true)
  const [jobLoadError, setJobLoadError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [jobType, setJobType] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [uploadedCvs, setUploadedCvs] = useState([])
  const [isLoadingCvs, setIsLoadingCvs] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [toast, setToast] = useState(null)
  const [applyForm, setApplyForm] = useState({
    cvId: '',
    fullName: '',
    email: '',
    phone: '',
    location: '',
    coverLetter: '',
    allowAiAnalysis: false,
    agreePolicy: false,
  })

  useEffect(() => {
    let active = true

    const loadJobs = async () => {
      setIsLoadingJob(true)
      setJobLoadError('')

      try {
        const jobData = await loadJobDetail(id)
        if (!active) return

        if (!jobData) {
          const fallbackJobs = await loadOtherJobDetails(id)
          if (!active) return
          setJob(null)
          setJobs(fallbackJobs || [])
          setJobLoadError('Không thể tải chi tiết công việc này hoặc tin đã không còn tồn tại.')
          return
        }

        const primaryCategoryId = jobData.categoryIds?.[0]
        let relatedJobs = []

        if (primaryCategoryId) {
          try {
            const relatedResult = await searchPublicJobs({
              category_id: primaryCategoryId,
              page: 1,
              limit: 6,
            })
            relatedJobs = (relatedResult.jobs || []).filter((item) => item.id !== jobData.id)
          } catch {
            relatedJobs = []
          }
        }

        if (!relatedJobs.length) {
          relatedJobs = await loadOtherJobDetails(id)
        }

        if (!active) return
        setJob(jobData)
        setJobs([jobData, ...(relatedJobs || [])])
      } catch (error) {
        if (!active) return
        setJob(null)
        setJobs([])
        setJobLoadError(error?.message || 'Không thể tải chi tiết công việc lúc này.')
      } finally {
        if (active) setIsLoadingJob(false)
      }
    }

    loadJobs()

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!applyOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [applyOpen])

  useEffect(() => {
    if (!applyOpen) return undefined

    let mounted = true
    setIsLoadingCvs(true)

    loadUserUploadedCvs({ redirectOnUnauthorized: false, throwOnError: true })
      .then((items) => {
        if (!mounted) return
        const activeItems = items.filter((item) => item.status !== 'deleted')
        setUploadedCvs(activeItems)
        setApplyForm((prev) => ({
          ...prev,
          cvId: prev.cvId || activeItems.find((item) => item.isDefault)?.id || activeItems[0]?.id || '',
        }))
      })
      .catch(async (error) => {
        if (!mounted) return
        if (!hasAccessToken()) {
          await refreshSession()
          if (!mounted) return
          setApplyOpen(false)
          setLoginOpen(true)
          return
        }
        setToast({ type: 'error', message: error.message || 'Không thể tải danh sách CV.' })
      })
      .finally(() => {
        if (mounted) setIsLoadingCvs(false)
      })

    return () => {
      mounted = false
    }
  }, [applyOpen, refreshSession])

  const otherJobs = useMemo(() => {
    if (!job) return []
    return jobs.filter((item) => item.id !== job.id)
  }, [jobs, job])

  const companyFacts = useMemo(() => {
    if (!job) return []

    return [
      { icon: 'apartment', label: 'Quy mô', value: job.companyFacts?.size || 'Đang cập nhật' },
      { icon: 'work', label: 'Lĩnh vực', value: job.tags?.join(', ') || 'Đang cập nhật' },
      { icon: 'schedule', label: 'Thời gian', value: job.workMode || 'Đang cập nhật' },
      { icon: 'language', label: 'Website', value: job.companyFacts?.website || 'Đang cập nhật' },
    ]
  }, [job])

  const applicationStatus = job?.myApplication?.status || ''
  const hasApplied = Boolean(job?.myApplication)
  const alreadyWithdrawn = withdrawn || applicationStatus === 'withdrawn'
  const hasActiveApplication = hasApplied && !alreadyWithdrawn
  const actionJobId = job?.applyId || job?.backendId || job?.id
  const isFavorite = favoriteIds.has(String(actionJobId || ''))
  const submitSearch = () => {
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('q', keyword.trim())
    if (location) params.set('location', location)
    if (jobType) params.set('job_type', jobType)
    const query = params.toString()
    navigate(query ? `/search-jobs?${query}` : '/search-jobs')
  }

  const handleApplyIntent = async () => {
    if (!session.isAuthenticated) {
      setLoginOpen(true)
      return
    }

    if (session.isLoading) {
      const currentProfile = await refreshSession({ force: false })
      if (!currentProfile) {
        setLoginOpen(true)
        return
      }
    }

    setApplyOpen(true)
  }

  const handleToggleFavorite = async () => {
    if (!actionJobId || isTogglingFavorite) return

    setIsTogglingFavorite(true)
    try {
      const saved = await toggleFavoriteInStore(actionJobId)
      setToast({
        type: 'success',
        message: saved ? 'Đã lưu tin vào danh sách yêu thích.' : 'Đã bỏ lưu tin.',
      })
    } catch (error) {
      setToast({
        type: 'error',
        message: !hasAccessToken() ? 'Vui lòng đăng nhập để lưu tin.' : error.message || 'Không thể cập nhật tin yêu thích.',
      })
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const handleInlineLoginSuccess = async (result) => {
    const currentProfile = await refreshSession({ force: true })
    if (!currentProfile) {
      throw new Error('Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.')
    }

    setLoginOpen(false)
    setToast({ type: 'success', message: result?.message || 'Đăng nhập thành công.' })
    setApplyOpen(true)
  }

  const handleApplySubmit = async () => {
    if (!applyForm.cvId) {
      setToast({ type: 'error', message: 'Vui lòng chọn CV để ứng tuyển.' })
      return
    }

    if (!applyForm.agreePolicy) {
      setToast({ type: 'error', message: 'Vui lòng đồng ý với thỏa thuận sử dụng dữ liệu trước khi nộp hồ sơ.' })
      return
    }

    setIsApplying(true)
    try {
      const application = await applyToJob(
        actionJobId,
        {
          cvId: applyForm.cvId,
          coverLetter: applyForm.coverLetter,
          fullName: applyForm.fullName,
          email: applyForm.email,
          phone: applyForm.phone,
        },
        { redirectOnUnauthorized: false },
      )

      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'Chờ duyệt',
              myApplication: {
                _id: application?._id,
                status: application?.status || 'submitted',
                applied_at: application?.applied_at || new Date().toISOString(),
                updated_at: application?.updated_at || new Date().toISOString(),
              },
            }
          : prev,
      )
      setWithdrawn(false)
      setApplyOpen(false)
      setToast({ type: 'success', message: 'Ứng tuyển thành công.' })
    } catch (error) {
      if (!hasAccessToken()) {
        await refreshSession()
        setApplyOpen(false)
        setLoginOpen(true)
        return
      }
      setToast({ type: 'error', message: error.message || 'Không thể nộp hồ sơ ứng tuyển.' })
    } finally {
      setIsApplying(false)
    }
  }

  if (isLoadingJob) {
    return <div className="min-h-screen bg-[#f3f7fb] p-10 text-center text-slate-600">Đang tải dữ liệu công việc...</div>
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f3f7fb] px-4 py-16 text-slate-900">
        <Toast toast={toast} onClose={() => setToast(null)} />
        <div className="mx-auto max-w-[720px] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_60px_-45px_rgba(15,23,42,0.4)] sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <span className="material-symbols-outlined text-[28px]">error</span>
          </div>
          <h1 className="mt-4 text-[22px] font-black text-slate-950">Không mở được chi tiết công việc</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-600">
            {jobLoadError || 'Đã có lỗi khi tải thông tin công việc. Vui lòng thử lại từ danh sách job.'}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Quay lại
            </button>
            <Link
              to="/search-jobs"
              className="rounded-xl bg-[#007bff] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Đến trang tìm việc
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f7fb] text-slate-900">
      <Toast toast={toast} onClose={() => setToast(null)} />
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
              type="text"
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
          </div>
          <button type="button" onClick={submitSearch} className="search-cta h-11 rounded-xl bg-[#2b59ff] px-8 text-[15px] font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-[#1f4bf1]">
            Tìm kiếm
          </button>
        </div>
      </section>

      <main className="mx-auto max-w-[1240px] px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 break-words text-sm font-medium text-slate-500 sm:mb-5">
          <Link to="/" className="text-[#2489d2] hover:underline">
            Trang chủ
          </Link>{' '}
          /{' '}
          <Link to="/jobs" className="text-[#2489d2] hover:underline">
            Job đã ứng tuyển
          </Link>{' '}
          / <span className="text-slate-700">{job.title}</span>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.4)] sm:p-5">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{job.status}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{job.workMode}</span>
                  </div>
                  <h1 className="max-w-4xl text-[22px] font-semibold leading-tight tracking-tight text-slate-950 sm:text-[25px]">{job.title}</h1>
                  <p className="mt-1.5 text-[16px] font-semibold text-slate-800">{job.company}</p>
                  <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">{job.summary}</p>
                </div>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-600 lg:w-auto">
                  Hạn nộp hồ sơ
                  <p className="mt-1 text-[18px] font-semibold text-slate-900">{job.deadline}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { icon: 'payments', label: 'Thu nhập', value: job.salary },
                  { icon: 'location_on', label: 'Địa điểm', value: job.location },
                  { icon: 'work_history', label: 'Kinh nghiệm', value: job.experience },
                ].map((item) => (
                  <article key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e58b1] text-white shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    </div>
                    <p className="text-[13px] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-[15px] font-semibold text-slate-900">{item.value}</p>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => {
                    if (hasActiveApplication) {
                      setIsWithdrawing(true)
                      withdrawAppliedJob(actionJobId, { redirectOnUnauthorized: false })
                        .then(() => {
                          setWithdrawn(true)
                          setJob((prev) => (prev ? { ...prev, status: 'Đã rút', myApplication: { ...prev.myApplication, status: 'withdrawn' } } : prev))
                        })
                        .catch((error) => {
                          if (!hasAccessToken()) {
                            void refreshSession()
                            setLoginOpen(true)
                            return
                          }
                          alert(error.message || 'Không thể rút hồ sơ.')
                        })
                        .finally(() => {
                          setIsWithdrawing(false)
                        })
                      return
                    }
                    void handleApplyIntent()
                  }}
                  disabled={isWithdrawing}
                  className={`flex-1 rounded-xl px-5 py-3 text-base font-bold text-white transition ${
                    hasActiveApplication ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#007bff] hover:bg-blue-700'
                  } ${isWithdrawing ? 'cursor-default opacity-70' : ''}`}
                >
                  {hasActiveApplication ? (isWithdrawing ? 'Đang rút...' : 'Rút hồ sơ') : alreadyWithdrawn ? 'Ứng tuyển lại' : 'Ứng tuyển ngay'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleFavorite()}
                  disabled={isTogglingFavorite}
                  aria-pressed={isFavorite}
                  className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-5 text-base font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                    isFavorite
                      ? 'border-blue-200 bg-blue-50 text-[#1e58b1] hover:bg-blue-100'
                      : 'border-[#1e58b1] bg-white text-[#1e58b1] hover:bg-blue-50'
                  }`}
                >
                  <span className="material-symbols-outlined !text-[21px]" style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}>
                    {isFavorite ? 'favorite' : 'favorite_border'}
                  </span>
                  {isFavorite ? 'Đã lưu' : 'Lưu tin'}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.4)] sm:p-5">
              <div className="mb-6 flex items-center justify-between gap-4 overflow-x-auto border-b border-slate-200 pb-4">
                <div className="flex min-w-max items-center gap-6 sm:gap-8">
                  <button className="border-b-2 border-[#007bff] pb-3 text-[15px] font-semibold text-[#007bff]">Chi tiết tin tuyển dụng</button>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="mb-4 flex items-center gap-3 text-[17px] font-semibold text-slate-950">
                  <span className="h-7 w-1.5 rounded-full bg-[#007bff]" />
                  Thẻ công việc
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="mb-3 text-[17px] font-semibold text-slate-950">Mô tả công việc</h3>
                  <RichTextContent value={job.richDescription || job.responsibilities.join('\n')} className="text-[14px] leading-7 text-slate-700" />
                </section>

                <section>
                  <h3 className="mb-3 text-[17px] font-semibold text-slate-950">Yêu cầu ứng viên</h3>
                  <RichTextContent value={job.richRequirements || job.requirements.join('\n')} className="text-[14px] leading-7 text-slate-700" />
                </section>

                <section>
                  <h3 className="mb-3 text-[17px] font-semibold text-slate-950">Quyền lợi</h3>
                  <RichTextContent value={job.richBenefits || job.benefits.join('\n')} className="text-[14px] leading-7 text-slate-700" />
                </section>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[19px] font-semibold tracking-tight text-slate-950">Việc làm liên quan</h3>
                {job.categoryIds?.[0] ? (
                  <Link
                    to={`/search-jobs?category_id=${encodeURIComponent(job.categoryIds[0])}`}
                    className="text-sm font-bold text-[#007bff] hover:underline"
                  >
                    Xem thêm
                  </Link>
                ) : null}
              </div>

              <div className="space-y-3">
                {otherJobs.map((item) => (
                  <article key={item.id} className="soft-radius group border border-slate-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-md">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar src={item.avatar} name={item.company} className="h-10 w-10 border border-slate-50" textClassName="text-xs" />
                        <div className="min-w-0">
                          <h4 className="truncate text-[14px] font-bold text-slate-800">{item.company}</h4>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {item.postedAt} / <span className="material-symbols-outlined !text-[11px]">location_on</span> {item.location}
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 transition group-hover:text-red-400">favorite</span>
                    </div>

                    <Link to={`/job-detail/${item.id}`} className="mb-3 block text-[17px] font-bold text-slate-900 transition-colors group-hover:text-primary hover:text-primary">
                      {item.title}
                    </Link>

                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#28a745]">
                      <span className="material-symbols-outlined !text-[16px]">payments</span> {item.salary}
                    </div>

                    <p className="mb-3 text-[12px] leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-700">Yêu cầu:</span> {item.requirements || 'Đang cập nhật yêu cầu'}
                    </p>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {(item.tags || item.skills || []).slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <Link to={`/job-detail/${item.id}`} className="inline-flex justify-center rounded-lg bg-[#007bff] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-blue-700">
                        Xem chi tiết
                      </Link>
                    </div>
                  </article>
                ))}

                {!otherJobs.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                    Chưa có việc làm liên quan phù hợp.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.4)]">
              <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-950">{job.company}</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">{job.companyDescription || 'Đang cập nhật thông tin công ty.'}</p>

              <div className="mt-6 space-y-4">
                {companyFacts.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#007bff]">
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-[15px] font-semibold text-slate-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.4)]">
              <h3 className="mb-5 text-[19px] font-semibold tracking-tight text-slate-950">Thông tin chung</h3>
              <div className="space-y-4">
                {[
                  { icon: 'trending_up', label: 'Cấp bậc', value: job.level },
                  { icon: 'groups', label: 'Số lượng tuyển', value: job.openings },
                  { icon: 'business_center', label: 'Hình thức làm việc', value: job.workMode },
                  { icon: 'location_on', label: 'Địa chỉ công ty', value: job.companyFacts?.address || 'Đang cập nhật' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <span className="material-symbols-outlined !text-[20px]">{item.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-5 text-slate-500">{item.label}</p>
                      <p className="mt-0.5 text-[14px] font-semibold leading-5 text-slate-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </aside>
        </div>
      </main>

      {loginOpen ? (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={handleInlineLoginSuccess}
        />
      ) : null}

      {applyOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
          <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[19px] font-black leading-tight text-slate-900 sm:text-[22px]">
                  Ứng tuyển <span className="text-blue-600">{job.title}</span>
                  <p className="mt-1 text-[14px] font-bold text-blue-600">{job.company}</p>
                </h2>
                <button onClick={() => setApplyOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 sm:h-11 sm:w-11">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </header>

            <div className="space-y-5 px-4 py-5 sm:px-6">
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-[15px] font-black text-slate-900">
                  <span className="material-symbols-outlined text-blue-600">badge</span>
                  Chọn CV để ứng tuyển
                </h3>

                <div className="rounded-xl border border-blue-300 bg-[#f5f9ff] p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <span className="material-symbols-outlined text-blue-600">radio_button_checked</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-700">Chọn CV đã tải lên trong thư viện của bạn.</p>
                      <p className="mt-1 text-[12px] text-slate-500">Hệ thống sẽ gửi CV này cùng thư giới thiệu cho nhà tuyển dụng.</p>
                    </div>
                    <Link to="/uploaded-cvs" className="w-full whitespace-nowrap rounded-lg bg-white px-4 py-2 text-center text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 sm:ml-auto sm:w-auto">
                      Quản lý CV
                    </Link>
                  </div>

                  {isLoadingCvs ? (
                    <div className="rounded-lg border border-dashed border-blue-200 bg-white/70 px-4 py-3 text-[13px] font-semibold text-slate-500">
                      Đang tải danh sách CV...
                    </div>
                  ) : uploadedCvs.length ? (
                    <div className="mb-4 space-y-2">
                      {uploadedCvs.map((cv) => (
                        <label
                          key={cv.id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${
                            applyForm.cvId === cv.id ? 'border-blue-400 bg-white shadow-sm' : 'border-slate-200 bg-white/70 hover:border-blue-300'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-slate-800">{cv.title}</span>
                            <span className="mt-0.5 flex items-center gap-2 text-[12px] text-slate-500">
                              <span>{cv.fileType}</span>
                              {cv.isDefault ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">CV mặc định</span> : null}
                            </span>
                          </span>
                          <input
                            type="radio"
                            name="cvId"
                            value={cv.id}
                            checked={applyForm.cvId === cv.id}
                            onChange={(e) => setApplyForm((prev) => ({ ...prev, cvId: e.target.value }))}
                            className="h-4 w-4 shrink-0 accent-blue-600"
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-4 rounded-lg border border-dashed border-blue-200 bg-white/70 px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-700">Bạn chưa có CV nào trong hệ thống.</p>
                      <Link to="/uploaded-cvs" className="mt-2 inline-flex text-[13px] font-bold text-blue-600 hover:underline">
                        Upload CV trước khi ứng tuyển
                      </Link>
                    </div>
                  )}

                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[14px] font-bold text-blue-600">Vui lòng nhập đầy đủ thông tin chi tiết:</p>
                    <p className="text-[12px] font-semibold text-rose-500">(*) Thông tin bắt buộc.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[13px] font-bold text-slate-700">Họ và tên *</label>
                      <input value={applyForm.fullName} onChange={(e) => setApplyForm((prev) => ({ ...prev, fullName: e.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Họ tên hiển thị với NTD" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[13px] font-bold text-slate-700">Email *</label>
                        <input value={applyForm.email} onChange={(e) => setApplyForm((prev) => ({ ...prev, email: e.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Email hiển thị với NTD" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[13px] font-bold text-slate-700">Số điện thoại *</label>
                        <input value={applyForm.phone} onChange={(e) => setApplyForm((prev) => ({ ...prev, phone: e.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Số điện thoại hiển thị với NTD" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <label className="mb-2 block text-[15px] font-black text-slate-900">Địa điểm làm việc mong muốn *</label>
                <select value={applyForm.location} onChange={(e) => setApplyForm((prev) => ({ ...prev, location: e.target.value }))} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <option value="">Chọn địa điểm bạn muốn làm việc</option>
                  <option value="TP.HCM">TP.HCM</option>
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                </select>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-[15px] font-black text-slate-900">
                  <span className="material-symbols-outlined text-blue-600">edit</span>
                  Thư giới thiệu
                </h3>
                <p className="mb-2 text-[13px] leading-6 text-slate-500">Một thư giới thiệu ngắn gọn, chỉn chu sẽ giúp bạn trở nên chuyên nghiệp và gây ấn tượng hơn với nhà tuyển dụng.</p>
                <textarea value={applyForm.coverLetter} onChange={(e) => setApplyForm((prev) => ({ ...prev, coverLetter: e.target.value }))} rows={4} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Viết giới thiệu ngắn gọn về bản thân và lý do bạn muốn ứng tuyển." />
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-2 text-[15px] font-black text-rose-500">Lưu ý</h4>
                <ol className="ml-5 list-decimal space-y-2 text-[13px] leading-6 text-slate-700">
                  <li>Cẩn thận trong quá trình tìm việc và chủ động nghiên cứu thông tin công ty trước khi ứng tuyển.</li>
                  <li>Nếu gặp tin đăng nghi ngờ, vui lòng báo cáo ngay để được hỗ trợ kịp thời.</li>
                </ol>
              </section>

              <div className="space-y-3 border-t border-slate-200 pt-3">
                <label className="flex items-start gap-3 text-[13px] text-slate-700">
                  <input type="checkbox" checked={applyForm.allowAiAnalysis} onChange={(e) => setApplyForm((prev) => ({ ...prev, allowAiAnalysis: e.target.checked }))} className="mt-1 h-5 w-5 rounded border-slate-300" />
                  Cho phép hệ thống sử dụng công nghệ AI để phân tích độ phù hợp CV của bạn.
                </label>
                <label className="flex items-start gap-3 text-[13px] text-slate-700">
                  <input type="checkbox" checked={applyForm.agreePolicy} onChange={(e) => setApplyForm((prev) => ({ ...prev, agreePolicy: e.target.checked }))} className="mt-1 h-5 w-5 rounded border-slate-300" />
                  Tôi đã đọc và đồng ý với thỏa thuận sử dụng dữ liệu cá nhân của nhà tuyển dụng.
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button onClick={() => setApplyOpen(false)} disabled={isApplying} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Hủy</button>
                <button
                  onClick={handleApplySubmit}
                  disabled={isApplying || isLoadingCvs || !uploadedCvs.length}
                  className="rounded-lg bg-[#007bff] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isApplying ? 'Đang nộp hồ sơ...' : 'Nộp hồ sơ ứng tuyển'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
