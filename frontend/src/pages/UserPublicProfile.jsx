import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyProfileDetail, getPublicProfile, updateMyAvatar } from '../api/userService.js'
import Toast from '../components/Toast.jsx'
import UserAvatar from '../components/UserAvatar.jsx'

function formatDate(value) {
  if (!value) return '--'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export default function UserPublicProfile() {
  const { id } = useParams()
  const isOwnProfile = !id
  const [profile, setProfile] = useState(null)
  const [loadingKey, setLoadingKey] = useState(id || 'me')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [toast, setToast] = useState(null)
  const loading = loadingKey === (id || 'me')

  useEffect(() => {
    let active = true
    const currentKey = id || 'me'

    Promise.resolve()
      .then(() => {
        if (active) {
          setLoadingKey(currentKey)
          setProfile(null)
        }
        return isOwnProfile ? getMyProfileDetail() : getPublicProfile(id)
      })
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch((error) => {
        if (active) {
          setProfile(null)
          setToast({ type: 'error', message: error.message || 'Không thể tải hồ sơ.' })
        }
      })
      .finally(() => {
        if (active) setLoadingKey('')
      })

    return () => {
      active = false
    }
  }, [id, isOwnProfile])

  const displayName = profile?.fullName || profile?.username || 'Người dùng MYCODER'
  const handle = profile?.username ? `@${profile.username}` : '@mycoder-user'
  const visibleSkills = useMemo(() => (Array.isArray(profile?.skills) ? profile.skills.filter(Boolean) : []), [profile])

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !isOwnProfile) return
    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', message: 'Vui lòng chọn file ảnh hợp lệ.' })
      return
    }

    setUploadingAvatar(true)
    try {
      const updated = await updateMyAvatar(file)
      setProfile(updated)
      setToast({ type: 'success', message: 'Đã cập nhật avatar.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Không thể cập nhật avatar.' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-on-surface">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <main className="mx-auto min-h-screen max-w-[1120px] px-4 py-7 md:px-6">
        <header className="mb-5 flex items-center gap-3">
          <Link to="/" className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-900">
            <span className="material-symbols-outlined !text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">{isOwnProfile ? 'Hồ sơ của tôi' : 'Hồ sơ ứng viên'}</h1>
            <p className="mt-1 text-sm text-slate-500">Thông tin cá nhân, giới thiệu và kỹ năng nghề nghiệp.</p>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
            Đang tải hồ sơ...
          </section>
        ) : profile ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-24 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#0ea5e9]" />
                <div className="-mt-12 px-6 pb-6">
                  <div className="relative w-fit">
                    <UserAvatar src={profile.avatar} name={displayName} className="h-24 w-24 border-4 border-white shadow-md" textClassName="text-3xl" />
                    {isOwnProfile ? (
                      <label
                        className={`absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md transition hover:bg-blue-700 ${
                          uploadingAvatar ? 'pointer-events-none opacity-70' : ''
                        }`}
                        title="Cập nhật avatar"
                      >
                        <span className="material-symbols-outlined text-[15px]">{uploadingAvatar ? 'progress_activity' : 'photo_camera'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                      </label>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <h2 className="break-words text-2xl font-extrabold text-slate-900">{displayName}</h2>
                    <p className="mt-1 text-sm font-semibold text-blue-700">{handle}</p>
                  </div>
                  {isOwnProfile ? (
                    <p className="mt-3 text-xs text-slate-500">
                      {uploadingAvatar ? 'Đang upload avatar...' : 'Nhấn icon camera trên avatar để đổi ảnh đại diện.'}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Candidate</span>
                    {isOwnProfile ? (
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${profile.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {profile.is_verified ? 'Đã xác minh email' : 'Chưa xác minh email'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900">Liên hệ</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Email</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{isOwnProfile ? profile.email || '--' : 'Ẩn công khai'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Số điện thoại</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{isOwnProfile ? profile.phone || '--' : 'Ẩn công khai'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ngày tham gia</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{formatDate(profile.created_at)}</dd>
                  </div>
                </dl>
              </section>
            </aside>

            <section className="space-y-5">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">Giới thiệu</h3>
                    <p className="mt-1 text-sm text-slate-500">Bio và địa chỉ theo dữ liệu profile backend.</p>
                  </div>
                  {isOwnProfile ? (
                    <Link to="/user/profile/edit" className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700">
                      Cập nhật hồ sơ
                    </Link>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Bio</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{profile.bio || 'Người dùng chưa cập nhật giới thiệu.'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Địa chỉ</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{profile.address || 'Chưa cập nhật địa chỉ.'}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-extrabold text-slate-900">Kỹ năng</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {visibleSkills.length ? (
                    visibleSkills.map((skill) => (
                      <span key={skill} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">Chưa cập nhật kỹ năng.</span>
                  )}
                </div>
              </article>
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
            Không tìm thấy hồ sơ.
          </section>
        )}
      </main>
    </div>
  )
}
