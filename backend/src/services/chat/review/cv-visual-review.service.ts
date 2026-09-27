import axios from 'axios'
import env from '~/configs/env.config'
import Resume from '~/models/schema/client/resumes.schema'
import adminSystemSettingService from '~/services/admin/system-setting.service'
import logger from '~/configs/logger.config.js'

type CvVisualReviewResult = {
  summary: string | null
  error: string | null
  model: string
}

class CvVisualReviewService {
  private get responsesApiUrl() {
    return `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/responses`
  }

  private extractOutputText(payload: unknown): string | null {
    if (typeof (payload as { output_text?: unknown })?.output_text === 'string') {
      const text = (payload as { output_text: string }).output_text.trim()

      if (text) {
        return text
      }
    }

    const outputItems = Array.isArray((payload as { output?: unknown[] })?.output)
      ? ((payload as { output: unknown[] }).output ?? [])
      : []

    for (const item of outputItems) {
      const contentItems = Array.isArray((item as { content?: unknown[] })?.content)
        ? ((item as { content: unknown[] }).content ?? [])
        : []

      for (const contentItem of contentItems) {
        if (typeof (contentItem as { text?: unknown })?.text === 'string') {
          const text = (contentItem as { text: string }).text.trim()

          if (text) {
            return text
          }
        }

        const nestedText = (contentItem as { text?: { value?: unknown } })?.text?.value
        if (typeof nestedText === 'string' && nestedText.trim()) {
          return nestedText.trim()
        }
      }
    }

    return null
  }

  private normalizeError(error: unknown) {
    if (axios.isAxiosError(error)) {
      const responseMessage = error.response?.data?.error?.message

      if (typeof responseMessage === 'string' && responseMessage.trim()) {
        return responseMessage.trim()
      }

      if (typeof error.message === 'string' && error.message.trim()) {
        return error.message.trim()
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim()
    }

    return 'Unknown visual CV review error'
  }

  async reviewResumePdf({ message, resume }: { message: string; resume: Resume }): Promise<CvVisualReviewResult> {
    const model = env.OPENAI_MODEL_CV_VISUAL_REVIEW
    const apiKey = await adminSystemSettingService.getOpenAiApiKey()

    if (!apiKey) {
      return {
        summary: null,
        error: 'OPENAI_API_KEY chưa được cấu hình nên không thể phân tích bố cục CV.',
        model
      }
    }

    if (!resume.cv_url?.trim()) {
      return {
        summary: null,
        error: 'CV không có cv_url nên không thể phân tích PDF trực tiếp.',
        model
      }
    }

    const prompt = `
Bạn là chuyên gia review CV cho JobGo.
Hãy đánh giá file PDF CV dựa trên góc nhìn visual/layout, không tập trung vào việc chấm điểm chi tiết nội dung text.

Yêu cầu của user:
${message}

Hãy trả lời bằng tiếng Việt, ngắn gọn nhưng đủ ý, chỉ dựa trên PDF được cung cấp.
Tập trung vào các mục sau:
- Bố cục tổng thể
- Độ dễ đọc
- Visual hierarchy
- Spacing và khoảng trắng
- Font consistency
- Thứ tự section
- 1 cột / 2 cột có hợp lý không
- Bảng, icon, ảnh có gây nhiễu không
- Mức độ chuyên nghiệp
- Rủi ro ATS do layout phức tạp

Định dạng trả lời:
1. Tổng quan bố cục
2. Điểm mạnh bố cục
3. Vấn đề bố cục/thiết kế
4. Rủi ro ATS do trình bày
5. Gợi ý chỉnh sửa ưu tiên

Nếu PDF không đủ rõ để kết luận một điểm nào đó, hãy nói rõ là chưa đủ quan sát.
`.trim()

    const startedAt = Date.now()

    try {
      const response = await axios.post(
        this.responsesApiUrl,
        {
          model,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: prompt
                },
                {
                  type: 'input_file',
                  file_url: resume.cv_url
                }
              ]
            }
          ],
          max_output_tokens: 900
        },
        {
          timeout: env.OPENAI_API_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const summary = this.extractOutputText(response.data)

      if (!summary) {
        throw new Error('OpenAI Responses API returned an empty visual review result')
      }

      logger.debug(
        {
          model,
          resume_id: resume._id ? String(resume._id) : null,
          elapsed_ms: Date.now() - startedAt
        },
        'CV visual review succeeded'
      )

      return {
        summary,
        error: null,
        model
      }
    } catch (error) {
      const normalizedError = this.normalizeError(error)

      logger.error(
        {
          err: error,
          model,
          resume_id: resume._id ? String(resume._id) : null,
          elapsed_ms: Date.now() - startedAt,
          error_detail: normalizedError
        },
        'CV visual review failed'
      )

      return {
        summary: null,
        error: normalizedError,
        model
      }
    }
  }
}

const cvVisualReviewService = new CvVisualReviewService()
export default cvVisualReviewService
