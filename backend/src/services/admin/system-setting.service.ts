import axios, { AxiosError } from 'axios'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import env from '~/configs/env.config.js'
import { SystemSettingKey } from '~/constants/enums.js'
import {
  decryptSystemSecret,
  EncryptedSystemSecret,
  encryptSystemSecret,
  maskSecret
} from '~/utils/systemSettingsSecret.util.js'

export type LlmProvider = 'gemini' | 'openai'

export type RagChatRuntimeConfig = {
  enabled: boolean
  provider: LlmProvider
  intent_model: string
  chat_model: string
  cv_visual_review_model: string
  job_search_top_k: number
  job_explanation_top_k: number
  cv_review_top_k: number
  answer_context_limit: number
  allow_cv_review: boolean
  allow_job_qa: boolean
  allow_policy_qa: boolean
  allow_general_qa: boolean
  maintenance_message: string | null
}

export type SePayRuntimeConfig = {
  bank_account_id: string | null
  bank_short_name: string
  bank_account_number: string | null
  bank_account_holder_name: string | null
}

type RagChatSecretKey = 'openai_api_key' | 'gemini_api_key'
type SePaySecretKey = 'api_token' | 'webhook_secret'
type SettingWithSecrets = {
  value?: Record<string, unknown>
  secrets?: Record<string, EncryptedSystemSecret>
}

class AdminSystemSettingService {
  getDefaultRagChatConfig(): RagChatRuntimeConfig {
    return {
      enabled: true,
      provider: env.LLM_PROVIDER,
      intent_model: env.LLM_MODEL_INTENT,
      chat_model: env.LLM_MODEL_CHAT,
      cv_visual_review_model: env.OPENAI_MODEL_CV_VISUAL_REVIEW,
      job_search_top_k: 5,
      job_explanation_top_k: 5,
      cv_review_top_k: 6,
      answer_context_limit: 3,
      allow_cv_review: true,
      allow_job_qa: true,
      allow_policy_qa: false,
      allow_general_qa: false,
      maintenance_message: null
    }
  }

  getDefaultSePayConfig(): SePayRuntimeConfig {
    return {
      bank_account_id: env.SEPAY_BANK_ACCOUNT_ID || null,
      bank_short_name: env.SEPAY_BANK_SHORT_NAME,
      bank_account_number: env.SEPAY_BANK_ACCOUNT_NUMBER || null,
      bank_account_holder_name: env.SEPAY_BANK_ACCOUNT_HOLDER_NAME || null
    }
  }

  async getRagChatConfig() {
    const setting = await databaseService.systemSettings.findOne({
      key: SystemSettingKey.RAG_CHAT
    })

    return {
      ...this.getDefaultRagChatConfig(),
      ...this.withoutSecrets(setting?.value || {})
    } as RagChatRuntimeConfig
  }

  async updateRagChatConfig(value: Partial<RagChatRuntimeConfig>, adminId?: ObjectId) {
    return this.upsertSetting(SystemSettingKey.RAG_CHAT, value, adminId)
  }

  async rotateRagChatSecrets(value: Partial<Record<RagChatSecretKey, string>>, adminId?: ObjectId) {
    return this.rotateSecrets(SystemSettingKey.RAG_CHAT, value, adminId)
  }

  async getRagChatSecretStatus() {
    const setting = (await databaseService.systemSettings.findOne({
      key: SystemSettingKey.RAG_CHAT
    })) as SettingWithSecrets | null

    return {
      openai_api_key_configured: Boolean(setting?.secrets?.openai_api_key || env.OPENAI_API_KEY),
      openai_api_key_source: setting?.secrets?.openai_api_key ? 'database' : env.OPENAI_API_KEY ? 'env' : null,
      openai_api_key_preview: setting?.secrets?.openai_api_key?.preview || maskSecret(env.OPENAI_API_KEY),
      gemini_api_key_configured: Boolean(setting?.secrets?.gemini_api_key || env.GEMINI_API_KEY),
      gemini_api_key_source: setting?.secrets?.gemini_api_key ? 'database' : env.GEMINI_API_KEY ? 'env' : null,
      gemini_api_key_preview: setting?.secrets?.gemini_api_key?.preview || maskSecret(env.GEMINI_API_KEY)
    }
  }

