import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { forgotPassword, login, register, resetPassword } from '../api/authService.js'
import Toast from '../components/Toast.jsx'
import useCurrentUser from '../hooks/useCurrentUser.js'

const authContent = {
  login: {
    label: 'Đăng nhập',
    heading: 'Trang đăng nhập',
    description:
      'Đăng nhập để tìm kiếm việc làm, lưu cơ hội phù hợp, gửi hồ sơ và theo dõi quá trình ứng tuyển.',
    submit: 'Đăng nhập',
    helper: 'Chưa có tài khoản?',
    helperCta: 'Đăng ký ngay',
    helperTo: '/register',
    secondary: 'Quên mật khẩu?',
    secondaryCta: 'Khôi phục tài khoản',
    secondaryTo: '/forgot-password',
  },
  register: {
    label: 'Đăng ký',
    heading: 'Trang đăng ký tài khoản',
    description:
      'Tạo tài khoản để xây dựng hồ sơ chuyên nghiệp, nhận đề xuất job phù hợp và sẵn sàng cho những dự án mới.',
    submit: 'Tạo tài khoản',
    helper: 'Đã có tài khoản?',
    helperCta: 'Đăng nhập',
    helperTo: '/login',
    secondary: 'Cần khôi phục email?',
    secondaryCta: 'Quên mật khẩu',
    secondaryTo: '/forgot-password',
  },
  forgot: {
    label: 'Khôi phục',
    heading: 'Khôi phục mật khẩu',
    description:
      'Nhập email để nhận liên kết đặt lại mật khẩu. Chúng tôi gửi hướng dẫn ngắn gọn và an toàn tới hộp thư của bạn.',
    submit: 'Gửi liên kết',
    helper: 'Đã nhớ mật khẩu?',
    helperCta: 'Quay lại đăng nhập',
    helperTo: '/login',
    secondary: 'Chưa có tài khoản?',
    secondaryCta: 'Tạo tài khoản',
    secondaryTo: '/register',
  },
  reset: {
    label: 'Mật khẩu mới',
    heading: 'Đặt lại mật khẩu',
    description:
      'Nhập mật khẩu mới để hoàn tất quá trình khôi phục. Hãy chọn mật khẩu đủ mạnh và dễ quản lý.',
    submit: 'Cập nhật mật khẩu',
    helper: 'Đã đổi mật khẩu?',
    helperCta: 'Quay lại đăng nhập',
    helperTo: '/login',
    secondary: 'Cần gửi lại email khôi phục?',
    secondaryCta: 'Quay lại bước trước',
    secondaryTo: '/forgot-password',
  },
}

const trustStats = [
  { value: 32000, label: 'Ứng viên công nghệ' },
  { value: 1200, label: 'Việc làm mới mỗi tuần' },
]

function AnimatedBrand() {
  const brand = 'MYCODER'
  const [typedBrand, setTypedBrand] = useState('')

  useEffect(() => {
    let index = 0
    let isDeleting = false
    let timer

    const type = () => {
      if (isDeleting) {
        index = Math.max(0, index - 1)
      } else {
        index = Math.min(brand.length, index + 1)
      }

      setTypedBrand(brand.slice(0, index))

      if (!isDeleting && index === brand.length) {
        isDeleting = true
        timer = window.setTimeout(type, 2600)
        return
      }

      if (isDeleting && index === 0) {
        isDeleting = false
        timer = window.setTimeout(type, 850)
        return
      }

      timer = window.setTimeout(type, isDeleting ? 60 : 125)
    }

    timer = window.setTimeout(type, 300)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <span className="auth-brand-typewriter" aria-label={brand}>
      {typedBrand || '\u00a0'}
    </span>
  )
}

function AnimatedCounter({ value }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const duration = 1500
    let animationFrame
    let replayTimer

    const animate = () => {
      const startedAt = performance.now()

      const update = (timestamp) => {
        const progress = Math.min((timestamp - startedAt) / duration, 1)
        const easedProgress = 1 - (1 - progress) ** 3
        setCount(Math.round(value * easedProgress))
        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(update)
        } else {
          replayTimer = window.setTimeout(() => {
            setCount(0)
            animate()
          }, 6500)
        }
      }

      animationFrame = window.requestAnimationFrame(update)
    }

    animate()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(replayTimer)
    }
  }, [value])

  return <>{count.toLocaleString('vi-VN')}+</>
}

function PasswordInput({ name, placeholder }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="relative block">
      <input
        className="auth-input auth-input-compact pr-11"
        name={name}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-sky-700"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        <span className="material-symbols-outlined text-[20px]">{visible ? 'visibility_off' : 'visibility'}</span>
      </button>
    </label>
  )
}

