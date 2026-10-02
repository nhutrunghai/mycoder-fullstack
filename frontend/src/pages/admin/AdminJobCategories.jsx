import { useEffect, useMemo, useState } from 'react'
import {
  createAdminJobCategory,
  getAdminJobCategories,
  updateAdminJobCategory,
  updateAdminJobCategoryStatus,
} from '../../api/adminService.js'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.jsx'
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

const inputClassName =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-100'

function getDescendantIds(categories, rootId) {
  const descendants = new Set()
  const queue = [String(rootId)]
  while (queue.length > 0) {
    const currentId = queue.shift()
    categories.forEach((cat) => {
      if (cat.parent_id && String(cat.parent_id) === currentId) {
        const childId = String(cat._id)
        if (!descendants.has(childId)) {
          descendants.add(childId)
          queue.push(childId)
        }
      }
    })
  }
  return descendants
}

function buildCategoryRows(categories, expandedIds, keyword = '', statusFilter = '') {
  const childrenMap = new Map()
  categories.forEach((category) => {
    const parentKey = category.parent_id ? String(category.parent_id) : 'root'
    childrenMap.set(parentKey, [...(childrenMap.get(parentKey) || []), category])
  })

  const sortItems = (items) =>
    [...items].sort(
      (a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        String(a.name).localeCompare(String(b.name), 'vi')
    )

  const cleanKeyword = keyword.trim().toLowerCase()
  const isFiltering = Boolean(cleanKeyword || statusFilter)
  const matchedIds = new Set()
  const ancestorIds = new Set()

  if (isFiltering) {
    categories.forEach((cat) => {
      const matchKey =
        !cleanKeyword ||
        cat.name?.toLowerCase().includes(cleanKeyword) ||
        cat.slug?.toLowerCase().includes(cleanKeyword)
      const matchStatus =
        !statusFilter ||
        (statusFilter === 'active' && cat.is_active) ||
        (statusFilter === 'inactive' && !cat.is_active)

      if (matchKey && matchStatus) {
        matchedIds.add(String(cat._id))
        let currParent = cat.parent_id ? String(cat.parent_id) : null
        while (currParent) {
          ancestorIds.add(currParent)
          const p = categories.find((c) => String(c._id) === currParent)
          currParent = p?.parent_id ? String(p.parent_id) : null
        }
      }
    })
  }

  const rows = []
  const walk = (items, depth = 0) => {
    sortItems(items).forEach((category) => {
      const categoryId = String(category._id)
      const children = childrenMap.get(categoryId) || []

      if (isFiltering && !matchedIds.has(categoryId) && !ancestorIds.has(categoryId)) {
        return
      }

      const isExpanded = isFiltering ? true : expandedIds.has(categoryId)
      rows.push({
        ...category,
        depth,
        child_count: children.length,
        is_expanded: isExpanded,
        is_matched: matchedIds.has(categoryId),
      })

      if (children.length && isExpanded) {
        walk(children, depth + 1)
      }
    })
  }

  walk(childrenMap.get('root') || [])
  return rows
}

function buildTreeSelectOptions(categories, excludedIds = new Set()) {
  const childrenMap = new Map()
  categories.forEach((category) => {
    const parentKey = category.parent_id ? String(category.parent_id) : 'root'
    childrenMap.set(parentKey, [...(childrenMap.get(parentKey) || []), category])
  })

  const sortItems = (items) =>
    [...items].sort(
      (a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        String(a.name).localeCompare(String(b.name), 'vi')
    )

  const options = []
  const walk = (items, depth = 0) => {
    sortItems(items).forEach((cat) => {
      const catId = String(cat._id)
      if (excludedIds.has(catId)) return

      const prefix = depth > 0 ? '— '.repeat(depth) : ''
      options.push({
        _id: cat._id,
        name: `${prefix}${cat.name}`,
        depth,
      })

      const children = childrenMap.get(catId) || []
      if (children.length) {
        walk(children, depth + 1)
      }
    })
  }

  walk(childrenMap.get('root') || [])
  return options
}

export default function AdminJobCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState(null)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    category: null,
    title: '',
    description: '',
    confirmLabel: 'Xác nhận',
    tone: 'danger',
  })

  const loadCategories = async () => {
    try {
      const data = await getAdminJobCategories()
      setCategories(data?.categories || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    loadCategories().catch((error) => {
      if (active) setToast({ type: 'error', message: error.message || 'Không thể tải danh mục việc làm.' })
    })
    return () => {
      active = false
    }
  }, [])

  // KPI calculations
  const stats = useMemo(() => {
    const total = categories.length
    const active = categories.filter((c) => c.is_active).length
    const inactive = total - active
    const root = categories.filter((c) => !c.parent_id).length
    return { total, active, inactive, root }
  }, [categories])

  const rows = useMemo(
    () => buildCategoryRows(categories, expandedIds, keyword, statusFilter),
    [categories, expandedIds, keyword, statusFilter]
  )

  const editingCategory = useMemo(
    () => categories.find((cat) => cat._id === editingId),
    [categories, editingId]
  )

  const excludedParentIds = useMemo(() => {
    if (!editingId) return new Set()
    return new Set([String(editingId), ...getDescendantIds(categories, editingId)])
  }, [categories, editingId])

  const parentOptions = useMemo(
    () => buildTreeSelectOptions(categories, excludedParentIds),
    [categories, excludedParentIds]
  )

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

  const handleExpandAll = () => {
    const allParentIds = new Set()
    categories.forEach((cat) => {
      allParentIds.add(String(cat._id))
    })
    setExpandedIds(allParentIds)
  }

  const handleCollapseAll = () => {
    setExpandedIds(new Set())
  }

  const handleOpenCreate = (parentId = '') => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      parent_id: parentId ? String(parentId) : '',
    })
    setModalOpen(true)
  }

  const handleEdit = (category) => {
    setEditingId(category._id)
    setForm({
      name: category.name || '',
      slug: category.slug || '',
      parent_id: category.parent_id ? String(category.parent_id) : '',
      description: category.description || '',
      sort_order: category.sort_order ?? 0,
      is_active: category.is_active ?? true,
    })
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(false)
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
        name: form.name.trim(),
        slug: form.slug.trim(),
        parent_id: form.parent_id || null,
        description: form.description.trim(),
        sort_order: Number(form.sort_order || 0),
        is_active: Boolean(form.is_active),
      }

      if (editingId) {
        await updateAdminJobCategory(editingId, payload)
        setToast({ type: 'success', message: 'Đã cập nhật thông tin danh mục.' })
      } else {
        await createAdminJobCategory(payload)
        setToast({ type: 'success', message: 'Đã tạo danh mục việc làm mới.' })
      }

      handleCloseModal()
      await loadCategories()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể lưu danh mục.' })
    } finally {
      setSaving(false)
    }
  }

  const handlePromptToggleStatus = (category) => {
    const nextStatus = !category.is_active
    const jobNotice = category.job_count > 0 ? ` Danh mục này hiện có ${category.job_count} việc làm liên kết.` : ''
    const childNotice = category.child_count > 0 ? ` Danh mục này có ${category.child_count} danh mục con.` : ''
    setConfirmDialog({
      open: true,
      category,
      title: nextStatus ? 'Kích hoạt danh mục' : 'Tạm tầt danh mục',
      description: nextStatus
        ? `Bạn có chắc muốn kích hoạt danh mục "${category.name}"? Danh mục này sậ hiển thị trở lại cho nhà tuyển dụng khi đăng tin.`
        : `Bạn có chắc muốn tạm tắt danh mục "${category.name}"?${jobNotice}${childNotice} Danh mục này sõ tạm thời bị ẩn khỏi bộ lọc và form đăng tin mới.`,
      confirmLabel: nextStatus ? 'Kích hoạt' : 'Tạm tắt',
      tone: nextStatus ? 'primary' : 'danger',
    })
  }

  const handleConfirmToggle = async () => {
    const { category } = confirmDialog
    if (!category) return

    setConfirmDialog((prev) => ({ ...prev, open: false }))
    try {
      await updateAdminJobCategoryStatus(category._id, !category.is_active)
      setToast({
        type: 'success',
        message: category.is_active
          ? `Đã tạm tắt danh mục "${category.name}".`
          : `Đã kích hoạt danh mục "${category.name}".`,
      })
      await loadCategories()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể đổi trạng thái danh mục.' })
    }
  }

  return (
    <AdminLayout
      title="Quản lý danh mục việc làm"
      subtitle="Thiết lập cây danh mục ngành nghề, liên kết nhóm việc làm IT và quản lý cấu trúc hiển thị."
      actions={
        <button
          type="button"
          onClick={() => handleOpenCreate()}
          className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800 shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Tạo danh mục</span>
        </button>
      }
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards (Real-time Database-wide) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Tổng danh mục', stats.total, 'text-slate-800 bg-slate-100 ring-slate-400/20'],
          ['Đang hoạt động', stats.active, 'text-teal-800 bg-teal-50 ring-teal-600/20'],
          ['Đã tạm tắt', stats.inactive, 'text-slate-600 bg-slate-100 ring-slate-400/20'],
          ['Danh mục gốc', stats.root, 'text-slate-800 bg-slate-100 ring-slate-400/20'],
        ].map(([label, value, badgeStyle]) => (
          <div key={label} className="rounded-lg border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-900">{value}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ring-1 ring-inset ${badgeStyle}`}>
                Toàn hệ thống
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Search & Filter Toolbar */}
      <section className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:max-w-md">
            <div className="relative">
              <span
                aria-hidden="true"
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-slate-400"
              >
                search
              </span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm theo tên danh mục hoặc slug..."
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-100 transition"
              />
              {keyword ? (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  title="Xóa từ khóa tìm kiếm"
                  className="ajsolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  ✕
                </button>
              ) : null}
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none transition"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang bật</option>
              <option value="inactive">Đã tắt</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px]">unfold_more</span>
              <span>Mở rộng</span>
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px]">unfold_less</span>
              <span>Thu gọn</span>
            </button>
          </div>
        </div>

        {keyword || statusFilter ? (
          <div className="mt-3 flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md w-fit">
            <span className="material-symbols-outlined text-[15px] text-slate-500">filter_alt</span>
            <span>
              Đang lọc theo: {keyword ? <strong>"{keyword}"</strong> : null}
              {keyword && statusFilter ? ' · ' : null}
              {statusFilter === 'active' ? <strong>Đang bật</strong> : null}
              {statusFilter === 'inactive' ? <strong>Đã tắt</strong> : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setStatusFilter('')
              }}
              title="Xóa bộ lọc"
              className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-slate-200 text-slate-500 transition ml-1 font-bold"
            >
              ✕
            </button>
          </div>
        ) : null}
      </section>

      {/* Category Tree Table */}
      <section className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Tên danh mục</th>
                <th className="py-2.5 px-4">Slug nhận diện</th>
                <th className="py-2.5 px-4 text-center">Số việc làm</th>
                <th className="py-2.5 px-4">Trạng thái</th>
                <th className="py-2.5 px-4">Cập nhật</th>
                <th className="py-2.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((category) => {
                const isSelected = editingId === category._id
                return (
                  <tr
                    key={category._id}
                    className={`transition ${
                      isSelected
                        ? 'bg-teal-50/40'
                        : category.is_matched
                        ? 'bg-amber-50/30 hover:bg-slate-50/70'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Category Name with Clean Tree Hierarchy */}
                    <td className="py-2.5 px-4">
                      <div
                        className="flex items-center gap-1.5 min-w-[240px]"
                        style={{ paddingLeft: `${category.depth * 20}px` }}
                      >
                        {category.depth > 0 ? (
                          <span className="text-slate-300 font-mono text-[13px] select-none shrink-0 mr-0.5">
                            └─
                          </span>
                        ) : null}

                        {category.child_count ? (
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(String(category._id))}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                            aria-label={category.is_expanded ? 'Thu gọn' : 'Mở rộng'}
                          >
                            <span className="material-symbols-outlined text-[15px] leading-none">
                              {category.is_expanded ? 'expand_more' : 'chevron_right'}
                            </span>
                          </button>
                        ) : (
                          <span className="inline-block h-5 w-5 shrink-0" />
                        )}

                        <span className="material-symbols-outlined text-[17px] text-slate-400 shrink-0">
                          {category.depth === 0 ? 'folder' : 'label'}
                        </span>

                        <div className="min-w-0 ml-1">
                          <p className="font-semibold text-slate-900 truncate">
                            {category.name}
                            {category.child_count ? (
                              <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                                ({category.child_count} mục con)
                              </span>
                            ) : null}
                          </p>
                          {category.description ? (
                            <p className="text-[11px] text-slate-400 truncate max-w-sm">
                              {category.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        {category.slug}
                      </span>
                    </td>

                    {/* Job Count (Pure Number, no colorful pill, no link) */}
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`font-mono text-xs ${
                          category.job_count > 0 ? 'font-semibold text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {category.job_count || 0}
                      </span>
                    </td>

                    {/* Slim Status Badge */}
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium ${
                          category.is_active
                            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            category.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{category.is_active ? 'Đang bật' : 'Đã tắt'}</span>
                      </span>
                    </td>

                    {/* Updated At */}
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] font-medium whitespace-nowrap">
                      {formatDate(category.updated_at || category.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCreate(category._id)}
                          title="Thêm danh mục con"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(category)}
                          className="h-7 rounded border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptToggleStatus(category)}
                          className={`h-7 min-w-[50px] text-center rounded border px-2.5 text-xs font-medium transition shadow-2xs ${
                            category.is_active
                              ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-rose-600'
                              : 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {category.is_active ? 'Tắt' : 'Bật'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-slate-300">
                        category
                      </span>
                      <p className="text-xs font-medium">
                        {loading
                          ? 'Đang tải cây danh mục việc làm...'
                          : keyword || statusFilter
                          ? 'Không tìm thấy danh mục nào phù hợp với bộ lọc.'
                          : 'Chưa có danh mục việc làm nào trên hệ thống.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Center Modal: Create & Edit Category */}
      <AdminModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? 'Chỉnh sửa danh mục việc làm' : 'Tạo danh mục việc làm mới'}
        subtitle={
          editingCategory
            ? `Đang cập nhật danh mục "${editingCategory.name}"`
            : 'Danh mục được sử dụng trong form đăng tin và hệ thống gợi ý việc làm.'
        }
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={saving}
              className="h-8 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="admin-category-form"
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 transition shadow-2xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">
                    progress_activity
                  </span>
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{editingId ? 'Lưu thay đổi' : 'Tạo danh mục'}</span>
              )}
            </button>
          </div>
        }
      >
        <form id="admin-category-form" onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tên danh mục <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((curr) => ({ ...curr, name: event.target.value }))}
              placeholder="Ví dụ: Backend Developer, Data Engineer..."
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Slug định danh URL
            </label>
            <input
              value={form.slug}
              onChange={(event) => setForm((curr) => ({ ...curr, slug: event.target.value }))}
              placeholder="Để trống hệ thống sẽ tự động tạo từ tên danh mục"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Danh mục cha (Cấp trên)
            </label>
            <select
              value={form.parent_id}
              onChange={(event) => setForm((curr) => ({ ...curr, parent_id: event.target.value }))}
              className={inputClassName}
            >
              <option value="">Không có (Danh mục gốc cấp 1)</option>
              {parentOptions.map((opt) => (
                <option key={String(opt._id)} value={String(opt._id)}>
                  {opt.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              {editingId
                ? 'Hệ thống đã tự động ẩn chính nó và toàn bộ danh mục con cháu để tránh lỗi vòng lặp.'
                : 'Chọn danh mục cấp trên hoặc để trống để tạo danh mục gốc.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Thứ tự sắp xếp
              </label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, sort_order: event.target.value }))
                }
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Trạng thái hoạt động
              </label>
              <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((curr) => ({ ...curr, is_active: event.target.checked }))
                  }
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-slate-700">Đang kích hoạt</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mô tả danh mục
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((curr) => ({ ...curr, description: event.target.value }))
              }
              placeholder="Mô tả ngắn gọn về nhóm ngành nghề và công nghệ liên quan..."
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-100"
            />
          </div>
        </form>
      </AdminModal>

      {/* Confirm Status Change Dialog */}
      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleConfirmToggle}
      />
    </AdminLayout>
  )
}
