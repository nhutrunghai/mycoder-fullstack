import axios from 'axios'
import { PDFParse } from 'pdf-parse'
import { ResumeStatus } from '~/constants/enums'
import Resume from '~/models/schema/client/resumes.schema'
import resumeIndexService, { ResumeChunkInput } from '~/services/chat/indexing/resume-index.service'

type ResumeIndexingResult = {
  status: 'completed' | 'skipped' | 'failed'
  chunks_indexed: number
  error?: string
}

class ResumeIngestionService {
  private static readonly DOWNLOAD_TIMEOUT_MS = 30000
  private static readonly MAX_RESUME_BYTES = 10 * 1024 * 1024
  private static readonly CHUNK_SIZE = 1800
  private static readonly CHUNK_OVERLAP = 250

  async ingestResume(resume: Resume): Promise<ResumeIndexingResult> {
    try {
      const pdfBuffer = await this.downloadResumePdf(resume.cv_url)
      const text = await this.extractPdfText(pdfBuffer)
      const chunks = this.buildResumeChunks(resume, text)

      if (chunks.length === 0) {
        return {
          status: 'skipped',
          chunks_indexed: 0,
          error: 'No text content extracted from resume PDF'
        }
      }

      await resumeIndexService.deleteResumeChunks(String(resume.candidate_id), String(resume._id))
      const result = await resumeIndexService.indexResumeChunks(chunks)

      return {
        status: 'completed',
        chunks_indexed: result.indexed
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          tag: 'resume_ingestion_failed',
          resume_id: String(resume._id),
          candidate_id: String(resume.candidate_id),
          error: error instanceof Error ? error.message : String(error)
        })
      )

      return {
        status: 'failed',
        chunks_indexed: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async downloadResumePdf(url: string) {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: ResumeIngestionService.DOWNLOAD_TIMEOUT_MS,
      maxContentLength: ResumeIngestionService.MAX_RESUME_BYTES,
      maxBodyLength: ResumeIngestionService.MAX_RESUME_BYTES
    })

    const contentType = String(response.headers['content-type'] || '').toLowerCase()
    if (contentType && !contentType.includes('pdf') && !url.toLowerCase().includes('.pdf')) {
      throw new Error(`Unsupported resume file content type: ${contentType}`)
    }

    const buffer = Buffer.from(response.data)
    if (buffer.byteLength > ResumeIngestionService.MAX_RESUME_BYTES) {
      throw new Error('Resume PDF exceeds maximum ingestion size')
    }

    return buffer
  }

  private async extractPdfText(buffer: Buffer) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })

    try {
      const result = await parser.getText({
        pageJoiner: '\n\n',
        itemJoiner: ' '
      })

      return this.normalizeText(result.text)
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  }

  private normalizeText(text: string) {
    return text
      .replaceAll('\0', ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private splitText(text: string) {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const hardEnd = Math.min(start + ResumeIngestionService.CHUNK_SIZE, text.length)
      const paragraphBreak = text.lastIndexOf('\n\n', hardEnd)
      const sentenceBreak = text.lastIndexOf('. ', hardEnd)
      const candidateEnd =
        paragraphBreak > start + ResumeIngestionService.CHUNK_SIZE * 0.5
          ? paragraphBreak
          : sentenceBreak > start + ResumeIngestionService.CHUNK_SIZE * 0.5
            ? sentenceBreak + 1
            : hardEnd

      const chunk = text.slice(start, candidateEnd).trim()
      if (chunk) {
        chunks.push(chunk)
      }

      if (candidateEnd >= text.length) {
        break
      }

      start = Math.max(0, candidateEnd - ResumeIngestionService.CHUNK_OVERLAP)
    }

    return chunks
  }

  private buildResumeChunks(resume: Resume, text: string): ResumeChunkInput[] {
    const resumeId = String(resume._id)
    const candidateId = String(resume.candidate_id)

    return this.splitText(text).map((chunk, index) => ({
      resume_id: resumeId,
      candidate_id: candidateId,
      chunk_id: `${resumeId}:${index}`,
      chunk_index: index,
      status: resume.status || ResumeStatus.ACTIVE,
      is_default: Boolean(resume.is_default),
      title: resume.title,
      text: chunk,
      section: 'resume',
      source_url: resume.cv_url,
      resume_file_key: resume.resume_file_key
    }))
  }
}

const resumeIngestionService = new ResumeIngestionService()
export default resumeIngestionService
