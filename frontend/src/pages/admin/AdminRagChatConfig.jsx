import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout.jsx'
import AdminModal from '../../components/admin/AdminModal.jsx'
import Toast from '../../components/Toast.jsx'
import {
  getAdminRagChatConfig,
  getAdminRagChatHealth,
  rotateAdminRagChatSecrets,
  testAdminRagChatConnection,
  updateAdminRagChatConfig,
} from '../../api/adminService.js'

const ragLimitHelp = {
  job_search_top_k: 'Số lượng tin tuyển dụng truy xuất khi ứng viên hỏi tìm việc hoặc gợi ý việc làm.',
  job_explanation_top_k: 'Số ngữ cảnh dùng khi AI giải thích, so sánh chi tiết các công việc tìm được.',
  cv_review_top_k: 'Số đoạn văn bản CV được đối soát từ vector index để đánh giá sự phù hợp.',
  answer_context_limit: 'Giới hạn số đoạn văn bản đưa vào prompt cuối cùng để tạo câu trả lời.',
}

const defaultModelsByProvider = {
  openai: {
    intent_model: 'gpt-4o-mini',
    chat_model: 'gpt-4o-mini',
  },
  gemini: {
    intent_model: 'gemini-1.5-flash',
    chat_model: 'gemini-1.5-flash',
  },
}

const textModelOptions = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (Nhanh & Tối ưu chi phí)' },
    { value: 'gpt-4o', label: 'GPT-4o (Thông minh & Toàn diện)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
}

const visionModelOptions = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
]

const secretProviderOptions = [
  { value: 'openai', label: 'OpenAI', field: 'openai_api_key', preview: 'openai_api_key_preview' },
  { value: 'gemini', label: 'Gemini', field: 'gemini_api_key', preview: 'gemini_api_key_preview' },
]

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

