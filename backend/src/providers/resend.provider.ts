import { CreateEmailOptions, Resend } from 'resend'
import env from '~/configs/env.config.js'
import logger from '~/configs/logger.config.js'
class ResendProvider {
  private resend: Resend
  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY)
  }
  async sendWithTemplate(
    templateId: string,
    emails: { from: string; to: string; variables: Record<string, string | number> }[]
  ) {
    const MAX_SIZE = 100
    const results = []
    for (let i = 0; i < emails.length; i += MAX_SIZE) {
      const emailSplit = emails.slice(i, i + MAX_SIZE)
      const batchRequest: CreateEmailOptions[] = emailSplit.map((item) => ({
        from: item.from,
        to: item.to,
        template: {
          id: templateId,
          variables: item.variables
        }
      }))
      const { data, error } = await this.resend.batch.send(batchRequest)
      if (error) {
        logger.error(
          {
            err: error,
            template_id: templateId,
            recipient_count: batchRequest.length
          },
          'Resend batch request failed'
        )
        throw error
      }
      results.push(data)
      if (i + MAX_SIZE < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    return results
  }
}
const resendProvider = new ResendProvider()
export default resendProvider
