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
  draft: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  paused: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  closed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/10',
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function MetricCard({ label, value, detail, icon, to }) {
  return (
    <Link
      to={to}
      className="group relative rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{formatNumber(value)}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <span className="text-slate-500">{detail}</span>
        <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700 transition" aria-hidden="true">
          arrow_forward
        </span>
      </div>
    </Link>
  )
}

function SectionCard({ title, description, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-slate-500 mt-0.5">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ message }) {
  return (
    <div className="py-10 text-center text-xs font-medium text-slate-400">
      {message}
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

  return (
    <AdminLayout
      title="Bảng điều khiển tổng quan"
      subtitle="Chỉ số hoạt động, dữ liệu tuyển dụng và hàng đợi kiểm duyệt thời gian thực."
    >
      {/* 4 Metric Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Tổng người dùng"
          value={summary.total_users ?? 0}
          detail={`${formatNumber(summary.verified_users ?? 0)} tài khoản đã xác minh`}
          icon="group"
          to="/admin/users"
        />
        <MetricCard
          label="Doanh nghiệp"
          value={summary.total_companies ?? 0}
          detail={`${formatNumber(summary.verified_companies ?? 0)} công ty đã duyệt`}
          icon="apartment"
          to="/admin/companies"
        />
        <MetricCard
          label="Tin tuyển dụng đang mở"
          value={summary.open_jobs ?? 0}
          detail={`Tổng ${formatNumber(summary.total_jobs ?? 0)} tin toàn hệ thống`}
          icon="work"
          to="/admin/jobs"
        />
        <MetricCard
          label="Hàng đợi kiểm duyệt"
          value={summary.blocked_jobs ?? 0}
          detail={`${formatNumber(summary.pending_approvals ?? 0)} mục cần xử lý`}
          icon="rule"
          to="/admin/jobs"
        />
      </section>

      {/* Main Grid: Left (Tables) & Right (Side Feeds) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left 2 Cols: Recent Jobs & Moderation Queue */}
        <div className="space-y-5 lg:col-span-2">
          <SectionCard
            title="Tin tuyển dụng mới cập nhật"
            description="Các vị trí việc làm đang hoạt động gần đây."
            action={
              <Link to="/admin/jobs" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                Xem toàn bộ
              </Link>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Vị trí việc làm</th>
                    <th className="py-2.5 px-4">Doanh nghiệp</th>
                    <th className="py-2.5 px-4">Trạng thái</th>
                    <th className="py-2.5 px-4 text-right">Ngày đăng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => (
                    <tr key={job._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <Link to="/admin/jobs" className="hover:text-indigo-600 transition line-clamp-1">
                          {job.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600 line-clamp-1">
                        {job.company_name || job.company?.name || 'Doanh nghiệp'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${statusToneMap[job.status] || 'bg-slate-100 text-slate-600'}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {statusLabelMap[job.status] || job.status || 'Chưa rõ'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-mono whitespace-nowrap">
                        {formatDate(job.updated_at || job.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!jobs.length ? <EmptyState message="Chưa có dữ liệu tin tuyển dụng mới." /> : null}
            </div>
          </SectionCard>

          {/* Blocked / Moderation Queue */}
          <SectionCard
            title="Hàng đợi kiểm duyệt vi phạm"
            description="Tin tuyển dụng có dấu hiệu bất thường hoặc bị báo cáo."
            action={
              <Link to="/admin/jobs" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                Mở hàng đợi
              </Link>
            }
          >
            <div className="divide-y divide-slate-100">
              {blockedJobs.map((job) => (
                <div key={job._id} className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50/60 transition">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{job.title}</p>
                    <p className="mt-1 text-xs text-rose-600 font-medium line-clamp-1">
                      Lý do chặn: {job.blocked_reason || 'Vi phạm chính sách nội dung.'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 font-mono">
                      Cập nhật: {formatDate(job.updated_at)}
                    </p>
                  </div>
                  <Link
                    to="/admin/jobs"
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Kiểm tra
                  </Link>
                </div>
              ))}
              {!blockedJobs.length ? (
                <div className="p-6 text-center text-xs font-medium text-slate-400">
                  Không có tin tuyển dụng nào trong danh sách bị chặn.
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        {/* Right 1 Col: Recent Companies & Recent Users */}
        <div className="space-y-5">
          {/* Recent Companies */}
          <SectionCard
            title="Doanh nghiệp mới"
            action={
              <Link to="/admin/companies" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                Xem tất cả
              </Link>
            }
          >
            <div className="divide-y divide-slate-100">
              {companies.slice(0, 5).map((company) => (
                <div key={company._id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{company.company_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{formatDate(company.created_at)}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
                    company.verified
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                      : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                  }`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {company.verified ? 'Đã duyệt' : 'Chờ duyệt'}
                  </span>
                </div>
              ))}
              {!companies.length ? <EmptyState message="Chưa có dữ liệu doanh nghiệp." /> : null}
            </div>
          </SectionCard>

          {/* Recent Users */}
          <SectionCard
            title="Người dùng mới"
            action={
              <Link to="/admin/users" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                Xem tất cả
              </Link>
            }
          >
            <div className="divide-y divide-slate-100">
              {users.slice(0, 5).map((user) => (
                <div key={user._id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {(user.fullName || user.username || user.email || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {user.fullName || user.username || 'Người dùng'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email || '—'}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {user.role === 2 ? 'Admin' : user.role === 1 ? 'Nhà tuyển dụng' : 'Ứng viên'}
                  </span>
                </div>
              ))}
              {!users.length ? <EmptyState message="Chưa có dữ liệu người dùng." /> : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </AdminLayout>
  )
}
