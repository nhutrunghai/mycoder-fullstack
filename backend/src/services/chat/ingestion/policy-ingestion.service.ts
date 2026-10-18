import PolicyDocument from '~/models/schema/system/policyDocuments.schema.js'
import policyIndexService, { PolicyChunkInput } from '~/services/chat/indexing/policy-index.service.js'

export type PolicyIngestionResult = {
  status: 'completed' | 'skipped'
  chunks_indexed: number
}

class PolicyIngestionService {
  private static readonly CHUNK_SIZE = 1800
  private static readonly CHUNK_OVERLAP = 250

  constructor(private readonly indexService = policyIndexService) {}

  async ingestPolicyDocument(document: PolicyDocument): Promise<PolicyIngestionResult> {
    const policyDocumentId = this.requireDocumentId(document)
    const normalizedText = this.normalizeText(document.content)
    const chunks = this.buildPolicyChunks(document, normalizedText)

    await this.indexService.deletePolicyChunks(policyDocumentId)

    if (chunks.length === 0) {
      return { status: 'skipped', chunks_indexed: 0 }
    }

    const result = await this.indexService.indexPolicyChunks(chunks)
    return {
      status: 'completed',
      chunks_indexed: result.indexed
    }
  }

  async reindexPolicyDocument(document: PolicyDocument) {
    return this.ingestPolicyDocument(document)
  }

  async removePolicyDocument(policyDocumentId: string) {
    return this.indexService.deletePolicyChunks(policyDocumentId)
  }

  private requireDocumentId(document: PolicyDocument) {
    if (!document._id) {
      throw new Error('Policy document id is required for ingestion.')
    }

    return String(document._id)
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
      const hardEnd = Math.min(start + PolicyIngestionService.CHUNK_SIZE, text.length)
      const paragraphBreak = text.lastIndexOf('\n\n', hardEnd)
      const sentenceBreak = text.lastIndexOf('. ', hardEnd)
      const candidateEnd =
        paragraphBreak > start + PolicyIngestionService.CHUNK_SIZE * 0.5
          ? paragraphBreak
          : sentenceBreak > start + PolicyIngestionService.CHUNK_SIZE * 0.5
            ? sentenceBreak + 1
            : hardEnd

      const chunk = text.slice(start, candidateEnd).trim()
      if (chunk) {
        chunks.push(chunk)
      }

      if (candidateEnd >= text.length) {
        break
      }

      start = Math.max(0, candidateEnd - PolicyIngestionService.CHUNK_OVERLAP)
    }

    return chunks
  }

  private buildPolicyChunks(document: PolicyDocument, text: string): PolicyChunkInput[] {
    const policyDocumentId = this.requireDocumentId(document)

    return this.splitText(text).map((chunk, index) => ({
      policy_document_id: policyDocumentId,
      chunk_id: `${policyDocumentId}:${index}`,
      chunk_index: index,
      title: document.title,
      text: chunk,
      source_url: document.source_url,
      status: document.status,
      version: document.version,
      created_at: document.created_at,
      updated_at: document.updated_at
    }))
  }
}

const policyIngestionService = new PolicyIngestionService()
export default policyIngestionService
export { PolicyIngestionService }
