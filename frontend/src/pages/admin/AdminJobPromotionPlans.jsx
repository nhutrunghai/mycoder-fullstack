import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.jsx'
import Toast from '../../components/Toast.jsx'
import {
  createAdminJobPromotionPlan,
  deleteAdminJobPromotionPlan,
  getAdminJobPromotionPlans,
  updateAdminJobPromotionPlan,
} from '../../api/adminService.js'

const emptyForm = {
  code: '',
  name: '',
  description: '',
  daily_price: '50000',
  currency: 'VND',
  min_duration_days: '1',
  max_duration_days: '30',
  default_priority: '100',
  sort_order: '0',
  is_active: true,
}

const formatMoney = (value, currency = 'VND') =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(Number(value || 0))

export default function AdminJobPromotionPlans() {
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: '',
    tone: 'danger',
    action: null,
  })

  const loadPlans = async () => {
    setLoading(true)
    try {
      const data = await getAdminJobPromotionPlans()
      setPlans(data?.plans || data?.data?.plans || [])
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải danh sách gói quảng cáo.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  // KPI Statistics
  const stats = useMemo(() => {
    const total = plans.length
    const active = plans.filter((p) => p.is_active).length
    const inactive = total - active
    const totalPromotions = plans.reduce((acc, p) => acc + (p.total_promotions || 0), 0)
    const activePromotions = plans.reduce((acc, p) => acc + (p.active_promotions || 0), 0)
    return { total, active, inactive, totalPromotions, activePromotions }
  }, [plans])

  const handleOpenCreate = () => {
    setEditingId('')
    setForm(emptyForm)
    setFormOpen(true)
  }

  const handleOpenEdit = (plan) => {
    setEditingId(plan._id)
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      daily_price: String(plan.daily_price),
      currency: plan.currency || 'VND',
      min_duration_days: String(plan.min_duration_days || 1),
      max_duration_days: String(plan.max_duration_days || 30),
      default_priority: String(plan.default_priority || 100),
      sort_order: String(plan.sort_order || 0),
      is_active: plan.is_active !== false,
    })
    setFormOpen(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    const normalizedCode = form.code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const payload = {
      code: normalizedCode,
      name: form.name.trim(),
      description: form.description.trim(),
      daily_price: Number(form.daily_price),
      currency: form.currency,
      min_duration_days: Number(form.min_duration_days),
      max_duration_days: Number(form.max_duration_days),
      default_priority: Number(form.default_priority),
      sort_order: Number(form.sort_order),
      is_active: Boolean(form.is_active),
    }

    try {
      if (editingId) {
        await updateAdminJobPromotionPlan(editingId, payload)
        setToast({ type: 'success', message: 'Đã cập nhật gói quảng cáo thành công.' })
      } else {
        await createAdminJobPromotionPlan(payload)
        setToast({ type: 'success', message: 'Đã tạo gói quảng cáo mới thành công.' })
      }
      setFormOpen(false)
      await loadPlans()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể lưu gói quảng cáo.' })
    } finally {
      setSaving(false)
    }
  }

  const handlePromptToggleStatus = (plan) => {
    const nextActive = !plan.is_active
    setConfirmDialog({
      open: true,
      title: nextActive ? 'Kích hoạt gói quảng cáo' : 'Tạm dừng gói quảng cáo',
      description: nextActive
        ? `Cho phép nhà tuyển dụng chọn mua gói quảng cáo "${plan.name}" trên hệ thống?`
        : `Tạm dừng gói "${plan.name}"? Nhà tuyển dụng sẽ không thể mua mới gói này, các chiến dịch đang chạy vẫn giữ nguyên.`,
      confirmLabel: nextActive ? 'Kích hoạt gói' : 'Tạm dừng gói',
      tone: nextActive ? 'primary' : 'warning',
      action: async () => {
        try {
          await updateAdminJobPromotionPlan(plan._id, { is_active: nextActive })
          setToast({
            type: 'success',
            message: `Đã ${nextActive ? 'kích hoạt' : 'tạm dừng'} gói quảng cáo "${plan.name}".`,
          })
          await loadPlans()
        } catch (error) {
          setToast({ type: 'error', message: error.message || 'Không thể thay đổi trạng thái gói.' })
        }
      },
    })
  }

  const handlePromptDelete = (plan) => {
    if (plan.total_promotions > 0) {
      setToast({
        type: 'warning',
        message: 'Gói này đã phát sinh chiến dịch tuyển dụng. Hãy tạm dừng gói thay vì xóa để bảo toàn dữ liệu.',
      })
      return
    }

    setConfirmDialog({
      open: true,
      title: 'Xóa gói quảng cáo',
      description: `Bạn có chắc chắn muốn xóa vĩnh viễn gói "${plan.name}" (${plan.code})? Hành động này không thể hoàn tác.`,
      confirmLabel: 'Xóa gói vĩnh viễn',
      tone: 'danger',
      action: async () => {
        try {
          await deleteAdminJobPromotionPlan(plan._id)
          setToast({ type: 'success', message: 'Đã xóa gói quảng cáo thành công.' })
          await loadPlans()
        } catch (error) {
          setToast({ type: 'error', message: error.message || 'Không thể xóa gói quảng cáo.' })
        }
      },
    })
  }

  return (
    <AdminLayout
      title="Gói quảng cáo tuyển dụng"
      subtitle="Quản lý bảng giá, độ ưu tiên hiển thị và thời hạn tối thiểu/tối đa của các gói dịch vụ quảng cáo."
      actions={
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Tạo gói quảng cáo mới</span>
        </button>
      }
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Tổng số gói</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <span className="material-symbols-outlined text-[16px]">sell</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="mt-1 text-[11px] text-slate-400">Các gói cấu hình trên hệ thống</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Đang kích hoạt</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-emerald-600">{stats.active}</p>
          <p className="mt-1 text-[11px] text-slate-400">Nhà tuyển dụng có thể mua</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Tạm dừng / Ẩn</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-[16px]">pause_circle</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-amber-600">{stats.inactive}</p>
          <p className="mt-1 text-[11px] text-slate-400">Tạm khóa không mở bán</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Lượt chiến dịch</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <span className="material-symbols-outlined text-[16px]">campaign</span>
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">{stats.totalPromotions}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            <span className="font-semibold text-emerald-600">{stats.activePromotions}</span> chiến dịch đang chạy
          </p>
        </div>
      </section>

      {/* Plans Table */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Gói quảng cáo</th>
                <th className="py-3 px-4 text-center">Độ ưu tiên</th>
                <th className="py-3 px-4 text-right">Đơn giá / ngày</th>
                <th className="py-3 px-4 text-center">Thời lượng áp dụng</th>
                <th className="py-3 px-4 text-center">Lượt sử dụng</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <tr key={plan._id} className="hover:bg-slate-50/70 transition">
                  {/* Name & Code */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-xs">{plan.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 font-semibold uppercase">
                        {plan.code}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{plan.description}</p>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                      <span>{plan.default_priority || 0}</span>
                    </span>
                  </td>

                  {/* Daily Price */}
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {formatMoney(plan.daily_price, plan.currency)}
                  </td>

                  {/* Duration */}
                  <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {plan.min_duration_days} – {plan.max_duration_days} ngày
                  </td>

                  {/* Usage & Cross link */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <Link
                      to={`/admin/job-promotions?planId=${plan._id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      <span className="font-semibold">{plan.active_promotions || 0}</span> đang chạy
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-500">{plan.total_promotions || 0} tổng</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  </td>

                  {/* Status Toggle Button */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handlePromptToggleStatus(plan)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset transition ${
                        plan.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 ring-slate-500/10 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${plan.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{plan.is_active ? 'Đang kích hoạt' : 'Tạm dừng'}</span>
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(plan)}
                        className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        <span>Sửa</span>
                      </button>

                      {plan.total_promotions > 0 ? (
                        <button
                          type="button"
                          disabled
                          title="Gói này đã có chiến dịch sử dụng, chỉ có thể tạm dừng thay vì xóa."
                          className="inline-flex h-7 items-center justify-center rounded-md border border-slate-100 bg-slate-50 px-2.5 text-xs font-medium text-slate-300 cursor-not-allowed"
                        >
                          <span>Xóa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePromptDelete(plan)}
                          className="inline-flex h-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition"
                        >
                          <span>Xóa</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!plans.length && (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải danh sách gói quảng cáo...' : 'Chưa có gói quảng cáo nào được tạo.'}
            </div>
          )}
        </div>
      </section>

      {/* Create / Edit Modal (Centered) */}
      <AdminModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Chỉnh sửa gói quảng cáo' : 'Tạo gói quảng cáo mới'}
        subtitle="Cấu hình tên gọi, mức giá theo ngày, thời lượng và độ ưu tiên xếp hạng trên hệ thống."
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tên gói quảng cáo <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Nổi bật trang chủ - Tiêu chuẩn"
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Mã định danh (Code) <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="homepage-standard, top-vip..."
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">Chỉ dùng chữ thường, số và dấu gạch nối (-)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Đơn giá / ngày (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.daily_price}
                onChange={(e) => setForm({ ...form, daily_price: e.target.value })}
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Số ngày tối thiểu <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.min_duration_days}
                onChange={(e) => setForm({ ...form, min_duration_days: e.target.value })}
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Số ngày tối đa <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.max_duration_days}
                onChange={(e) => setForm({ ...form, max_duration_days: e.target.value })}
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Độ ưu tiên hiển thị (Priority) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.default_priority}
                onChange={(e) => setForm({ ...form, default_priority: e.target.value })}
                required
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                Gói có điểm ưu tiên cao hơn (ví dụ: 200 &gt; 100) sẽ được xếp trên cùng ở trang chủ.
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Thứ tự hiển thị bảng giá</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">Số nhỏ hơn sẽ đứng trước khi nhà tuyển dụng chọn gói.</p>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Mô tả quyền lợi gói</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Hiển thị tin tuyển dụng trong khu vực nổi bật trên trang chủ, tiếp cận hàng ngàn ứng viên mỗi ngày..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="plan_is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="plan_is_active" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
              Kích hoạt gói dịch vụ này (cho phép hiển thị và mua mới)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu gói quảng cáo'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Confirmation Dialog */}
      <AdminConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          if (confirmDialog.action) {
            await confirmDialog.action()
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }))
        }}
        title={confirmDialog.title}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
      >
        <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.description}</p>
      </AdminConfirmDialog>
    </AdminLayout>
  )
}
