import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminDrawer from '../../components/admin/AdminDrawer.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import Toast from '../../components/Toast.jsx'
import {
  getAdminSePayConfig,
  getAdminSePayDiagnostics,
  rotateAdminSePaySecrets,
  testAdminSePayConnection,
  updateAdminSePayConfig,
} from '../../api/adminService.js'
import { formatCurrencyVi as formatMoney, formatDateTimeVi as formatDateTime } from '../../utils/formatters.js'

const orderStatusMap = {
  pending: { label: 'Chờ thanh toán', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  paid: { label: 'Đã thanh toán', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  failed: { label: 'Thất bại', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  cancelled: { label: 'Đã hủy', tone: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
  expired: { label: 'Hết hạn', tone: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
}

function PropertyRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 text-xs">
      <span className="text-slate-500 font-medium shrink-0">{label}</span>
      <span className={`text-slate-900 text-right ${mono ? 'font-mono' : 'font-medium'} break-all`}>
        {value || '—'}
      </span>
    </div>
  )
}

function formatSecretDisplay(secretStr) {
  if (!secretStr) return 'Chưa cấu hình'
  const tail = secretStr.replace(/^\*+/, '')
  return '••••••••••••' + (tail || secretStr.slice(-4))
}

export default function AdminSePayConfig() {
  const [config, setConfig] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)
  const [recentLimit, setRecentLimit] = useState('10')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [secretOpen, setSecretOpen] = useState(false)
  const [configForm, setConfigForm] = useState({
    bank_account_id: '',
    bank_short_name: '',
    bank_account_number: '',
    bank_account_holder_name: '',
  })
  const [secretForm, setSecretForm] = useState({ api_token: '', webhook_secret: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState(null)

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
        if (active) setLoading(false)
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
      setToast({ type: 'error', message: 'Hãy nhập ít nhất một token/secret cần cập nhật.' })
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
        message: result?.message || (result?.connected ? 'Kết nối SePay Gateway thành công.' : 'Kết nối SePay thất bại.'),
      })
      loadDiagnostics(recentLimit)
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Lỗi kiểm tra kết nối SePay.' })
    } finally {
      setTesting(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setToast({ type: 'success', message: `Đã sao chép ${label} vào clipboard!` })
  }

  const recentOrders = diagnostics?.recent_orders ?? []

  return (
    <AdminLayout
      title="Cấu hình SePay Webhook & Thanh toán"
      subtitle="Quản lý cổng thanh toán tự động SePay, webhook xác thực giao dịch ngân hàng và tài khoản nhận tiền."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSecretOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20"
          >
            <span className="material-symbols-outlined text-[16px]">key</span>
            <span>Cập nhật Secret/Token</span>
          </button>
        </div>
      }
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Đã thanh toán', stats.paid, 'text-emerald-700 bg-emerald-50'],
          ['Đang chờ xử lý', stats.pending, 'text-amber-700 bg-amber-50'],
          ['Thất bại / Hủy', stats.failed, 'text-rose-700 bg-rose-50'],
          ['Chờ quá 1 giờ', stats.stalePending, 'text-slate-700 bg-slate-100'],
        ].map(([label, value, badgeStyle]) => (
          <div key={label} className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-900">{value}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badgeStyle}`}>
                Thống kê
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Grid: Webhook Info & Bank Config */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: Webhook & Gateway Status */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">Thông tin Webhook & Khóa bảo mật</h2>
            <p className="text-xs text-slate-500 mt-0.5">Địa chỉ endpoint nhận thông báo biến động số dư từ SePay.</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Webhook URL Endpoint</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={config?.webhook_url || 'Chưa xác định URL'}
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(config?.webhook_url || '', 'Webhook URL')}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Sao chép
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50 px-3">
              <PropertyRow
                label="API Token (Bearer)"
                value={formatSecretDisplay(config?.api_token_masked || config?.api_token)}
                mono
              />
              <PropertyRow
                label="Webhook Secret (Chữ ký xác thực)"
                value={formatSecretDisplay(config?.webhook_secret_masked || config?.webhook_secret)}
                mono
              />
              <PropertyRow
                label="Trạng thái cấu hình"
                value={config?.is_configured ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
              />
            </div>
          </div>
        </section>

        {/* Right: Bank Account Configuration Form */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">Tài khoản ngân hàng thụ hưởng</h2>
            <p className="text-xs text-slate-500 mt-0.5">Thông tin tài khoản nhận tiền tạo mã QR thanh toán động.</p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Ngân hàng (Short name)</label>
                <input
                  value={configForm.bank_short_name}
                  onChange={(e) => setConfigForm({ ...configForm, bank_short_name: e.target.value })}
                  placeholder="MBBank, VCB, ACB..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Số tài khoản</label>
                <input
                  value={configForm.bank_account_number}
                  onChange={(e) => setConfigForm({ ...configForm, bank_account_number: e.target.value })}
                  placeholder="0123456789"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Chủ tài khoản (Tên người/tổ chức)</label>
              <input
                value={configForm.bank_account_holder_name}
                onChange={(e) => setConfigForm({ ...configForm, bank_account_holder_name: e.target.value })}
                placeholder="NGUYEN VAN A / CONG TY TNHH MYCODER"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 uppercase focus:border-indigo-600 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Mã tài khoản SePay (Bank Account ID)</label>
              <input
                value={configForm.bank_account_id}
                onChange={(e) => setConfigForm({ ...configForm, bank_account_id: e.target.value })}
                placeholder="ID ngân hàng trên dashboard SePay"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-8 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu tài khoản ngân hàng'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Recent Orders Section */}
      <section className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Đơn nạp tiền qua cổng SePay gần đây</h2>
            <p className="text-xs text-slate-500 mt-0.5">Danh sách các yêu cầu nạp tiền và trạng thái khớp lệnh thanh toán.</p>
          </div>
          <select
            value={recentLimit}
            onChange={(e) => {
              setRecentLimit(e.target.value)
              loadDiagnostics(e.target.value)
            }}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
          >
            <option value="10">10 đơn mới nhất</option>
            <option value="20">20 đơn mới nhất</option>
            <option value="50">50 đơn mới nhất</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Mã đơn hàng</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4 text-right">Số tiền nạp</th>
                <th className="py-3 px-4">Ngân hàng</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((order) => {
                const user = order.user_id || {}
                const statusInfo = orderStatusMap[order.status] || { label: order.status, tone: 'bg-slate-100 text-slate-600' }
                return (
                  <tr key={order._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {order.code || order.order_code || order._id?.slice(-8).toUpperCase()}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 truncate max-w-xs">{user.fullName || user.username || 'Khách hàng'}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email || '—'}</p>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {formatMoney(order.amount)}
                    </td>

                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {order.bank_short_name || 'MBBank'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${statusInfo.tone}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusInfo.label}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(order.created_at)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(order)
                          setDrawerOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!recentOrders.length ? (
            <div className="py-12 text-center text-xs font-medium text-slate-400">
              {loading ? 'Đang tải danh sách đơn nạp tiền...' : 'Chưa có đơn nạp tiền nào qua cổng SePay.'}
            </div>
          ) : null}
        </div>
      </section>

      {/* Order Detail Drawer */}
      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Chi tiết đơn nạp tiền SePay"
        subtitle={selectedOrder?.code || selectedOrder?.order_code}
      >
        {selectedOrder ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Số tiền nạp</p>
                <p className="text-2xl font-bold font-mono text-emerald-600 mt-0.5">
                  +{formatMoney(selectedOrder.amount)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
                (orderStatusMap[selectedOrder.status] || {}).tone
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {(orderStatusMap[selectedOrder.status] || {}).label || selectedOrder.status}
              </span>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Thông tin đơn hàng & Khớp lệnh
              </h4>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50 px-3">
                <PropertyRow label="Mã đơn hàng" value={selectedOrder.code || selectedOrder.order_code} mono />
                <PropertyRow label="Mã khách hàng" value={selectedOrder.user_id?._id || selectedOrder.user_id} mono />
                <PropertyRow label="Tên khách hàng" value={selectedOrder.user_id?.fullName || selectedOrder.user_id?.email} />
                <PropertyRow label="Cú pháp chuyển khoản" value={selectedOrder.payment_code || selectedOrder.content} mono />
                <PropertyRow label="Ngân hàng thụ hưởng" value={selectedOrder.bank_short_name} />
                <PropertyRow label="Số tài khoản thụ hưởng" value={selectedOrder.bank_account_number} mono />
                <PropertyRow label="Thời gian tạo đơn" value={formatDateTime(selectedOrder.created_at)} mono />
                <PropertyRow label="Thời gian thanh toán" value={formatDateTime(selectedOrder.paid_at || selectedOrder.updated_at)} mono />
              </div>
            </div>
          </div>
        ) : null}
      </AdminDrawer>

      {/* Secret Rotation Modal */}
      <AdminModal
        open={secretOpen}
        onClose={() => setSecretOpen(false)}
        title="Cập nhật Secret & API Token SePay"
        subtitle="Cấu hình các khóa bí mật để xác thực webhook và gọi API đối soát SePay."
      >
        <form onSubmit={handleRotateSecrets} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">SePay API Token</label>
            <input
              type="password"
              value={secretForm.api_token}
              onChange={(e) => setSecretForm({ ...secretForm, api_token: e.target.value })}
              placeholder="Để trống nếu không thay đổi"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">SePay Webhook Secret (API Key Webhook)</label>
            <input
              type="password"
              value={secretForm.webhook_secret}
              onChange={(e) => setSecretForm({ ...secretForm, webhook_secret: e.target.value })}
              placeholder="Để trống nếu không thay đổi"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSecretOpen(false)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={rotating}
              className="h-8 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            >
              {rotating ? 'Đang cập nhật...' : 'Lưu khóa bảo mật'}
            </button>
          </div>
        </form>
      </AdminModal>
    </AdminLayout>
  )
}
