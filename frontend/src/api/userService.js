import apiClient from './axiosClient.js'
import { genUploader } from 'uploadthing/client'
import { getAccessToken, getApiOrigin } from '../config/api.js'

const CACHE_TTL = 30000
const cache = {
  profile: null,
  setting: null,
  detail: null,
}
const { uploadFiles } = genUploader({
  url: `${getApiOrigin()}/api/uploadthing`,
})

function getCacheKey() {
  return getAccessToken() || 'anonymous'
}

function readCache(name) {
  const entry = cache[name]
  if (!entry) return null
  if (entry.key !== getCacheKey()) return null
  if (Date.now() - entry.time > CACHE_TTL) return null
  return entry.value
}

function writeCache(name, value) {
  cache[name] = {
    key: getCacheKey(),
    time: Date.now(),
    value,
  }
  return value
}

function clearProfileCaches() {
  cache.profile = null
  cache.setting = null
  cache.detail = null
}

function normalizeMyProfile(profile = {}) {
  return {
    ...profile,
    id: profile._id || profile.id || '',
    username: profile.username || '',
    fullName: profile.fullName || profile.username || '',
    avatar: profile.avatar || '',
  }
}

function normalizePublicProfile(profile = {}) {
  return {
    id: profile._id || profile.id || '',
    username: profile.username || '',
    fullName: profile.fullName || profile.username || 'Người dùng MYCODER',
    avatar: profile.avatar || '',
    bio: profile.bio || '',
    address: profile.address || '',
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    created_at: profile.created_at || profile.createdAt || '',
  }
}

function normalizeSetting(setting = {}) {
  return {
    email: setting.email || '',
    phone: setting.phone || '',
    is_verified: Boolean(setting.is_verified ?? setting.email_verified),
  }
}

export async function getMyProfile({ force = false, redirectOnUnauthorized = true } = {}) {
  if (!force) {
    const cached = readCache('profile')
    if (cached) return cached
  }

  const response = await apiClient.get('/user/me', { redirectOnUnauthorized })
  return writeCache('profile', normalizeMyProfile(response?.data?.data))
}

export async function getPublicProfile(id) {
  const response = await apiClient.get(`/user/profile/${encodeURIComponent(id)}`)
  return normalizePublicProfile(response?.data?.data)
}

export async function getMyProfileDetail({ force = false } = {}) {
  if (!force) {
    const cached = readCache('detail')
    if (cached) return cached
  }

  const me = await getMyProfile({ force })
  const [publicProfile, setting] = await Promise.all([
    me.username ? getPublicProfile(me.username) : Promise.resolve({}),
    getUserSetting({ force }).catch(() => ({})),
  ])

  return writeCache('detail', {
    ...publicProfile,
    ...normalizeSetting(setting),
    id: publicProfile.id || me.id,
    username: publicProfile.username || me.username,
    fullName: publicProfile.fullName || me.fullName,
    avatar: publicProfile.avatar || me.avatar || '',
  })
}

export async function updateMyProfile(payload) {
  const body = {}

  if (payload.fullName !== undefined) body.fullName = payload.fullName
  if (payload.bio !== undefined) body.bio = payload.bio
  if (payload.address !== undefined) body.address = payload.address
  if (Array.isArray(payload.skills)) body.skills = payload.skills

  await apiClient.patch('/user/profile', body)
  clearProfileCaches()
  return getMyProfileDetail({ force: true })
}

export async function updateMyAvatar(file) {
  if (!file) {
    throw new Error('Vui lòng chọn ảnh đại diện.')
  }

  const token = getAccessToken()
  if (!token) {
    throw new Error('Bạn cần đăng nhập để cập nhật avatar.')
  }

  const uploadedFiles = await uploadFiles('userAvatar', {
    files: [file],
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const uploadedFile = uploadedFiles?.[0]
  const avatarFileKey = uploadedFile?.key || uploadedFile?.serverData?.key

  if (!avatarFileKey) {
    throw new Error('Upload avatar thành công nhưng thiếu dữ liệu file.')
  }

  await apiClient.patch('/user/profile/avatar', {
    avatar_file_key: avatarFileKey,
  })

  clearProfileCaches()
  return getMyProfileDetail({ force: true })
}

export async function getUserSetting({ force = false } = {}) {
  if (!force) {
    const cached = readCache('setting')
    if (cached) return cached
  }

  const response = await apiClient.get('/user/setting')
  return writeCache('setting', {
    ...normalizeSetting(response?.data?.data),
    username: response?.data?.data?.username || '',
  })
}

export async function updateUserSetting(payload) {
  const response = await apiClient.patch('/user/setting', {
    phone: payload.phone,
  })
  cache.setting = null
  cache.detail = null
  const setting = await getUserSetting({ force: true })
  return {
    ...setting,
    message: response?.data?.message || 'Cập nhật cài đặt người dùng thành công.',
  }
}

export async function resendVerificationMail() {
  const response = await apiClient.post('/user/setting/resend-mail')
  return { message: response?.data?.message || 'Đã gửi lại email xác minh.' }
}

export async function requestChangePasswordOtp() {
  const response = await apiClient.post('/user/setting/change-password')
  return { message: response?.data?.message || 'OTP đã được gửi qua email.' }
}

export async function setNewPasswordWithOtp(payload) {
  const response = await apiClient.post('/user/setting/new-password', {
    newPassword: payload.newPassword,
    confirmNewPassword: payload.confirmNewPassword,
    OtpCode: payload.OtpCode,
  })
  return { message: response?.data?.message || 'Đã đặt mật khẩu mới.' }
}
