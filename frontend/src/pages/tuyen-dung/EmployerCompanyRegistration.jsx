import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import DashboardSidebar from '../../components/DashboardSidebar.jsx'
import EmployerTopBar from '../../components/EmployerTopBar.jsx'
import Toast from '../../components/Toast.jsx'
import { createCompanyProfile, loadEmployerDashboardOverview } from '../../data/apiClient.js'

const initialCompanyForm = {
  company_name: '',
  address: '',
  website: '',
  logo: '',
  description: '',
}

export default function EmployerCompanyRegistration() {
  const navigate = useNavigate()
  const location = useLocation()
  const [companyForm, setCompanyForm] = useState(initialCompanyForm)
  const [isChecking, setIsChecking] = useState(true)
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(location.state?.toast ?? null)

  useEffect(() => {
    let mounted = true

    loadEmployerDashboardOverview({ force: true })
      .then((data) => {
        if (!mounted) return
        if (!data?.needsCompanyProfile) {
          navigate('/employer-dashboard', { replace: true })
          return
        }
      })
      .catch(() => {
        // Let user continue with the form if the pre-check fails.
      })
      .finally(() => {
        if (mounted) setIsChecking(false)
      })

    return () => {
      mounted = false
    }
  }, [navigate])

  useEffect(() => {
    if (!location.state?.toast) return

    const { toast: _toast, ...nextState } = location.state
    navigate(location.pathname, {
      replace: true,
      state: Object.keys(nextState).length ? nextState : null,
    })
  }, [location.pathname, location.state, navigate])

  const handleCompanyFormChange = (event) => {
    const { name, value } = event.target
    setCompanyForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreateCompany = async (event) => {
    event.preventDefault()
    setIsSubmittingCompany(true)
    setError('')

    try {
      await createCompanyProfile(companyForm)
      navigate('/employer-dashboard', {
        replace: true,
        state: {
          toast: {
            type: 'success',
            message: 'Đã gửi hồ sơ công ty. Vui lòng chờ admin xác minh.',
          },
        },
      })
    } catch (submitError) {
      const message = submitError.message || 'Không thể gửi hồ sơ công ty.'
      setError(message)
      setToast({ type: 'error', message })
    } finally {
      setIsSubmittingCompany(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-on-surface">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <DashboardSidebar activeKey="employer-dashboard" />

      <main className="min-h-screen bg-[#F9FAFB] lg:ml-64">
        <EmployerTopBar />
        <div className="px-4 py-5 lg:px-6 lg:py-7">
        <header className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-blue-600">Thiết lập nhà tuyển dụng</p>
          <h1 className="mt-1 text-[30px] font-extrabold tracking-tight text-slate-900">Đăng ký hồ sơ công ty</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Bạn cần tạo hồ sơ công ty trước khi sử dụng các chức năng nhà tuyển dụng. Sau khi gửi hồ sơ, hệ thống sẽ chuyển bạn về dashboard để tiếp tục theo dõi trạng thái xác minh.
          </p>
        </header>

        {isChecking ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
            Đang kiểm tra hồ sơ công ty...
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {error && (
              <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <span className="material-symbols-outlined text-[24px]">domain_add</span>
                </div>
                <h2 className="mt-4 text-[26px] font-extrabold tracking-tight text-slate-900">Tạo hồ sơ công ty</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Điền đầy đủ thông tin công ty để bắt đầu tuyển dụng. Dữ liệu này sẽ giúp admin xác minh và giúp ứng viên tin tưởng hơn khi xem tin đăng của bạn.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    { icon: 'edit_note', title: 'Nhập thông tin', text: 'Điền tên, địa chỉ, website và mô tả công ty.' },
                    { icon: 'admin_panel_settings', title: 'Chờ admin duyệt', text: 'Hồ sơ được gửi vào hàng chờ xác minh.' },
                    { icon: 'campaign', title: 'Bắt đầu tuyển', text: 'Sau khi xác minh, bạn có thể đăng job và nhận ứng viên.' },
                  ].map((item) => (
                    <article key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="material-symbols-outlined text-[22px] text-blue-600">{item.icon}</span>
                      <p className="mt-2 text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateCompany} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Tên công ty <span className="text-rose-500">*</span></span>
                    <input
                      name="company_name"
                      value={companyForm.company_name}
                      onChange={handleCompanyFormChange}
                      required
                      minLength={2}
                      maxLength={100}
                      disabled={isSubmittingCompany}
                      placeholder="Ví dụ: MYCODER Studio"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Địa chỉ <span className="text-rose-500">*</span></span>
                    <input
                      name="address"
                      value={companyForm.address}
                      onChange={handleCompanyFormChange}
                      required
                      minLength={2}
                      maxLength={100}
                      disabled={isSubmittingCompany}
                      placeholder="Ví dụ: Cầu Giấy, Hà Nội"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">Website</span>
                      <input
                        name="website"
                        value={companyForm.website}
                        onChange={handleCompanyFormChange}
                        type="url"
                        disabled={isSubmittingCompany}
                        placeholder="https://company.vn"
                        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">Logo URL</span>
                      <input
                        name="logo"
                        value={companyForm.logo}
                        onChange={handleCompanyFormChange}
                        type="url"
                        disabled={isSubmittingCompany}
                        placeholder="https://.../logo.png"
                        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Mô tả công ty</span>
                    <textarea
                      name="description"
                      value={companyForm.description}
                      onChange={handleCompanyFormChange}
                      maxLength={500}
                      rows={5}
                      disabled={isSubmittingCompany}
                      placeholder="Giới thiệu ngắn về lĩnh vực, quy mô, văn hóa hoặc sản phẩm của công ty."
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <span className="mt-1 block text-right text-xs font-medium text-slate-400">{companyForm.description.length}/500</span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={isSubmittingCompany}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[18px]">{isSubmittingCompany ? 'sync' : 'send'}</span>
                      {isSubmittingCompany ? 'Đang gửi hồ sơ...' : 'Gửi hồ sơ công ty'}
                    </button>
                    <Link
                      to="/"
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Về trang chủ
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </section>
        )}
        </div>
      </main>
    </div>
  )
}