export default function AdminRagChatConfig() {
  const [config, setConfig] = useState(null)
  const [secrets, setSecrets] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [secretOpen, setSecretOpen] = useState(false)
  const [selectedSecretProvider, setSelectedSecretProvider] = useState('openai')

  const [configForm, setConfigForm] = useState({
    enabled: true,
    provider: 'openai',
    intent_model: '',
    chat_model: '',
    cv_visual_review_model: '',
    job_search_top_k: 5,
    job_explanation_top_k: 5,
    cv_review_top_k: 6,
    answer_context_limit: 3,
    allow_cv_review: true,
    allow_job_qa: true,
    allow_policy_qa: false,
    allow_general_qa: false,
    maintenance_message: '',
  })
  const [secretForm, setSecretForm] = useState({ openai_api_key: '', gemini_api_key: '' })
  const selectedSecretOption = secretProviderOptions.find((opt) => opt.value === selectedSecretProvider) || secretProviderOptions[0]

  const syncForm = useCallback((nextConfig) => {
    const provider = nextConfig?.provider || 'openai'
    const defaults = defaultModelsByProvider[provider] || defaultModelsByProvider.openai

    setConfigForm({
      enabled: Boolean(nextConfig?.enabled),
      provider,
      intent_model: nextConfig?.intent_model || defaults.intent_model,
      chat_model: nextConfig?.chat_model || defaults.chat_model,
      cv_visual_review_model: nextConfig?.cv_visual_review_model || 'gpt-4o-mini',
      job_search_top_k: nextConfig?.job_search_top_k ?? 5,
      job_explanation_top_k: nextConfig?.job_explanation_top_k ?? 5,
      cv_review_top_k: nextConfig?.cv_review_top_k ?? 6,
      answer_context_limit: nextConfig?.answer_context_limit ?? 3,
      allow_cv_review: Boolean(nextConfig?.allow_cv_review),
      allow_job_qa: nextConfig?.allow_job_qa ?? true,
      allow_policy_qa: Boolean(nextConfig?.allow_policy_qa),
      allow_general_qa: Boolean(nextConfig?.allow_general_qa),
      maintenance_message: nextConfig?.maintenance_message || '',
    })
  }, [])

  const handleProviderChange = (newProvider) => {
    const defaults = defaultModelsByProvider[newProvider] || defaultModelsByProvider.openai
    setConfigForm((prev) => ({
      ...prev,
      provider: newProvider,
      intent_model: defaults.intent_model,
      chat_model: defaults.chat_model,
    }))
  }

  const loadConfig = useCallback(async () => {
    const data = await getAdminRagChatConfig()
    setConfig(data?.config || null)
    setSecrets(data?.secrets || null)
    syncForm(data?.config || {})
  }, [syncForm])

  const loadHealth = useCallback(async () => {
    const data = await getAdminRagChatHealth()
    setHealth(data)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([loadConfig(), loadHealth()])
      .catch((error) => {
        if (active) setToast({ type: 'error', message: error.message || 'Không thể tải cấu hình RAG Chat.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [loadConfig, loadHealth])

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateAdminRagChatConfig(configForm)
      setConfig(updated)
      syncForm(updated)
      setToast({ type: 'success', message: 'Đã lưu cấu hình trợ lý AI RAG thành công.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật cấu hình RAG.' })
    } finally {
      setSaving(false)
    }
  }

  const handleRotateSecret = async (e) => {
    e.preventDefault()
    const key = selectedSecretOption.field
    const val = secretForm[key]?.trim()
    if (!val) {
      setToast({ type: 'error', message: 'Vui lòng nhập API key mới.' })
      return
    }

    setRotating(true)
    try {
      await rotateAdminRagChatSecrets({ [key]: val })
      setToast({ type: 'success', message: `Đã cập nhật API Key ${selectedSecretOption.label} thành công.` })
      setSecretForm({ ...secretForm, [key]: '' })
      setSecretOpen(false)
      loadConfig()
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật API key.' })
    } finally {
      setRotating(false)
    }
  }

  const handleTestConnection = async (targetProvider = configForm.provider) => {
    setTesting(true)
    try {
      const res = await testAdminRagChatConnection({ provider: targetProvider })
      const resultData = res?.data || res
      setTestResult(resultData)
      setTestModalOpen(true)
      await loadHealth()
      if (resultData?.connected) {
        setToast({ type: 'success', message: `Kết nối thành công tới ${targetProvider.toUpperCase()} (${resultData.latency_ms}ms).` })
      } else {
        setToast({ type: 'error', message: `Kết nối thất bại: ${resultData?.message || 'Lỗi không xác định'}` })
      }
    } catch (error) {
      const errData = {
        connected: false,
        provider: targetProvider,
        message: error.message || 'Lỗi kết nối máy chủ',
        latency_ms: 0,
        checked_at: new Date(),
      }
      setTestResult(errData)
      setTestModalOpen(true)
      setToast({ type: 'error', message: error.message || 'Kiểm tra kết nối thất bại.' })
    } finally {
      setTesting(false)
    }
  }

  const currentTextModels = textModelOptions[configForm.provider] || textModelOptions.openai

  return (
    <AdminLayout
      title="Cấu hình Trợ lý AI & RAG Chat"
      subtitle="Thiết lập mô hình ngôn ngữ lớn (LLM), tham số tìm kiếm Vector Top-K và quản lý API Key."
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={testing}
            onClick={() => handleTestConnection(configForm.provider)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">wifi_tethering</span>
            <span>{testing ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối thực tế'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSecretOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20"
          >
            <span className="material-symbols-outlined text-[16px]">key</span>
            <span>Đổi API Key AI</span>
          </button>
        </div>
      }
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Trạng thái AI</p>
          <p className={`mt-2 text-sm font-bold flex items-center gap-1.5 ${
            configForm.enabled ? 'text-emerald-700' : 'text-slate-500'
          }`}>
            <span className={`h-2 w-2 rounded-full ${configForm.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {configForm.enabled ? 'Đang hoạt động' : 'Đang tạm dừng'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Nhà cung cấp chính</p>
          <p className="mt-2 text-sm font-bold uppercase tracking-wider text-slate-900 font-mono">
            {configForm.provider}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Chat Model</p>
          <p className="mt-2 text-xs font-semibold text-indigo-700 truncate font-mono">
            {configForm.chat_model || 'gpt-4o-mini'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-medium text-slate-500">Kết nối Vector DB</p>
          <p className={`mt-2 text-sm font-bold flex items-center gap-1.5 ${
            health?.vector_db_connected ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            <span className={`h-2 w-2 rounded-full ${health?.vector_db_connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {health?.vector_db_connected ? 'Sẵn sàng' : 'Chưa kết nối (Dự phòng)'}
          </p>
        </div>
      </section>

      {/* Form Settings */}
      <form onSubmit={handleSaveConfig} className="space-y-5">
        {/* Model Selection Card */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">1. Lựa chọn Mô hình LLM & Nhà cung cấp</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chọn engine xử lý ngôn ngữ tự nhiên và phân tích thị giác CV.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nhà cung cấp (LLM Provider)</label>
              <select
                value={configForm.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition font-semibold"
              >
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Mô hình hội thoại (Chat Model)</label>
              <select
                value={configForm.chat_model}
                onChange={(e) => setConfigForm({ ...configForm, chat_model: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
              >
                {currentTextModels.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Mô hình thị giác (Vision CV Model)</label>
              <select
                value={configForm.cv_visual_review_model}
                onChange={(e) => setConfigForm({ ...configForm, cv_visual_review_model: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition"
              >
                {visionModelOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Vector Search Parameters */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">2. Tham số tìm kiếm RAG & Vector Top-K</h2>
            <p className="text-xs text-slate-500 mt-0.5">Điều chỉnh số lượng tài liệu tham chiếu được trích xuất từ cơ sở dữ liệu vector.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1" title={ragLimitHelp.job_search_top_k}>
                Job Search Top-K
              </label>
              <input
                type="number"
                value={configForm.job_search_top_k}
                onChange={(e) => setConfigForm({ ...configForm, job_search_top_k: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-1 text-[11px] text-slate-400">Số job lấy ra khi tìm kiếm</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1" title={ragLimitHelp.job_explanation_top_k}>
                Job Explanation Top-K
              </label>
              <input
                type="number"
                value={configForm.job_explanation_top_k}
                onChange={(e) => setConfigForm({ ...configForm, job_explanation_top_k: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-1 text-[11px] text-slate-400">Số job dùng khi so sánh</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1" title={ragLimitHelp.cv_review_top_k}>
                CV Review Top-K
              </label>
              <input
                type="number"
                value={configForm.cv_review_top_k}
                onChange={(e) => setConfigForm({ ...configForm, cv_review_top_k: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-1 text-[11px] text-slate-400">Số đoạn CV đối soát</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1" title={ragLimitHelp.answer_context_limit}>
                Context Limit
              </label>
              <input
                type="number"
                value={configForm.answer_context_limit}
                onChange={(e) => setConfigForm({ ...configForm, answer_context_limit: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 font-mono focus:border-indigo-600 focus:outline-none transition"
              />
              <p className="mt-1 text-[11px] text-slate-400">Giới hạn prompt context</p>
            </div>
          </div>
        </section>

        {/* Feature Toggles & Maintenance */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">3. Phân quyền tính năng & Bảo trì</h2>
            <p className="text-xs text-slate-500 mt-0.5">Bật tắt các module AI cho ứng viên và người dùng.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={configForm.enabled}
                onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-800">Kích hoạt AI Chat</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={configForm.allow_cv_review}
                onChange={(e) => setConfigForm({ ...configForm, allow_cv_review: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-800">Đánh giá CV tự động</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={configForm.allow_job_qa}
                onChange={(e) => setConfigForm({ ...configForm, allow_job_qa: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-800">Hỏi đáp tin việc làm</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={configForm.allow_general_qa}
                onChange={(e) => setConfigForm({ ...configForm, allow_general_qa: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-800">Trò chuyện mở rộng</span>
            </label>
          </div>

          {/* Maintenance Message Field */}
          <div className="pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <span>Thông điệp bảo trì khi tắt Chatbot</span>
                {!configForm.enabled && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                    Đang kích hoạt do bot tắt
                  </span>
                )}
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {(configForm.maintenance_message || '').length}/500 ký tự
              </span>
            </div>
            <textarea
              rows={2}
              maxLength={500}
              value={configForm.maintenance_message || ''}
              onChange={(e) => setConfigForm({ ...configForm, maintenance_message: e.target.value })}
              placeholder="Ví dụ: Trợ lý AI đang tạm dừng để nâng cấp hệ thống định kỳ. Quý khách vui lòng thử lại sau ít phút..."
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:outline-none transition leading-relaxed resize-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Câu thông báo này sẽ được gửi cho người dùng khi nhắn tin trong lúc Trợ lý AI đang tắt. Nếu để trống, hệ thống sẽ sử dụng câu mặc định: <span className="text-slate-600 italic">"Chatbot đang tạm bảo trì. Vui lòng thử lại sau."</span>
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg bg-indigo-600 px-5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? 'Đang lưu cấu hình...' : 'Lưu toàn bộ cấu hình AI'}
            </button>
          </div>
        </section>
      </form>

      {/* System Technical Specifications */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">4. Thông số kỹ thuật & Môi trường chạy</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chi tiết cấu hình hạ tầng Vector Search, Embedding và nguồn bảo mật khóa API.</p>
          </div>
          <button
            type="button"
            onClick={loadHealth}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            Làm mới thông số
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Chỉ mục tìm việc (Jobs Search Index)</span>
            <span className="font-mono font-medium text-slate-800">{health?.public_jobs_search_index || 'public_jobs'}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Chỉ mục Vector CV (Resume Search Index)</span>
            <span className="font-mono font-medium text-slate-800">{health?.resume_search_index || 'resume_chunks'}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Embedding API Endpoint</span>
            <span className="font-mono font-medium text-slate-800 truncate max-w-[260px]" title={health?.embedding_api_url}>
              {health?.embedding_api_url || 'Mặc định (HuggingFace)'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Chuẩn mã hóa Secrets</span>
            <span className="font-mono font-medium text-emerald-700 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              AES-256-GCM
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Khóa API OpenAI</span>
            <span className="font-medium">
              {health?.openai_api_key_configured ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {health?.openai_api_key_source === 'database' ? 'Lưu trữ DB bảo mật' : 'Biến môi trường (.env)'}
                </span>
              ) : (
                <span className="text-slate-400">Chưa thiết lập</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Khóa API Google Gemini</span>
            <span className="font-medium">
              {health?.gemini_api_key_configured ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {health?.gemini_api_key_source === 'database' ? 'Lưu trữ DB bảo mật' : 'Biến môi trường (.env)'}
                </span>
              ) : (
                <span className="text-slate-400">Chưa thiết lập</span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Real Connection Test Result Modal (Center Modal) */}
      <AdminModal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Kết quả kiểm tra kết nối AI Gateway"
        subtitle="Thông tin phản hồi thực tế từ API nhà cung cấp mô hình ngôn ngữ."
      >
        <div className="space-y-4 text-xs">
          {testResult && (
            <div className={`rounded-xl border p-4 ${
              testResult.connected
                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                : 'border-rose-200 bg-rose-50/50 text-rose-900'
            }`}>
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined text-[24px] shrink-0 ${
                  testResult.connected ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {testResult.connected ? 'check_circle' : 'error'}
                </span>
                <div className="space-y-1 flex-1">
                  <p className="font-bold text-sm">
                    {testResult.connected ? 'Kết nối thành công!' : 'Kết nối thất bại'}
                  </p>
                  <p className="text-xs leading-relaxed opacity-90">
                    {testResult.connected
                      ? `Hệ thống đã gửi lời gọi kiểm tra và nhận được phản hồi hợp lệ từ nhà cung cấp ${testResult.provider?.toUpperCase()}.`
                      : testResult.message || 'Không thể liên lạc với máy chủ nhà cung cấp AI.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Nhà cung cấp kiểm tra</span>
              <span className="font-mono font-bold uppercase text-slate-800">{testResult?.provider || configForm.provider}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Mô hình thử nghiệm</span>
              <span className="font-mono font-semibold text-indigo-700">{testResult?.model || configForm.chat_model}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Độ trễ phản hồi (Latency)</span>
              <span className="font-mono font-bold">
                {testResult?.latency_ms !== undefined ? (
                  <span className={
                    testResult.latency_ms < 1500
                      ? 'text-emerald-700'
                      : testResult.latency_ms < 3500
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }>
                    {testResult.latency_ms} ms
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>

            {testResult?.response_sample && (
              <div className="pt-1">
                <span className="text-slate-500 font-medium block mb-1">Mẫu phản hồi:</span>
                <div className="rounded-lg bg-white border border-slate-200 p-2 font-mono text-[11px] text-slate-700 break-all">
                  {testResult.response_sample}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-1 text-slate-400 text-[11px]">
              <span>Thời điểm kiểm tra</span>
              <span>
                {testResult?.checked_at
                  ? new Date(testResult.checked_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Vừa xong'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={testing}
                onClick={() => handleTestConnection('openai')}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Thử OpenAI
              </button>
              <button
                type="button"
                disabled={testing}
                onClick={() => handleTestConnection('gemini')}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Thử Gemini
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="h-8 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </AdminModal>

      {/* API Key Rotation Modal */}
      <AdminModal
        open={secretOpen}
        onClose={() => setSecretOpen(false)}
        title="Cập nhật API Key Nhà cung cấp AI"
        subtitle="Cung cấp API Key từ OpenAI Platform hoặc Google AI Studio."
      >
        <form onSubmit={handleRotateSecret} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Chọn nhà cung cấp</label>
            <select
              value={selectedSecretProvider}
              onChange={(e) => setSelectedSecretProvider(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none transition font-semibold"
            >
              <option value="openai">OpenAI (sk-...)</option>
              <option value="gemini">Google Gemini (AIza...)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              API Key mới cho {selectedSecretOption.label} <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={secretForm[selectedSecretOption.field] || ''}
              onChange={(e) => setSecretForm({ ...secretForm, [selectedSecretOption.field]: e.target.value })}
              placeholder={`Nhập API key ${selectedSecretOption.label}...`}
              required
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
              {rotating ? 'Đang cập nhật...' : 'Lưu API Key'}
            </button>
          </div>
        </form>
      </AdminModal>
    </AdminLayout>
  )
}
