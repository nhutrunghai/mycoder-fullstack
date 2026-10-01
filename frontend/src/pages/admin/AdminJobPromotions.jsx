import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import {
  createAdminJobPromotion,
  deleteAdminJobPromotion,
  getAdminJobPromotionPlans,
  getAdminJobPromotions,
  getAdminJobs,
  updateAdminJobPromotion,
} from '../../api/adminService.js'
import { formatDateTimeVi as formatDate } from '../../utils/formatters.js'
import {
  PROMOTION_STATUS_LABELS,
  PROMOTION_STATUS_TONES,
} from '../../features/job-promotions/presentation.js'

function datetimeLocal(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function emptyForm() {
  const start = new Date(Date.now() + 60 * 60 * 1000)
  return { jobId: '', plan_id: '', starts_at: datetimeLocal(start), ends_at: datetimeLocal(new Date(start.getTime() + 86400000)) }
}

export default function AdminJobPromotions() {
  const [promotions, setPromotions] = useState([])
  const [plans, setPlans] = useState([])
  const [jobs, setJobs] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const loadData = useCallback(async (searchKeyword = '') => {
    setLoading(true)
    try {
      const [promotionData, planData, jobData] = await Promise.all([
        getAdminJobPromotions({ page: 1, limit: 100, status: status || undefined, keyword: searchKeyword || undefined }),
        getAdminJobPromotionPlans(),
        getAdminJobs({ page: 1, limit: 100 }),
      ])
      setPromotions(promotionData?.promotions || promotionData?.data?.promotions || [])
      setPlans(planData?.plans || planData?.data?.plans || [])
      setJobs((jobData?.jobs || jobData?.data?.jobs || []).filter((job) => (
        job.status === 'open' && job.moderation_status !== 'blocked' && new Date(job.expired_at) > new Date()
      )))
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải dữ liệu quảng cáo.' })
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { loadData() }, [loadData])

  const selectedPlan = useMemo(() => plans.find((item) => item._id === form.plan_id), [form.plan_id, plans])
  const durationDays = Math.max(0, Math.ceil((new Date(form.ends_at) - new Date(form.starts_at)) / 86400000))

  const selectPlan = (planId) => {
    const plan = plans.find((item) => item._id === planId)
    const start = new Date(form.starts_at)
    const days = Number(plan?.min_duration_days || 1)
    setForm({ ...form, plan_id: planId, ends_at: datetimeLocal(new Date(start.getTime() + days * 86400000)) })
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { plan_id: form.plan_id, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() }
      if (editingId) await updateAdminJobPromotion(editingId, payload)
      else await createAdminJobPromotion({ ...payload, jobId: form.jobId })
      setToast({ type: 'success', message: editingId ? 'Đã cập nhật lượt quảng cáo.' : 'Đã gán gói quảng cáo vào job.' })
      setEditingId('')
      setForm(emptyForm())
      setFormOpen(false)
      await loadData()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể lưu lượt quảng cáo.' })
    } finally {
      setSaving(false)
    }
  }

  const edit = (promotion) => {
    setEditingId(promotion._id)
    setForm({ jobId: promotion.job_id, plan_id: promotion.plan_id || '', starts_at: datetimeLocal(promotion.starts_at), ends_at: datetimeLocal(promotion.ends_at) })
    setFormOpen(true)
  }

  const cancel = async (promotion) => {
    if (!window.confirm(`Hủy quảng cáo cho “${promotion.job?.title}”?`)) return
    try {
      await updateAdminJobPromotion(promotion._id, { status: 'cancelled' })
      setToast({ type: 'success', message: 'Đã hủy lượt quảng cáo.' })
      await loadData()
    } catch (error) { setToast({ type: 'error', message: error.message }) }
  }

  const remove = async (promotion) => {
    if (!window.confirm('Xóa vĩnh viễn lượt quảng cáo này?')) return
    try {
      await deleteAdminJobPromotion(promotion._id)
      setToast({ type: 'success', message: 'Đã xóa lượt quảng cáo.' })
      await loadData()
    } catch (error) { setToast({ type: 'error', message: error.message }) }
  }

  const inputClass = 'mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100'

  return (
    <AdminLayout title="Quảng cáo tuyển dụng" subtitle="Gán một gói đã cấu hình vào job; giá và độ ưu tiên được lấy tự động từ gói.">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-extrabold text-slate-950">Danh sách lượt quảng cáo</p><p className="mt-1 text-xs font-medium text-slate-500">Chỉ mở form khi cần gán gói mới hoặc chỉnh sửa lịch chạy.</p></div>
        <button type="button" onClick={() => { setEditingId(''); setForm(emptyForm()); setFormOpen(true) }} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-[13px] font-extrabold text-white transition hover:bg-teal-800"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>Gán gói vào job</button>
      </div>

      <AdminDrawer open={formOpen} onClose={() => { setEditingId(''); setForm(emptyForm()); setFormOpen(false) }} title={editingId ? 'Chỉnh sửa lượt quảng cáo' : 'Gán gói vào job'} subtitle="Admin chỉ chọn job, gói và thời gian chạy. Giá cùng độ ưu tiên được lấy từ gói.">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">Job<select required disabled={Boolean(editingId)} value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} className={inputClass}><option value="">Chọn job</option>{jobs.map((job) => <option key={job._id} value={job._id}>{job.title} — {job.company?.company_name || 'Doanh nghiệp'}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">Gói quảng cáo<select required value={form.plan_id} onChange={(e) => selectPlan(e.target.value)} className={inputClass}><option value="">Chọn gói</option>{plans.map((plan) => <option key={plan._id} value={plan._id} disabled={plan.is_active === false && plan._id !== form.plan_id}>{plan.name}{plan.is_active === false ? ' (đã tắt)' : ''}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">Bắt đầu<input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inputClass} /></label>
          <label className="text-xs font-bold text-slate-600">Kết thúc<input required type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inputClass} /></label>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
            {selectedPlan ? <><strong className="text-slate-900">{selectedPlan.name}</strong> · {Number(selectedPlan.daily_price).toLocaleString('vi-VN')} {selectedPlan.currency}/ngày · ưu tiên {selectedPlan.default_priority} · cho phép {selectedPlan.min_duration_days}–{selectedPlan.max_duration_days} ngày. Đang chọn: {durationDays} ngày.</> : 'Chọn gói để xem cấu hình được áp dụng.'}
          </div>
          <button disabled={saving || !selectedPlan} className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-extrabold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{saving ? 'Đang lưu...' : editingId ? 'Lưu lượt quảng cáo' : 'Gán gói vào job'}</button>
        </form>
      </AdminDrawer>

      <section className="admin-filter-bar rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(PROMOTION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo tên job..." className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <button onClick={() => loadData(keyword)} className="h-10 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-700">Tìm kiếm</button>
        </div>
      </section>

      <section className="admin-data-panel mt-4 space-y-3 rounded-xl border border-slate-200 bg-transparent p-3">
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải lượt quảng cáo...</div> : null}
        {!loading && !promotions.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Chưa có lượt quảng cáo.</div> : null}
        {promotions.map((promotion) => (
          <article key={promotion._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-slate-900">{promotion.job?.title || 'Tin tuyển dụng'}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${PROMOTION_STATUS_TONES[promotion.status] || 'bg-slate-100 text-slate-600'}`}>{PROMOTION_STATUS_LABELS[promotion.status] || promotion.status}</span></div><p className="mt-1 text-sm text-slate-500">{promotion.company?.company_name} · {promotion.plan_snapshot?.name || 'Gói cũ'}</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">{[['Bắt đầu', formatDate(promotion.starts_at)], ['Kết thúc', formatDate(promotion.ends_at)], ['Ưu tiên', promotion.priority], ['Nguồn', promotion.source === 'employer_purchase' ? 'Nhà tuyển dụng mua' : 'Admin gán']].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-700">{value}</p></div>)}</div>
              <div className="flex gap-2"><button onClick={() => edit(promotion)} disabled={promotion.source === 'employer_purchase' || promotion.status === 'expired' || promotion.status === 'cancelled'} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:opacity-40">Sửa</button><button onClick={() => cancel(promotion)} disabled={!['active', 'scheduled'].includes(promotion.status)} className="h-9 rounded-md border border-amber-100 px-3 text-xs font-bold text-amber-700 disabled:opacity-40">Hủy</button><button onClick={() => remove(promotion)} disabled={promotion.source === 'employer_purchase' || Number(promotion.amount_paid) > 0} className="h-9 rounded-md border border-rose-100 px-3 text-xs font-bold text-rose-600 disabled:opacity-40">Xóa</button></div>
            </div>
          </article>
        ))}
      </section>
    </AdminLayout>
  )
}
