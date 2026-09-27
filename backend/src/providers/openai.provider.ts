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

class OpenAiProvider {
  private async getApiKey() {
    const apiKey = await adminSystemSettingService.getOpenAiApiKey()

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required to call OpenAI API')
    }

    return apiKey
  }

  async generateText({ model, prompt, responseMimeType = 'text/plain', responseJsonSchema }: GenerateTextParams) {
    const apiKey = await this.getApiKey()

    const startedAt = Date.now()

    try {
      const response = await axios.post(
        `${env.OPENAI_BASE_URL}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          ...(responseMimeType === 'application/json' && responseJsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'chatbot_structured_output',
                    strict: true,
                    schema: responseJsonSchema
                  }
                }
              }
            : {})
        },
        {
          timeout: env.OPENAI_API_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const text = response.data?.choices?.[0]?.message?.content

      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('OpenAI API returned an empty response')
      }

      logger.debug(
        {
          model,
          response_mime_type: responseMimeType,
          elapsed_ms: Date.now() - startedAt
        },
        'OpenAI request succeeded'
      )

      return text.trim()
    } catch (error) {
      const responseStatus = axios.isAxiosError(error) ? error.response?.status : undefined
      const responseError = axios.isAxiosError(error) ? error.response?.data?.error : undefined
      logger.error(
        {
          err: error,
          model,
          response_mime_type: responseMimeType,
          elapsed_ms: Date.now() - startedAt,
          status: responseStatus,
          api_error_type: responseError?.type,
          api_error_code: responseError?.code,
          api_error_message: responseError?.message
        },
        'OpenAI request failed'
      )

      throw error
    }
  }
}

const openAiProvider = new OpenAiProvider()
export default openAiProvider