  async getOpenAiApiKey() {
    const setting = (await databaseService.systemSettings.findOne({
      key: SystemSettingKey.RAG_CHAT
    })) as SettingWithSecrets | null

    return decryptSystemSecret(setting?.secrets?.openai_api_key) || env.OPENAI_API_KEY
  }

  async getGeminiApiKey() {
    const setting = (await databaseService.systemSettings.findOne({
      key: SystemSettingKey.RAG_CHAT
    })) as SettingWithSecrets | null

    return decryptSystemSecret(setting?.secrets?.gemini_api_key) || env.GEMINI_API_KEY
  }

  async getSePayConfig() {
    const setting = await databaseService.systemSettings.findOne({
      key: SystemSettingKey.SEPAY
    })

    return {
      ...this.getDefaultSePayConfig(),
      ...this.withoutSecrets(setting?.value || {})
    } as SePayRuntimeConfig
  }

  async updateSePayConfig(value: Partial<SePayRuntimeConfig>, adminId?: ObjectId) {
    return this.upsertSetting(SystemSettingKey.SEPAY, value, adminId)
  }

  async rotateSePaySecrets(value: Partial<Record<SePaySecretKey, string>>, adminId?: ObjectId) {
    return this.rotateSecrets(SystemSettingKey.SEPAY, value, adminId)
  }

  async getSePaySecretStatus() {
    const setting = (await databaseService.systemSettings.findOne({
      key: SystemSettingKey.SEPAY
    })) as SettingWithSecrets | null

    return {
      api_token_configured: Boolean(setting?.secrets?.api_token || env.SEPAY_API_TOKEN),
      api_token_source: setting?.secrets?.api_token ? 'database' : env.SEPAY_API_TOKEN ? 'env' : null,
      api_token_preview: setting?.secrets?.api_token?.preview || maskSecret(env.SEPAY_API_TOKEN),
      webhook_secret_configured: Boolean(setting?.secrets?.webhook_secret || env.SEPAY_WEBHOOK_SECRET),
      webhook_secret_source: setting?.secrets?.webhook_secret ? 'database' : env.SEPAY_WEBHOOK_SECRET ? 'env' : null,
      webhook_secret_preview: setting?.secrets?.webhook_secret?.preview || maskSecret(env.SEPAY_WEBHOOK_SECRET)
    }
  }

  async getSePayApiToken() {
    const setting = (await databaseService.systemSettings.findOne({
      key: SystemSettingKey.SEPAY
    })) as SettingWithSecrets | null

    return decryptSystemSecret(setting?.secrets?.api_token) || env.SEPAY_API_TOKEN
  }

  async getSePayWebhookSecret() {
    const setting = (await databaseService.systemSettings.findOne({
      key: SystemSettingKey.SEPAY
    })) as SettingWithSecrets | null

    return decryptSystemSecret(setting?.secrets?.webhook_secret) || env.SEPAY_WEBHOOK_SECRET
  }

