import { useEffect, useMemo, useState } from 'react'
import {
  createAdminJobCategory,
  getAdminJobCategories,
  updateAdminJobCategory,
  updateAdminJobCategoryStatus,
} from '../../api/adminService.js'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import { formatDateVi as formatDate } from '../../utils/formatters.js'

const emptyForm = {
  name: '',
  slug: '',
  parent_id: '',
  description: '',
  sort_order: 0,
  is_active: true,
}

const inputClassName = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100'

function buildCategoryRows(categories, expandedIds) {
  const childrenMap = new Map()
  categories.forEach((category) => {
    const parentKey = category.parent_id ? String(category.parent_id) : 'root'
    childrenMap.set(parentKey, [...(childrenMap.get(parentKey) || []), category])
  })

  const sortItems = (items) => [...items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), 'vi'))
  const rows = []
  const walk = (items, depth = 0) => {
    sortItems(items).forEach((category) => {
      const categoryId = String(category._id)
      const children = childrenMap.get(categoryId) || []
      rows.push({
        ...category,
        depth,
        child_count: children.length,
        is_expanded: expandedIds.has(categoryId),
      })

      if (children.length && expandedIds.has(categoryId)) {
        walk(children, depth + 1)
      }
    })
  }

  walk(childrenMap.get('root') || [])
  return rows
}

export default function AdminJobCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState(null)
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const rows = useMemo(() => buildCategoryRows(categories, expandedIds), [categories, expandedIds])
  const editingCategory = categories.find((category) => category._id === editingId)
  const selectableParents = categories.filter((category) => category._id !== editingId)

  const loadCategories = async () => {
    const data = await getAdminJobCategories()
    setCategories(data?.categories || [])
  }

  useEffect(() => {
    let active = true
    loadCategories()
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh mục việc làm.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleToggleExpand = (categoryId) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleEdit = (category) => {
    setEditingId(category._id)
    setFormOpen(true)
    setForm({
      name: category.name || '',
      slug: category.slug || '',
      parent_id: category.parent_id ? String(category.parent_id) : '',
      description: category.description || '',
      sort_order: category.sort_order ?? 0,
      is_active: category.is_active ?? true,
    })
  }

  const handleReset = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setToast({ type: 'error', message: 'Tên danh mục không được để trống.' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        parent_id: form.parent_id || null,
        sort_order: Number(form.sort_order || 0),
        is_active: Boolean(form.is_active),
      }

      if (editingId) {
        await updateAdminJobCategory(editingId, payload)
        setToast({ type: 'success', message: 'Đã cập nhật danh mục.' })
      } else {
        await createAdminJobCategory(payload)
        setToast({ type: 'success', message: 'Đã tạo danh mục mới.' })
      }

      handleReset()
      await loadCategories()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể lưu danh mục.' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (category) => {
    try {
      await updateAdminJobCategoryStatus(category._id, !category.is_active)
      setToast({ type: 'success', message: category.is_active ? 'Đã tắt danh mục.' : 'Đã bật danh mục.' })
      await loadCategories()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể đổi trạng thái danh mục.' })
    }
  }

  return (
    <AdminLayout title="Quản lý danh mục việc làm" subtitle="Tạo, chỉnh sửa và bật/tắt các category dùng cho tin tuyển dụng và recommender.">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-slate-950">Cây danh mục</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{categories.length} danh mục đang được quản lý</p>
          </div>
          <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setFormOpen(true) }} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-[13px] font-extrabold text-white transition hover:bg-teal-800">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
            Tạo danh mục
          </button>
        </div>
        <div className="admin-data-panel flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_100px_110px] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            <span>Danh mục</span>
            <span>Slug</span>
            <span>Số job</span>
            <span>Trạng thái</span>
            <span></span>
          </div>

          <div className="flex-1 divide-y divide-slate-100">
            {rows.map((category) => (
              <article key={category._id} className={`grid grid-cols-[minmax(0,1fr)_120px_100px_100px_110px] items-center gap-3 px-4 py-3 text-[12px] transition ${editingId === category._id ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}>
                <div className="flex min-w-0 items-start gap-2" style={{ paddingLeft: `${category.depth * 18}px` }}>
                  {category.child_count ? (
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(String(category._id))}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                      aria-label={category.is_expanded ? 'Thu gọn danh mục con' : 'Mở danh mục con'}
                    >
                      <span className="material-symbols-outlined text-[16px] leading-none">{category.is_expanded ? 'expand_more' : 'chevron_right'}</span>
                    </button>
                  ) : (
                    <span className="h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-950">{category.name}</p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                      {category.description || 'Chưa có mô tả'} · {formatDate(category.updated_at)}{category.child_count ? ` · ${category.child_count} danh mục con` : ''}
                    </p>
                  </div>
                </div>
                <p className="truncate font-semibold text-slate-500">{category.slug}</p>
                <p className="font-bold text-slate-700">{category.job_count || 0}</p>
                <span className={`w-fit rounded-full border px-2 py-1 text-[11px] font-extrabold ${category.is_active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{category.is_active ? 'Đang bật' : 'Đã tắt'}</span>
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={() => handleEdit(category)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-slate-700 transition hover:bg-slate-50">Sửa</button>
                  <button type="button" onClick={() => handleToggleStatus(category)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-slate-700 transition hover:bg-slate-50">{category.is_active ? 'Tắt' : 'Bật'}</button>
                </div>
              </article>
            ))}

            {!rows.length ? (
              <div className="flex min-h-[360px] items-center justify-center px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                {loading ? 'Đang tải danh mục...' : 'Chưa có danh mục việc làm.'}
              </div>
            ) : null}
          </div>
        </div>

        <AdminDrawer open={formOpen} onClose={handleReset} title={editingId ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'} subtitle={editingCategory ? `Đang sửa: ${editingCategory.name}` : 'Danh mục sẽ được dùng trong form đăng tin.'}>
          <form id="admin-category-form" onSubmit={handleSubmit} className="space-y-3">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Tên danh mục</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClassName} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Slug</span><input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Để trống sẽ tự tạo từ tên" className={inputClassName} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Danh mục cha</span><select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))} className={inputClassName}><option value="">Không có</option>{selectableParents.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Thứ tự</span><input type="number" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} className={inputClassName} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Mô tả</span><textarea rows="3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Đang bật</label>
            <button type="submit" disabled={saving} className="mt-4 flex h-10 w-full items-center justify-center rounded-md bg-teal-700 px-3 text-[13px] font-extrabold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo danh mục'}</button>
          </form>
        </AdminDrawer>
      </section>
    </AdminLayout>
  )
}