function AuthPortal({ mode }) {
  const content = authContent[mode]
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshSession } = useCurrentUser()
  const [searchParams] = useSearchParams()
  const [toast, setToast] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const forgotPasswordToken = searchParams.get('forgot_password_token') || ''

  const showError = (message) => {
    setToast({ type: 'error', message })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')
    const fullName = String(formData.get('fullName') || '').trim()
    const newPassword = String(formData.get('newPassword') || '')
    const confirmNewPassword = String(formData.get('confirmNewPassword') || '')
    const remember = formData.get('remember') === 'on'

    if (isRegister && !fullName) {
      showError('Vui lòng nhập họ tên.')
      return
    }

    if (isRegister && fullName.length < 2) {
      showError('Họ tên phải có ít nhất 2 ký tự.')
      return
    }

    if (!isReset && !email) {
      showError('Vui lòng nhập email.')
      return
    }

    if (!isReset && !/^\S+@\S+\.\S+$/.test(email)) {
      showError('Email không hợp lệ.')
      return
    }

    if ((isLogin || isRegister) && !password) {
      showError('Vui lòng nhập mật khẩu.')
      return
    }

    if ((isLogin || isRegister) && password.length < 8) {
      showError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }

    if ((isLogin || isRegister) && password.length > 50) {
      showError('Mật khẩu không được vượt quá 50 ký tự.')
      return
    }

    if (isRegister && !confirmPassword) {
      showError('Vui lòng xác nhận mật khẩu.')
      return
    }

    if (isRegister && password !== confirmPassword) {
      showError('Mật khẩu xác nhận không khớp.')
      return
    }

    if (isReset && !newPassword) {
      showError('Vui lòng nhập mật khẩu mới.')
      return
    }

    if (isReset && newPassword.length < 8) {
      showError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }

    if (isReset && newPassword.length > 50) {
      showError('Mật khẩu mới không được vượt quá 50 ký tự.')
      return
    }

    if (isReset && !confirmNewPassword) {
      showError('Vui lòng xác nhận mật khẩu mới.')
      return
    }

    if (isReset && newPassword !== confirmNewPassword) {
      showError('Mật khẩu xác nhận không khớp.')
      return
    }

    if (isReset && !forgotPasswordToken) {
      showError('Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu token.')
      return
    }

    setIsSubmitting(true)
    try {
      let result

      if (isForgot) {
        result = await forgotPassword({ email })
      } else if (isReset) {
        result = await resetPassword({
          password: newPassword,
          confirmPassword: confirmNewPassword,
          forgotPasswordToken,
        })
      } else if (isRegister) {
        result = await register({ fullName, email, password, confirmPassword }, { remember })
      } else {
        result = await login({ email, password }, { remember })
      }

      setToast({ type: 'success', message: result.message })

      if (isReset) {
        setTimeout(() => navigate('/login', { replace: true }), 700)
        return
      }

      if (!isForgot) {
        await refreshSession({ force: true })
        const stateFrom = location.state?.from
        const defaultRedirect = '/'
        const redirectTo = searchParams.get('redirect') || (stateFrom ? `${stateFrom.pathname || ''}${stateFrom.search || ''}` : defaultRedirect) || defaultRedirect
        setTimeout(() => navigate(redirectTo, { replace: true }), 450)
      }
    } catch (error) {
      const fallbackMessage = isForgot
        ? 'Không thể gửi email đặt lại mật khẩu.'
        : isReset
          ? 'Không thể đặt lại mật khẩu.'
          : isRegister
            ? 'Đăng ký thất bại.'
            : 'Đăng nhập thất bại.'
      showError(error.message || fallbackMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(135deg,#eef8ff_0%,#f7fbff_40%,#eef5ff_100%)] text-slate-900">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="relative mx-auto min-h-screen max-w-[1440px] px-5 py-6 md:px-8">
        <div className="pointer-events-none absolute right-[-180px] top-[-120px] h-[420px] w-[420px] rotate-[18deg] rounded-[48px] border border-sky-300/40 bg-sky-400/18" />
        <div className="auth-shape-primary pointer-events-none absolute right-[8%] top-[6%] h-[540px] w-[420px] rotate-[22deg] rounded-[56px] bg-[linear-gradient(180deg,rgba(14,165,233,0.95),rgba(37,99,235,0.92))]" />
        <div className="pointer-events-none absolute right-[16%] top-[14%] h-[520px] w-[360px] rotate-[22deg] rounded-[48px] border border-white/30 bg-sky-200/12" />
        <div className="pointer-events-none absolute right-[5%] top-[18%] h-[420px] w-[280px] rotate-[22deg] rounded-[40px] border border-white/25 bg-white/8" />

        <header className="relative z-10 hidden items-center lg:flex">
          <Link to="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-[#2b59ff]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              code
            </span>
            MYCODER
          </Link>
        </header>

        <main className="relative z-10 grid min-h-[calc(100vh-56px)] items-start gap-4 py-4 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-8">
          <section className="order-1 mx-auto w-full max-w-[560px] lg:order-none lg:ml-[10%] lg:mr-0">
            <div className="mb-2 flex items-center gap-3 text-[30px] font-black tracking-tight text-[#2b59ff] lg:mb-5 md:text-[38px]">
              <span className="material-symbols-outlined !text-[38px] md:!text-[46px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                code
              </span>
              <AnimatedBrand />
            </div>
            <h1 className="max-w-[460px] text-[40px] font-black leading-[1.05] tracking-tight text-slate-950 md:text-[56px]">
              {content.heading}
            </h1>
            <p className="mt-4 hidden text-lg font-medium text-sky-700 lg:block">Tìm việc phù hợp. Kết nối đúng cơ hội.</p>
            <p className="mt-8 hidden max-w-[440px] text-[15px] leading-7 text-slate-600 lg:block">{content.description}</p>

            <div className="mt-10 hidden flex-wrap gap-3 lg:flex">
              {trustStats.map((item) => (
                <article
                  key={item.label}
                  className="auth-stat-card border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.55)] backdrop-blur"
                >
                  <p className="text-xl font-black text-slate-950"><AnimatedCounter value={item.value} /></p>
                  <p className="text-sm text-slate-500">{item.label}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 hidden text-[14px] font-medium leading-7 text-slate-600 lg:block">
              <p>Website: mycoder.vn</p>
              <p>Liên hệ: support@mycoder.vn</p>
              <p>Facebook: facebook.com/mycoder.vn</p>
            </div>
          </section>

          <section className="relative order-2 mx-auto w-full max-w-[388px] lg:order-none lg:mx-0 lg:justify-self-end lg:-translate-x-12">
            <div className="auth-panel border border-white/90 bg-white/96 p-5 shadow-[0_35px_70px_-35px_rgba(15,23,42,0.55)] backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">{content.label}</span>
                <span className="auth-pill bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-800 shadow-sm">
                  {location.pathname.replace('/', '') || 'home'}
                </span>
              </div>

              <form className="space-y-3" noValidate onSubmit={handleSubmit}>
                {isRegister && <input className="auth-input auth-input-compact" name="fullName" type="text" placeholder="Họ tên" />}

                {!isReset && <input className="auth-input auth-input-compact" name="email" type="email" placeholder="Email" />}

                {(isLogin || isRegister) && <PasswordInput name="password" placeholder="Mật khẩu" />}

                {isRegister && <PasswordInput name="confirmPassword" placeholder="Xác nhận mật khẩu" />}

                {isReset && (
                  <>
                    <PasswordInput name="newPassword" placeholder="Mật khẩu mới" />
                    <PasswordInput name="confirmNewPassword" placeholder="Xác nhận mật khẩu mới" />
                  </>
                )}

                {isForgot && (
                  <div className="auth-note border border-sky-100 bg-white px-3 py-2 text-xs font-semibold leading-5 text-sky-900 shadow-sm">
                    Chúng tôi sẽ gửi một liên kết đặt lại mật khẩu đến email bạn vừa nhập.
                  </div>
                )}

                {!isForgot && !isReset && (
                  <div className="flex items-center justify-between gap-3 pt-1 text-[12px] text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        name="remember"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                        defaultChecked
                      />
                      <span className="font-semibold">{isRegister ? 'Đồng ý điều khoản' : 'Ghi nhớ đăng nhập'}</span>
                    </label>
                    {!isRegister && (
                      <Link to="/forgot-password" className="font-bold text-sky-800 transition hover:text-sky-900">
                        Quên mật khẩu?
                      </Link>
                    )}
                  </div>
                )}

                {isReset && (
                  <div className="auth-note border border-sky-100 bg-white px-3 py-2 text-xs font-semibold leading-5 text-sky-900 shadow-sm">
                    {forgotPasswordToken
                      ? 'Mật khẩu mới nên có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.'
                      : 'Vui lòng mở trang này từ liên kết đặt lại mật khẩu trong email để có token hợp lệ.'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="auth-submit-btn w-full bg-[#30353b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting
                    ? isForgot
                      ? 'Đang gửi...'
                      : isReset
                        ? 'Đang cập nhật...'
                        : isRegister
                          ? 'Đang đăng ký...'
                          : 'Đang đăng nhập...'
                    : content.submit}
                </button>
              </form>

              <div className="auth-helper-card mt-4 border border-slate-200 bg-white px-4 py-4 text-[13px] text-slate-700 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)]">
                <p>
                  {content.helper}{' '}
                  <Link to={content.helperTo} className="font-black text-slate-950 transition hover:text-sky-800">
                    {content.helperCta}
                  </Link>
                </p>
                <p className="mt-2">
                  {content.secondary}{' '}
                  <Link to={content.secondaryTo} className="font-black text-sky-800 transition hover:text-sky-900">
                    {content.secondaryCta}
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default AuthPortal
