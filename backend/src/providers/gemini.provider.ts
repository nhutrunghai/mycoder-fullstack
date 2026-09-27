import axios from 'axios'
import env from '~/configs/env.config'
import adminSystemSettingService from '~/services/admin/system-setting.service'
import logger from '~/configs/logger.config.js'

type GenerateTextParams = {
  model: string
  prompt: string
  responseMimeType?: 'text/plain' | 'application/json'
  responseJsonSchema?: Record<string, unknown>
}

class GeminiProvider {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models'

  private async getApiKey() {
    const apiKey = await adminSystemSettingService.getGeminiApiKey()

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required to call Gemini API')
    }

    return apiKey
  }

  async generateText({ model, prompt, responseMimeType = 'text/plain', responseJsonSchema }: GenerateTextParams) {
    const apiKey = await this.getApiKey()

    const startedAt = Date.now()

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}:generateContent`,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType,
            ...(responseJsonSchema ? { responseJsonSchema } : {})
          }
        },
        {
          timeout: env.GEMINI_API_TIMEOUT_MS,
          headers: {
            'x-goog-api-key': apiKey
          }
        }
      )

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Gemini API returned an empty response')
      }

      logger.debug(
        {
          model,
          response_mime_type: responseMimeType,
          elapsed_ms: Date.now() - startedAt
        },
        'Gemini request succeeded'
      )

      return text.trim()
    } catch (error) {
      logger.error(
        {
          err: error,
          model,
          response_mime_type: responseMimeType,
          elapsed_ms: Date.now() - startedAt
        },
        'Gemini request failed'
      )

      throw error
    }
  }
}

const geminiProvider = new GeminiProvider()
export default geminiProvider