  private async upsertSetting(key: SystemSettingKey, value: Record<string, unknown>, adminId?: ObjectId) {
    const existing = await databaseService.systemSettings.findOne({ key })
    const now = new Date()

    return databaseService.systemSettings.findOneAndUpdate(
      { key },
      {
        $set: {
          value: {
            ...(existing?.value || {}),
            ...value
          },
          updated_by: adminId,
          updated_at: now
        },
        $setOnInsert: {
          key,
          created_at: now
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
  }

  async testRagChatConnection(requestedProvider?: LlmProvider) {
    const config = await this.getRagChatConfig()
    const provider = requestedProvider || config.provider
    const startedAt = Date.now()

    if (provider === 'openai') {
      const apiKey = await this.getOpenAiApiKey()
      const testModel = config.chat_model?.trim() || 'gpt-4o-mini'

      if (!apiKey) {
        return {
          connected: false,
          provider,
          model: testModel,
          latency_ms: 0,
          reason: 'missing_key',
          message: 'Chưa cấu hình API Key cho OpenAI. Vui lòng kiểm tra file .env hoặc cập nhật trong Quản lý khóa API.',
          checked_at: new Date()
        }
      }

      try {
        const response = await axios.post(
          `${env.OPENAI_BASE_URL}/chat/completions`,
          {
            model: testModel,
            messages: [{ role: 'user', content: 'ping' }],
            ...(testModel.startsWith('o1') || testModel.startsWith('o3') ? { max_completion_tokens: 25 } : { max_tokens: 5 })
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        )

        const latency_ms = Date.now() - startedAt
        return {
          connected: true,
          provider,
          model: testModel,
          latency_ms,
          response_sample: response.data?.choices?.[0]?.message?.content?.trim() || 'pong',
          checked_at: new Date()
        }
      } catch (error) {
        const latency_ms = Date.now() - startedAt
        const axiosError = error as AxiosError<{ error?: { message?: string } }>
        const statusCode = axiosError.response?.status
        let errorMsg = axiosError.response?.data?.error?.message || axiosError.message

        if (statusCode === 401) {
          errorMsg = 'API Key OpenAI không hợp lệ hoặc đã bị vô hiệu hóa (401 Unauthorized).'
        } else if (statusCode === 429) {
          errorMsg = 'Tài khoản OpenAI đã hết hạn mức (Quota exceeded) hoặc bị giới hạn tần suất (429 Too Many Requests).'
        } else if (axiosError.code === 'ECONNABORTED') {
          errorMsg = 'Kết nối đến máy chủ OpenAI quá thời gian chờ (Timeout sau 10 giây).'
        }

        return {
          connected: false,
          provider,
          model: testModel,
          latency_ms,
          reason: 'api_error',
          status_code: statusCode || null,
          message: errorMsg,
          checked_at: new Date()
        }
      }
    } else {
      // gemini
      const apiKey = await this.getGeminiApiKey()
      const testModel = config.chat_model?.trim() || 'gemini-2.0-flash'

      if (!apiKey) {
        return {
          connected: false,
          provider,
          model: testModel,
          latency_ms: 0,
          reason: 'missing_key',
          message: 'Chưa cấu hình API Key cho Gemini. Vui lòng kiểm tra file .env hoặc cập nhật trong Quản lý khóa API.',
          checked_at: new Date()
        }
      }

      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`,
          {
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        )

        const latency_ms = Date.now() - startedAt
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'pong'

        return {
          connected: true,
          provider,
          model: testModel,
          latency_ms,
          response_sample: text,
          checked_at: new Date()
        }
      } catch (error) {
        const latency_ms = Date.now() - startedAt
        const axiosError = error as AxiosError<{ error?: { message?: string } }>
        const statusCode = axiosError.response?.status
        let errorMsg = axiosError.response?.data?.error?.message || axiosError.message

        if (statusCode === 400 || statusCode === 403 || statusCode === 401) {
          errorMsg = `API Key Gemini không hợp lệ hoặc chưa kích hoạt Generative Language API (${statusCode}).`
        } else if (statusCode === 429) {
          errorMsg = 'Tài khoản Gemini đã vượt quá giới hạn lượt gọi (429 Rate Limit Exceeded).'
        } else if (axiosError.code === 'ECONNABORTED') {
          errorMsg = 'Kết nối đến Google Gemini quá thời gian chờ (Timeout sau 10 giây).'
        }

        return {
          connected: false,
          provider,
          model: testModel,
          latency_ms,
          reason: 'api_error',
          status_code: statusCode || null,
          message: errorMsg,
          checked_at: new Date()
        }
      }
    }
  }

  private async rotateSecrets(
    key: SystemSettingKey,
    value: Partial<Record<RagChatSecretKey | SePaySecretKey, string>>,
    adminId?: ObjectId
  ) {
    const encryptedSecrets = Object.entries(value).reduce<Record<string, EncryptedSystemSecret>>(
      (result, [secretKey, secretValue]) => {
        if (typeof secretValue === 'string' && secretValue.trim()) {
          result[secretKey] = encryptSystemSecret(secretValue.trim())
        }

        return result
      },
      {}
    )

    const existing = await databaseService.systemSettings.findOne({ key })
    const now = new Date()

    return databaseService.systemSettings.findOneAndUpdate(
      { key },
      {
        $set: {
          secrets: {
            ...((existing as SettingWithSecrets | null)?.secrets || {}),
            ...encryptedSecrets
          },
          updated_by: adminId,
          updated_at: now
        },
        $setOnInsert: {
          key,
          value: existing?.value || {},
          created_at: now
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
  }

  private withoutSecrets(value: Record<string, unknown>) {
    const { secrets, ...safeValue } = value
    return safeValue
  }
}

const adminSystemSettingService = new AdminSystemSettingService()

export default adminSystemSettingService
