import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminLogin } from '../../api/adminService.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const redirectPath = new URLSearchParams(location.search).get('redirect')
  const nextPath = redirectPath?.startsWith('/admin/') && redirectPath !== '/admin/login' ? redirectPath : '/admin/dashboard'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminLogin({ email, password })
      navigate(nextPath, { replace: true })
    } catch (submitError) {
      setError(submitError.message || 'Không thể đăng nhập tài khoản quản trị.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d16] px-4 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0f1422] p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-extrabold shadow-sm shadow-indigo-500/30">
            <span className="text-lg">MC</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">MyCoder</span>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/30">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Hệ thống quản trị trung tâm</p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800/80 pt-6">
          <h1 className="text-xl font-bold tracking-tight text-white">Đăng nhập Quản trị</h1>
          <p className="mt-1 text-xs text-slate-400">Nhập thông tin tài khoản để truy cập bảng điều khiển.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Địa chỉ Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="admin@mycoder.vn"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-medium">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 transition disabled:opacity-50"
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
          </button>
        </form>
      </div>
    </div>
  )
}

