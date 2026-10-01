import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import Toast from '../../components/Toast.jsx'
import {
  getAdminSePayConfig,
  getAdminSePayDiagnostics,
  rotateAdminSePaySecrets,
  testAdminSePayConnection,
  updateAdminSePayConfig,
} from '../../api/adminService.js'
import { compactId, formatCurrencyVi as formatMoney, formatDateTimeVi as formatDateTime } from '../../utils/formatters.js'

const orderStatusMap = {
  pending: { label: 'Chờ thanh toán', tone: 'border-amber-100 bg-amber-50 text-amber-700' },
  paid: { label: 'Đã thanh toán', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  failed: { label: 'Thất bại', tone: 'border-rose-100 bg-rose-50 text-rose-700' },
  cancelled: { label: 'Đã hủy', tone: 'border-slate-200 bg-slate-100 text-slate-600' },
  expired: { label: 'Hết hạn', tone: 'border-slate-200 bg-slate-100 text-slate-600' },
}

function StatCard({ label, value, tone = 'text-slate-950' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

function Field({ label, value, isCode = false }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`mt-1 text-[12px] font-bold text-slate-800 ${isCode ? 'font-mono break-all' : 'truncate'}`}>
        {value || 'Chưa có'}
      </p>
    </div>
  )
}

function formatSecretDisplay(secretStr) {
  if (!secretStr) return 'Chưa cấu hình'
  const tail = secretStr.replace(/^\*+/, '')
  return '••••••••••••••••' + (tail || secretStr.slice(-4))
}

const inputClassName =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

export default function AdminSePayConfig() {
  const [config, setConfig] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)
  const [recentLimit, setRecentLimit] = useState('10')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [configForm, setConfigForm] = useState({
    bank_account_id: '',
    bank_short_name: '',
    bank_account_number: '',
    bank_account_holder_name: '',
  })
  const [secretForm, setSecretForm] = useState({ api_token: '', webhook_secret: '' })
  const [loading, setLoading] = useState(true)
  const [diagLoading, setDiagLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState(null)
  const [secretOpen, setSecretOpen] = useState(false)

  const syncConfigForm = useCallback((data) => {
    setConfigForm({
      bank_account_id: data?.bank_account_id || '',
      bank_short_name: data?.bank_short_name || '',
      bank_account_number: data?.bank_account_number || '',
      bank_account_holder_name: data?.bank_account_holder_name || '',
    })
  }, [])

  const loadConfig = useCallback(async () => {
    const data = await getAdminSePayConfig()
    setConfig(data)
    syncConfigForm(data)
    return data
  }, [syncConfigForm])

  const loadDiagnostics = useCallback(async (limit = '10') => {
    const data = await getAdminSePayDiagnostics({ recentLimit: Number(limit || 10) })
    setDiagnostics(data)
    return data
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([loadConfig(), loadDiagnostics('10')])
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải cấu hình SePay.' })
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          setDiagLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [loadConfig, loadDiagnostics])

  const stats = useMemo(() => {
    const summary = diagnostics?.order_summary?.by_status || {}
    return {
      pending: summary.pending || 0,
      paid: summary.paid || 0,
      failed: summary.failed || 0,
      stalePending: diagnostics?.order_summary?.pending_older_than_1h || 0,
    }
  }, [diagnostics])

  const handleSaveConfig = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const nextConfig = await updateAdminSePayConfig({
        bank_account_id: configForm.bank_account_id.trim() || null,
        bank_short_name: configForm.bank_short_name.trim() || undefined,
        bank_account_number: configForm.bank_account_number.trim() || null,
        bank_account_holder_name: configForm.bank_account_holder_name.trim() || null,
      })
      setConfig(nextConfig)
      syncConfigForm(nextConfig)
      setToast({ type: 'success', message: 'Đã cập nhật cấu hình tài khoản SePay.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật cấu hình SePay.' })
    } finally {
      setSaving(false)
    }
  }

  const handleRotateSecrets = async (event) => {
    event.preventDefault()
    const body = {}
    if (secretForm.api_token.trim()) body.api_token = secretForm.api_token.trim()
    if (secretForm.webhook_secret.trim()) body.webhook_secret = secretForm.webhook_secret.trim()
    if (!Object.keys(body).length) {
      setToast({ type: 'error', message: 'Hãy nhập ít nhất một secret cần cập nhật.' })
      return
    }

    setRotating(true)
    try {
      const nextConfig = await rotateAdminSePaySecrets(body)
      setConfig(nextConfig)
      setSecretForm({ api_token: '', webhook_secret: '' })
      setSecretOpen(false)
      setToast({ type: 'success', message: 'Đã cập nhật secret SePay thành công.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật secret SePay.' })
    } finally {
      setRotating(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const result = await testAdminSePayConnection()
      setToast({
        type: result?.connected ? 'success' : 'error',
        message: result?.message || (result?.connected ? 'Kết nối tới cổng SePay thành công!' : 'Kết nối SePay thất bại.'),
      })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể kiểm tra kết nối SePay.' })
    } finally {
      setTesting(false)
    }
  }

  const handleReloadDiagnostics = async () => {
    setDiagLoading(true)
    try {
      await loadDiagnostics(recentLimit)
      setToast({ type: 'success', message: 'Đã làm mới danh sách đơn nạp tiền.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể tải lại thông tin SePay.' })
    } finally {
      setDiagLoading(false)
    }
  }

  const handleCopyWebhook = () => {
    const url = config?.webhook_url || config?.webhook_path || ''
    if (!url) return
    navigator.clipboard.writeText(url)
    setToast({ type: 'success', message: 'Đã sao chép đường dẫn Webhook vào bộ nhớ tạm.' })
  }

  return (
    <AdminLayout
      title="Cấu hình SePay"
      subtitle="Quản lý cấu hình tài khoản ngân hàng, API token SePay và theo dõi các đơn nạp tiền tự động qua QR."
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Metrics Row */}
      <section className="admin-metrics mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chờ thanh toán" value={stats.pending} tone="text-amber-700" />
        <StatCard label="Đã thanh toán" value={stats.paid} tone="text-emerald-700" />
        <StatCard label="Thất bại" value={stats.failed} tone="text-rose-700" />
        <StatCard label="Chờ quá 1 giờ" value={stats.stalePending} tone="text-slate-950" />
      </section>

      {/* Main Grid */}
      <section className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left Form: Bank Account Config */}
        <div className="space-y-3">
          <form onSubmit={handleSaveConfig} className="admin-form-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-[14px] font-extrabold text-slate-950">Tài khoản ngân hàng</h2>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">Thông tin nhận tiền chuyển khoản SePay.</p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  ID tài khoản SePay (Bank Account ID)
                </span>
                <input
                  value={configForm.bank_account_id}
                  onChange={(event) => setConfigForm((current) => ({ ...current, bank_account_id: event.target.value }))}
                  placeholder="VD: e8385f14-3e98-11f1-b21a-..."
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  Tên viết tắt ngân hàng
                </span>
                <input
                  value={configForm.bank_short_name}
                  onChange={(event) => setConfigForm((current) => ({ ...current, bank_short_name: event.target.value }))}
                  placeholder="VD: MBBank, VCB, ACB, TPB..."
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  Số tài khoản ngân hàng
                </span>
                <input
                  value={configForm.bank_account_number}
                  onChange={(event) => setConfigForm((current) => ({ ...current, bank_account_number: event.target.value }))}
                  placeholder="VD: 0386606831"
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  Chủ tài khoản (Không dấu)
                </span>
                <input
                  value={configForm.bank_account_holder_name}
                  onChange={(event) => setConfigForm((current) => ({ ...current, bank_account_holder_name: event.target.value }))}
                  placeholder="VD: NHU TRUNG HAI"
                  className={inputClassName}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-md bg-teal-700 px-3 text-[13px] font-extrabold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu cấu hình ngân hàng'}
            </button>
          </form>

          {/* Quick Secret & Test Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-extrabold text-slate-950">Secret & Kết nối</h3>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">API Token và kiểm tra kết nối API.</p>
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 text-[12px] font-extrabold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">sync_saved_locally</span>
                {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">API Token</span>
                  <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {config?.api_token_source || (config?.api_token_configured ? 'Đã cấu hình' : 'Chưa có')}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[12px] font-bold text-slate-700 truncate">
                  {formatSecretDisplay(config?.api_token_preview)}
                </p>
              </div>

              <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Webhook Secret</span>
                  <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {config?.webhook_secret_source || (config?.webhook_secret_configured ? 'Đã cấu hình' : 'Chưa có')}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[12px] font-bold text-slate-700 truncate">
                  {formatSecretDisplay(config?.webhook_secret_preview)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSecretOpen(true)}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-[12px] font-extrabold text-slate-700 transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              Thay đổi API Token / Secret
            </button>
          </div>
        </div>

        {/* Right Section: Webhook URL & Recent Top-Up Orders */}
        <div className="space-y-3">
          {/* Webhook Configuration Guide Card */}
          <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-extrabold text-teal-950">Đường dẫn nhận Webhook SePay</p>
                <p className="mt-0.5 text-[12px] font-medium text-teal-800">
                  Dùng đường dẫn này để dán vào mục <strong>Cấu hình Webhook</strong> trên trang quản trị <strong>my.sepay.vn</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-teal-700">
                  24h: {diagnostics?.order_summary?.webhook_received_last_24h || 0} webhook
                </span>
                <span className="inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                  24h: {diagnostics?.order_summary?.paid_last_24h || 0} đã thanh toán
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  readOnly
                  value={config?.webhook_url || config?.webhook_path || 'Chưa có'}
                  className="h-9 w-full rounded-md border border-teal-200 bg-white pl-3 pr-3 font-mono text-[12px] font-bold text-slate-800 outline-none select-all"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-[12px] font-extrabold text-white transition hover:bg-teal-800"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Sao chép
              </button>
            </div>
          </div>

          {/* Recent Orders Data Panel */}
          <section className="admin-data-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-[14px] font-extrabold text-slate-950">Đơn nạp tiền gần đây</h2>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                  Theo dõi trạng thái các giao dịch nạp tiền qua cổng SePay.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={recentLimit}
                  onChange={(event) => {
                    setRecentLimit(event.target.value)
                    loadDiagnostics(event.target.value)
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-700 outline-none"
                >
                  <option value="5">5 đơn</option>
                  <option value="10">10 đơn</option>
                  <option value="20">20 đơn</option>
                  <option value="50">50 đơn</option>
                </select>
                <button
                  type="button"
                  onClick={handleReloadDiagnostics}
                  disabled={diagLoading}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  {diagLoading ? 'Đang tải...' : 'Làm mới'}
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <div className="hidden grid-cols-[minmax(0,1.2fr)_120px_130px_140px_140px_100px] bg-slate-50 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 lg:grid">
                <span>Mã đơn & Nội dung</span>
                <span>Số tiền</span>
                <span>Trạng thái</span>
                <span>Mã GD SePay</span>
                <span>Cập nhật</span>
                <span></span>
              </div>

              {(diagnostics?.recent_orders || []).map((order) => {
                const statusInfo = orderStatusMap[order.status] || { label: order.status, tone: 'border-slate-200 bg-slate-100 text-slate-600' }
                return (
                  <article
                    key={order._id || order.order_code}
                    className="border-t border-slate-100 px-4 py-3 text-[12px] text-slate-700 transition hover:bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1.2fr)_120px_130px_140px_140px_100px] lg:items-center lg:gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-slate-950">{order.order_code || compactId(order._id)}</p>
                      {order.transfer_content ? (
                        <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-slate-500">
                          {order.transfer_content}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-2 lg:mt-0">
                      <span className="font-extrabold text-emerald-700">
                        {formatMoney(order.amount, order.currency)}
                      </span>
                    </div>

                    <div className="mt-2 lg:mt-0">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${statusInfo.tone}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-2 lg:mt-0">
                      <span className="font-mono text-[11px] font-bold text-slate-600 truncate block">
                        {order.provider_transaction_id || 'Chưa có'}
                      </span>
                    </div>

                    <div className="mt-2 lg:mt-0">
                      <span className="text-[11px] font-medium text-slate-500 block">
                        {formatDateTime(order.updated_at)}
                      </span>
                    </div>

                    <div className="mt-2 lg:mt-0">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-extrabold text-slate-700 transition hover:bg-slate-100"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </article>
                )
              })}

              {!diagLoading && !(diagnostics?.recent_orders || []).length ? (
                <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                  Chưa có đơn nạp tiền nào gần đây.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {/* Modal Cập nhật Secret */}
      <AdminDrawer
        open={secretOpen}
        onClose={() => setSecretOpen(false)}
        title="Cập nhật Secret SePay"
        subtitle="Chỉ nhập các giá trị cần thay đổi. Giá trị đầy đủ được mã hóa và không hiển thị lại."
      >
        <form onSubmit={handleRotateSecrets} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
              API Token mới
            </span>
            <input
              type="password"
              value={secretForm.api_token}
              onChange={(event) => setSecretForm((current) => ({ ...current, api_token: event.target.value }))}
              placeholder="Nhập API Token mới từ SePay..."
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
              Webhook Secret mới
            </span>
            <input
              type="password"
              value={secretForm.webhook_secret}
              onChange={(event) => setSecretForm((current) => ({ ...current, webhook_secret: event.target.value }))}
              placeholder="Nhập Webhook Secret mới..."
              className={inputClassName}
            />
          </label>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
            <div className="text-[12px]">
              <p className="font-extrabold text-slate-900">API token hiện tại</p>
              <p className="mt-0.5 font-mono text-slate-500">{config?.api_token_preview || 'Chưa cấu hình'} · {config?.api_token_source || 'N/A'}</p>
            </div>
            <div className="text-[12px]">
              <p className="font-extrabold text-slate-900">Webhook secret hiện tại</p>
              <p className="mt-0.5 font-mono text-slate-500">{config?.webhook_secret_preview || 'Chưa cấu hình'} · {config?.webhook_secret_source || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSecretOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={rotating || loading}
              className="flex h-10 items-center justify-center rounded-lg bg-teal-700 px-5 text-[13px] font-extrabold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rotating ? 'Đang cập nhật...' : 'Cập nhật secret'}
            </button>
          </div>
        </form>
      </AdminDrawer>

      {/* Modal Chi tiết đơn nạp tiền */}
      <AdminDrawer
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Chi tiết đơn nạp tiền"
        subtitle={selectedOrder ? `Mã đơn: ${selectedOrder.order_code || compactId(selectedOrder._id)}` : ''}
        wide
      >
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold leading-6 text-slate-950">
                  {selectedOrder.order_code || compactId(selectedOrder._id)}
                </h3>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                  Số tiền: <strong className="text-emerald-700 font-extrabold">{formatMoney(selectedOrder.amount, selectedOrder.currency)}</strong>
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${(orderStatusMap[selectedOrder.status] || {}).tone || 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                {(orderStatusMap[selectedOrder.status] || {}).label || selectedOrder.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Mã đơn hàng (Order Code)" value={selectedOrder.order_code} isCode />
              <Field label="Mã ID đơn hàng" value={compactId(selectedOrder._id)} isCode />
              <Field label="Mã người dùng (User ID)" value={compactId(selectedOrder.user_id)} isCode />
              <Field label="Số tiền nạp" value={formatMoney(selectedOrder.amount, selectedOrder.currency)} />
              <Field label="Nội dung chuyển khoản (Memo)" value={selectedOrder.transfer_content} isCode />
              <Field label="Ngân hàng nhận" value={selectedOrder.bank_short_name} />
              <Field label="Số tài khoản nhận" value={selectedOrder.bank_account_number} isCode />
              <Field label="Mã giao dịch SePay" value={selectedOrder.provider_transaction_id} isCode />
              <Field label="Tạo lúc" value={formatDateTime(selectedOrder.created_at)} />
              <Field label="Hết hạn lúc" value={formatDateTime(selectedOrder.expires_at)} />
              <Field label="Thanh toán lúc" value={formatDateTime(selectedOrder.paid_at)} />
              <Field label="Cập nhật lúc" value={formatDateTime(selectedOrder.updated_at)} />
            </div>
          </div>
        ) : null}
      </AdminDrawer>
    </AdminLayout>
  )
}
