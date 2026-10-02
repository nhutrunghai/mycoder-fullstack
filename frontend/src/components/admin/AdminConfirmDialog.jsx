import AdminModal from './AdminModal.jsx'

export default function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  confirming = false,
  tone = 'danger',
  children,
}) {
  const confirmClass = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20'

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      size="sm"
      footer={(
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`h-8 rounded-lg px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass}`}
          >
            {confirming ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      )}
    >
      {children || (
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            tone === 'danger' ? 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-500/20' : 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-500/20'
          }`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              {tone === 'danger' ? 'error' : 'info'}
            </span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed pt-1">
            {description || 'Bạn có chắc chắn muốn thực hiện hành động này không?'}
          </div>
        </div>
      )}
    </AdminModal>
  )
}
