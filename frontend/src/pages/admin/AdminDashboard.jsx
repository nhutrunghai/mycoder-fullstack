import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import {
  getAdminCompanies,
  getAdminDashboardSummary,
  getAdminJobs,
  getAdminUsers,
} from '../../api/adminService.js'
import { queryKeys } from '../../lib/queryKeys.js'

const statusLabelMap = {
  draft: 'Bản nháp',
  open: 'Đang tuyển',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
  expired: 'Hết hạn',
}

const statusToneMap = {
  draft: 'bg-slate-100 text-slate-600',
  open: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-amber-50 text-amber-700',
  closed: 'bg-rose-50 text-rose-700',
  expired: 'bg-slate-100 text-slate-600',
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function MetricCard({ label, value, detail, icon, accent, to }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-[#b7d8d0] hover:shadow-[0_16px_30px_-24px_rgba(20,41,38,0.38)] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-[30px] font-extrabold leading-none text-slate-950">{formatNumber(value)}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent.replace('bg-', 'bg-').replace('-500', '-50')} text-slate-700`}>
          <span className="material-symbols-outlined text-[21px]" aria-hidden="true">{icon}</span>
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-slate-500">{detail}</p>
        <span className="material-symbols-outlined text-[17px] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-800" aria-hidden="true">
          arrow_forward
        </span>
      </div>
    </Link>
  )
}

function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex min-h-16 items-start justify-between gap-4 border-b border-slate-100 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-[12px] font-medium leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ message }) {
  return (
    <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
      {message}
    </div>
  )
}

