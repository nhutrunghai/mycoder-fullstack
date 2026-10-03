import { buildApiUrl, createJsonHeaders } from '../config/api.js'

const ADMIN_AUTH_STORAGE_KEYS = ['adminToken', 'adminAccessToken', 'adminRefreshToken', 'adminUser']

function clearAdminAuthSession() {
  if (typeof window === 'undefined') return
  ADMIN_AUTH_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  })
}

clearAdminAuthSession()

async function readPayload(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractErrorMessage(payload, fallback) {
  if (payload?.message) return payload.message
  if (payload?.error?.message) return payload.error.message
  return fallback
}

function redirectToAdminLogin() {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/admin/login') return

  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/admin/login?redirect=${encodeURIComponent(redirect)}`)
}

async function adminRequest(method, path, { params, data, redirectOnUnauthorized = true } = {}) {
  const headers = createJsonHeaders({}, { auth: false, hasBody: data !== undefined })

  const response = await fetch(buildApiUrl(path, params), {
    method,
    credentials: 'include',
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const payload = await readPayload(response)

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminAuthSession()
      if (redirectOnUnauthorized) {
        redirectToAdminLogin()
      }
    }

    throw new Error(extractErrorMessage(payload, `HTTP ${response.status}: ${response.statusText}`))
  }

  return payload?.data ?? payload
}

export async function adminLogin(body) {
  const result = await adminRequest('POST', '/admin/auth/login', {
    data: {
      email: body?.email,
      password: body?.password,
    },
    redirectOnUnauthorized: false,
  })

  return result
}

export async function adminLogout() {
  try {
    return await adminRequest('POST', '/admin/auth/logout')
  } finally {
    clearAdminAuthSession()
  }
}

export async function getAdminMe() {
  return adminRequest('GET', '/admin/auth/me')
}

export async function getAdminDashboardSummary() {
  return adminRequest('GET', '/admin/dashboard/summary')
}

export async function getAdminUsers(params = {}) {
  return adminRequest('GET', '/admin/users', { params })
}

export async function getAdminUserDetail(userId) {
  return adminRequest('GET', `/admin/users/${userId}`)
}

export async function getAdminUserWallet(userId) {
  return adminRequest('GET', '/admin/users/' + userId + '/wallet')
}

export async function getAdminUserApplications(userId, params = {}) {
  return adminRequest('GET', '/admin/users/' + userId + '/applications', { params })
}

export async function getAdminUserTopUpOrders(userId, params = {}) {
  return adminRequest('GET', '/admin/users/' + userId + '/wallet-topup-orders', { params })
}

export async function updateAdminUserStatus(userId, status) {
  return adminRequest('PATCH', `/admin/users/${userId}/status`, {
    data: {
      status: Number(status),
    },
  })
}

export async function updateAdminUserRole(userId, role) {
  return adminRequest('PATCH', `/admin/users/${userId}/role`, {
    data: {
      role: Number(role),
    },
  })
}

export async function getAdminCompanies(params = {}) {
  return adminRequest('GET', '/admin/companies', { params })
}

export async function getAdminCompanyDetail(companyId) {
  return adminRequest('GET', `/admin/companies/${companyId}`)
}

export async function getAdminCompanyJobs(companyId, params = {}) {
  return adminRequest('GET', `/admin/companies/${companyId}/jobs`, { params })
}

export async function getAdminCompanyApplications(companyId, params = {}) {
  return adminRequest('GET', `/admin/companies/${companyId}/applications`, { params })
}

export async function updateAdminCompanyStatus(companyId, verified) {
  return adminRequest('PATCH', `/admin/companies/${companyId}/status`, {
    data: {
      verified: Boolean(verified),
    },
  })
}

export async function getAdminJobCategories() {
  return adminRequest('GET', '/admin/job-categories')
}

export async function createAdminJobCategory(body) {
  const result = await adminRequest('POST', '/admin/job-categories', {
    data: body,
  })
  return result?.category ?? result
}

export async function updateAdminJobCategory(categoryId, body) {
  const result = await adminRequest('PATCH', `/admin/job-categories/${categoryId}`, {
    data: body,
  })
  return result?.category ?? result
}

export async function updateAdminJobCategoryStatus(categoryId, isActive) {
  const result = await adminRequest('PATCH', `/admin/job-categories/${categoryId}/status`, {
    data: {
      is_active: Boolean(isActive),
    },
  })
  return result?.category ?? result
}

export async function getAdminJobs(params = {}) {
  return adminRequest('GET', '/admin/jobs', { params })
}

export async function getAdminJobDetail(jobId) {
  return adminRequest('GET', `/admin/jobs/${jobId}`)
}

export async function updateAdminJobModerationStatus(jobId, body) {
  return adminRequest('PATCH', `/admin/jobs/${jobId}/moderation-status`, {
    data: {
      moderation_status: body?.moderation_status,
      blocked_reason: body?.blocked_reason,
    },
  })
}

export async function getAdminJobApplications(jobId, params = {}) {
  return adminRequest('GET', `/admin/jobs/${jobId}/applications`, { params })
}

export async function getAdminJobPromotions(params = {}) {
  return adminRequest('GET', '/admin/job-promotions', { params })
}

export async function getAdminJobPromotionDetail(promotionId) {
  const result = await adminRequest('GET', `/admin/job-promotions/${promotionId}`)
  return result?.promotion ?? result
}

export async function createAdminJobPromotion(body) {
  const result = await adminRequest('POST', '/admin/job-promotions', {
    data: {
      jobId: body?.jobId,
      plan_id: body?.plan_id,
      starts_at: body?.starts_at,
      ends_at: body?.ends_at,
    },
  })

  return result?.promotion ?? result
}

export async function updateAdminJobPromotion(promotionId, body) {
  const result = await adminRequest('PATCH', `/admin/job-promotions/${promotionId}`, {
    data: body,
  })

  return result?.promotion ?? result
}

export async function getAdminJobPromotionPlans() {
  return adminRequest('GET', '/admin/job-promotion-plans')
}

export async function createAdminJobPromotionPlan(body) {
  const result = await adminRequest('POST', '/admin/job-promotion-plans', { data: body })
  return result?.plan ?? result
}

export async function updateAdminJobPromotionPlan(planId, body) {
  const result = await adminRequest('PATCH', `/admin/job-promotion-plans/${planId}`, { data: body })
  return result?.plan ?? result
}

export async function deleteAdminJobPromotionPlan(planId) {
  const result = await adminRequest('DELETE', `/admin/job-promotion-plans/${planId}`)
  return result?.plan ?? result
}

export async function deleteAdminJobPromotion(promotionId) {
  const result = await adminRequest('DELETE', `/admin/job-promotions/${promotionId}`)
  return result?.promotion ?? result
}

export function normalizeDateRangeParams(params = {}) {
  const result = { ...params }
  if (result.dateRange) {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (result.dateRange === 'today') {
      result.fromDate = todayStart.toISOString()
      result.toDate = todayEnd.toISOString()
    } else if (result.dateRange === '7days') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
      result.fromDate = from.toISOString()
      result.toDate = todayEnd.toISOString()
    } else if (result.dateRange === '30days') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0)
      result.fromDate = from.toISOString()
      result.toDate = todayEnd.toISOString()
    } else if (result.dateRange === 'this_month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      result.fromDate = from.toISOString()
      result.toDate = todayEnd.toISOString()
    } else if (result.dateRange === 'last_month') {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      result.fromDate = from.toISOString()
      result.toDate = to.toISOString()
    }
  }
  return result
}

export async function getAdminWalletTransactions(params = {}) {
  const normalizedParams = normalizeDateRangeParams(params)
  if (normalizedParams.user_id && !normalizedParams.userId) {
    normalizedParams.userId = normalizedParams.user_id
  }
  return adminRequest('GET', '/admin/wallet-transactions', { params: normalizedParams })
}

export async function adjustAdminWalletBalance(body) {
  return adminRequest('POST', '/admin/wallet-transactions/adjust', {
    data: {
      userId: body?.userId || body?.user_id,
      amount: Number(body?.amount),
      direction: body?.direction,
      description: body?.description || body?.reason || 'Điều chỉnh số dư ví từ trang quản trị',
    },
  })
}

export async function getAdminSePayConfig() {
  return adminRequest('GET', '/admin/sepay/config')
}

export async function updateAdminSePayConfig(body) {
  return adminRequest('PATCH', '/admin/sepay/config', {
    data: {
      bank_account_id: body?.bank_account_id,
      bank_short_name: body?.bank_short_name,
      bank_account_number: body?.bank_account_number,
      bank_account_holder_name: body?.bank_account_holder_name,
    },
  })
}

export async function rotateAdminSePaySecrets(body) {
  return adminRequest('PATCH', '/admin/sepay/secrets', {
    data: {
      api_token: body?.api_token,
      webhook_secret: body?.webhook_secret,
    },
  })
}

export async function testAdminSePayConnection() {
  return adminRequest('POST', '/admin/sepay/test-connection')
}

export async function getAdminSePayDiagnostics(params = {}) {
  return adminRequest('GET', '/admin/sepay/diagnostics', { params: normalizeDateRangeParams(params) })
}

export async function getAdminRagChatConfig() {
  return adminRequest('GET', '/admin/rag-chat/config')
}

export async function updateAdminRagChatConfig(body) {
  const result = await adminRequest('PATCH', '/admin/rag-chat/config', {
    data: body,
  })
  return result?.config ?? result
}

export async function rotateAdminRagChatSecrets(body) {
  return adminRequest('PATCH', '/admin/rag-chat/secrets', {
    data: {
      openai_api_key: body?.openai_api_key,
      gemini_api_key: body?.gemini_api_key,
    },
  })
}

export async function getAdminRagChatHealth() {
  return adminRequest('GET', '/admin/rag-chat/health')
}

export async function testAdminRagChatConnection(body = {}) {
  return adminRequest('POST', '/admin/rag-chat/test-connection', {
    data: body,
  })
}

export async function getAdminAuditLogs(params = {}) {
  return adminRequest('GET', '/admin/audit-logs', { params: normalizeDateRangeParams(params) })
}