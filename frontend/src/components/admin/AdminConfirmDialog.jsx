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
}) {
  const confirmClass = tone === 'danger'
    ? 'bg-rose-700 hover:bg-rose-800 focus-visible:ring-rose-700'
    : 'bg-teal-700 hover:bg-teal-800 focus-visible:ring-teal-700'

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      size="sm"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="h-10 rounded-md border border-slate-200 bg-white px-4 text-[13px] font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`h-10 rounded-md px-4 text-[13px] font-extrabold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass}`}
          >
            {confirming ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      )}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-md ${tone === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'}`}>
        <span aria-hidden="true" className="material-symbols-outlined">warning</span>
      </div>
    </AdminModal>
  )
}