function ProgressRow({ label, current, total, tone = 'bg-slate-800' }) {
  const percentage = total ? Math.min(100, Math.round((Number(current) / Number(total)) * 100)) : 0

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-extrabold text-slate-900">{percentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.admin.summary,
    queryFn: getAdminDashboardSummary,
  })
  const usersQuery = useQuery({
    queryKey: queryKeys.dashboard.admin.users,
    queryFn: () => getAdminUsers({ page: 1, limit: 5 }),
  })
  const companiesQuery = useQuery({
    queryKey: queryKeys.dashboard.admin.companies,
    queryFn: () => getAdminCompanies({ page: 1, limit: 5 }),
  })
  const jobsQuery = useQuery({
    queryKey: queryKeys.dashboard.admin.jobs,
    queryFn: () => getAdminJobs({ page: 1, limit: 6 }),
  })
  const blockedJobsQuery = useQuery({
    queryKey: queryKeys.dashboard.admin.blockedJobs,
    queryFn: () => getAdminJobs({ page: 1, limit: 4, moderation_status: 'blocked' }),
  })

  const summary = summaryQuery.data || {}
  const users = usersQuery.data?.users ?? []
  const companies = companiesQuery.data?.companies ?? []
  const jobs = jobsQuery.data?.jobs ?? []
  const blockedJobs = blockedJobsQuery.data?.jobs ?? []
  const isLoading = [summaryQuery, usersQuery, companiesQuery, jobsQuery, blockedJobsQuery].some(
    (query) => query.isPending || query.isFetching,
  )

  const totalUsers = Number(summary.total_users) || 0
  const totalCompanies = Number(summary.total_companies) || 0
  const totalJobs = Number(summary.total_jobs) || 0
  const unverifiedUsers = Number(summary.unverified_users) || 0
  const unverifiedCompanies = Number(summary.unverified_companies) || 0
  const openJobs = Number(summary.open_jobs) || 0
  const derived = {
    pendingReviews: unverifiedUsers + unverifiedCompanies + blockedJobs.length,
    verifiedUsers: Math.max(0, totalUsers - unverifiedUsers),
    verifiedCompanies: Math.max(0, totalCompanies - unverifiedCompanies),
    openJobs,
    totalJobs,
    totalUsers,
    totalCompanies,
    unverifiedUsers,
    unverifiedCompanies,
  }

  return (
    <AdminLayout
      title="Tổng quan"
      subtitle="Theo dõi số liệu vận hành, các mục cần kiểm duyệt và thay đổi mới nhất trong hệ thống."
    >
      <section className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg bg-[#1d292d] px-5 py-5 text-white shadow-[0_18px_36px_-28px_rgba(20,41,38,0.62)] sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Trung tâm vận hành
              </div>
              <h2 className="mt-3 text-[24px] font-extrabold leading-tight">Bảng điều hành quản trị</h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-400">
                Ưu tiên xử lý các tài khoản, doanh nghiệp và tin tuyển dụng đang cần kiểm duyệt.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 sm:min-w-36 sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Mục cần xử lý</p>
              <p className="mt-1 text-[28px] font-extrabold leading-none text-white">{formatNumber(derived.pendingReviews)}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Link to="/admin/users" className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/10 transition hover:bg-white/10">
              <p className="text-[11px] font-semibold text-slate-400">Ứng viên chờ xác minh</p>
              <p className="mt-1.5 text-[21px] font-extrabold">{formatNumber(derived.unverifiedUsers)}</p>
            </Link>
            <Link to="/admin/companies" className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/10 transition hover:bg-white/10">
              <p className="text-[11px] font-semibold text-slate-400">Doanh nghiệp chờ duyệt</p>
              <p className="mt-1.5 text-[21px] font-extrabold">{formatNumber(derived.unverifiedCompanies)}</p>
            </Link>
            <Link to="/admin/jobs" className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/10 transition hover:bg-white/10">
              <p className="text-[11px] font-semibold text-slate-400">Tin bị chặn gần đây</p>
              <p className="mt-1.5 text-[21px] font-extrabold">{formatNumber(blockedJobs.length)}</p>
            </Link>
          </div>
        </div>

        <Panel
          title="Trạng thái hệ thống"
          description={isLoading ? 'Đang đồng bộ dữ liệu...' : 'Dữ liệu từ các API quản trị.'}
          action={<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Đang hoạt động</span>}
        >
          <div className="space-y-4 p-4">
            <ProgressRow label="Ứng viên đã xác minh" current={derived.verifiedUsers} total={derived.totalUsers} tone="bg-teal-600" />
            <ProgressRow label="Doanh nghiệp đã xác minh" current={derived.verifiedCompanies} total={derived.totalCompanies} tone="bg-emerald-500" />
            <ProgressRow label="Tin đang tuyển" current={derived.openJobs} total={derived.totalJobs} tone="bg-amber-500" />
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] font-medium leading-5 text-slate-500">
              Tỷ lệ được tính từ dữ liệu tổng hợp hiện có, không mô phỏng xu hướng theo thời gian.
            </div>
          </div>
        </Panel>
      </section>

      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="Người dùng" value={summary.total_users} detail={`${formatNumber(summary.unverified_users)} chưa xác minh`} icon="group" accent="bg-teal-600" to="/admin/users" />
        <MetricCard label="Doanh nghiệp" value={summary.total_companies} detail={`${formatNumber(summary.unverified_companies)} cần duyệt`} icon="apartment" accent="bg-emerald-500" to="/admin/companies" />
        <MetricCard label="Tin tuyển dụng" value={summary.total_jobs} detail={`${formatNumber(summary.open_jobs)} đang tuyển`} icon="work" accent="bg-amber-500" to="/admin/jobs" />
        <MetricCard label="Hồ sơ ứng tuyển" value={summary.total_applications} detail="Tổng hồ sơ đã ghi nhận" icon="assignment_ind" accent="bg-cyan-700" to="/admin/jobs" />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_340px]">
        <Panel
          title="Tin tuyển dụng mới nhất"
          description="Các bản ghi được cập nhật gần đây."
          action={<Link to="/admin/jobs" className="inline-flex min-h-8 items-center gap-1 text-[12px] font-bold text-slate-600 transition hover:text-slate-950">Xem tất cả <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></Link>}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[660px]">
              <div
                className="grid gap-3 bg-slate-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"
                style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(130px, 0.9fr) 100px 94px' }}
              >
                <span>Tin tuyển dụng</span>
                <span>Doanh nghiệp</span>
                <span>Trạng thái</span>
                <span>Cập nhật</span>
              </div>
              {jobs.map((job) => (
                <Link
                  key={job._id}
                  to="/admin/jobs"
                  className="grid gap-3 border-t border-slate-100 px-4 py-3 text-[12px] transition hover:bg-slate-50"
                  style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(130px, 0.9fr) 100px 94px' }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-900">{job.title}</p>
                    <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{job.level || 'Chưa có cấp bậc'} · {job.location || 'Chưa có địa điểm'}</p>
                  </div>
                  <p className="truncate self-center font-semibold text-slate-600">{job.company?.company_name || 'Chưa có doanh nghiệp'}</p>
                  <span className={`w-fit self-center rounded-full px-2.5 py-1 text-[10px] font-bold ${statusToneMap[job.status] || 'bg-slate-100 text-slate-600'}`}>
                    {statusLabelMap[job.status] || job.status || 'Chưa rõ'}
                  </span>
                  <p className="self-center font-semibold text-slate-500">{formatDate(job.updated_at)}</p>
                </Link>
              ))}
              {!jobs.length ? <EmptyState message="Chưa có dữ liệu tin tuyển dụng." /> : null}
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel
            title="Hàng đợi kiểm duyệt"
            description="Tin tuyển dụng bị chặn gần đây."
            action={<Link to="/admin/jobs" className="text-[12px] font-bold text-slate-600 transition hover:text-slate-950">Mở danh sách</Link>}
          >
            <div className="space-y-2 p-3">
              {blockedJobs.map((job) => (
                <Link key={job._id} to="/admin/jobs" className="block rounded-lg border border-rose-100 bg-rose-50/70 p-3 transition hover:border-rose-200 hover:bg-rose-50">
                  <p className="truncate text-[12px] font-extrabold text-slate-900">{job.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-rose-700">{job.blocked_reason || 'Đã bị chặn bởi quản trị viên.'}</p>
                </Link>
              ))}
              {!blockedJobs.length ? <div className="rounded-lg bg-emerald-50 px-3 py-4 text-[12px] font-bold text-emerald-800">Không có tin bị chặn trong danh sách gần đây.</div> : null}
            </div>
          </Panel>

          <Panel
            title="Doanh nghiệp mới"
            action={<Link to="/admin/companies" className="text-[12px] font-bold text-slate-600 transition hover:text-slate-950">Xem tất cả</Link>}
          >
            <div className="divide-y divide-slate-100 px-3">
              {companies.slice(0, 4).map((company) => (
                <Link key={company._id} to="/admin/companies" className="flex items-center justify-between gap-3 py-3 transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-extrabold text-slate-900">{company.company_name}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">{formatDate(company.updated_at || company.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${company.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {company.verified ? 'Đã xác minh' : 'Chờ duyệt'}
                  </span>
                </Link>
              ))}
              {!companies.length ? <EmptyState message="Chưa có dữ liệu doanh nghiệp." /> : null}
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-3">
        <Panel
          title="Người dùng cập nhật gần đây"
          description="Các tài khoản mới nhất từ API quản trị."
          action={<Link to="/admin/users" className="inline-flex min-h-8 items-center gap-1 text-[12px] font-bold text-slate-600 transition hover:text-slate-950">Xem tất cả <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></Link>}
        >
          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
            {users.map((user) => (
              <Link key={user._id} to="/admin/users" className="flex min-w-0 items-center gap-2.5 p-3 transition hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[13px] font-extrabold text-slate-700">
                  {(user.fullName || user.email || 'U').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-extrabold text-slate-900">{user.fullName || user.username || 'Người dùng'}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">{user.email || 'Chưa có email'}</span>
                </span>
              </Link>
            ))}
            {!users.length ? <div className="md:col-span-2 xl:col-span-5"><EmptyState message="Chưa có dữ liệu người dùng." /></div> : null}
          </div>
        </Panel>
      </section>
    </AdminLayout>
  )
}
