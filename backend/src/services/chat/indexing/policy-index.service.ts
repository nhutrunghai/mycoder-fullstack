import ElasticsearchConfig from '~/configs/elasticsearch.config.js'
import env from '~/configs/env.config.js'
import { POLICY_EMBEDDING_DIMS } from '~/configs/search.config.js'
import { OPENAI_EMBEDDING_MODEL_NAME, generateOpenAiEmbedding } from '~/services/chat/ai/embedding.service.js'

export type PolicyChunkInput = {
  policy_document_id: string
  chunk_id: string
  chunk_index: number
  title: string
  text: string
  source_url?: string
  status: 'active' | 'archived'
  version?: string
  created_at: Date
  updated_at: Date
}

type PolicyEmbeddingGenerator = (text: string) => Promise<number[]>
type ElasticsearchClientProvider = () => ReturnType<typeof ElasticsearchConfig.getInstance>

class PolicyIndexService {
  constructor(
    private readonly clientProvider: ElasticsearchClientProvider = () => ElasticsearchConfig.getInstance(),
    private readonly embeddingGenerator: PolicyEmbeddingGenerator = generateOpenAiEmbedding
  ) {}

  async deletePolicyChunks(policyDocumentId: string) {
    return this.clientProvider().deleteByQuery({
      index: env.POLICY_SEARCH_INDEX,
      refresh: true,
      conflicts: 'proceed',
      query: {
        term: {
          policy_document_id: policyDocumentId
        }
      }
    })
  }

  async indexPolicyChunks(chunks: PolicyChunkInput[]) {
    if (chunks.length === 0) {
      return { indexed: 0 }
    }

    const operations: Array<Record<string, unknown>> = []

    for (const chunk of chunks) {
      const embedding = await this.embeddingGenerator(chunk.text)
      if (embedding.length !== POLICY_EMBEDDING_DIMS) {
        throw new Error('Policy embedding dimensions do not match the configured Elasticsearch mapping.')
      }

      operations.push(
        {
          index: {
            _index: env.POLICY_SEARCH_INDEX,
            _id: chunk.chunk_id
          }
        },
        {
          ...chunk,
          embedding_model: OPENAI_EMBEDDING_MODEL_NAME,
          embedding
        }
      )
    }

    const response = await this.clientProvider().bulk({
      refresh: true,
      operations
    })

    if (response.errors) {
      throw new Error('Failed to index one or more policy chunks into Elasticsearch.')
    }

    return { indexed: chunks.length }
  }
}

const policyIndexService = new PolicyIndexService()
export default policyIndexService
export { PolicyIndexService }
