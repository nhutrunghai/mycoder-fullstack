import ElasticsearchConfig from '~/configs/elasticsearch.config.js'
import env from '~/configs/env.config.js'
import { generateOpenAiEmbedding } from '~/services/chat/ai/embedding.service.js'

export type PolicyChunkSearchDocument = {
  policy_document_id: string
  chunk_id: string
  chunk_index: number
  title: string
  text: string
  source_url?: string
  status: 'active' | 'archived'
  version?: string
}

type PolicyEmbeddingGenerator = (text: string) => Promise<number[]>
type ElasticsearchClientProvider = () => ReturnType<typeof ElasticsearchConfig.getInstance>

class PolicyRetrievalService {
  constructor(
    private readonly clientProvider: ElasticsearchClientProvider = () => ElasticsearchConfig.getInstance(),
    private readonly embeddingGenerator: PolicyEmbeddingGenerator = generateOpenAiEmbedding
  ) {}

  async search(query: string, limit: number): Promise<PolicyChunkSearchDocument[]> {
    const queryVector = await this.embeddingGenerator(query.trim())
    const response = await this.clientProvider().search<PolicyChunkSearchDocument>({
      index: env.POLICY_SEARCH_INDEX,
      size: Math.min(Math.max(limit, 1), 10),
      query: {
        script_score: {
          query: {
            bool: {
              filter: [{ term: { status: 'active' } }]
            }
          },
          script: {
            source: "cosineSimilarity(params.queryVector, 'embedding') + 1.0",
            params: {
              queryVector
            }
          }
        }
      }
    })

    return response.hits.hits
      .map((hit) => hit._source)
      .filter((source): source is PolicyChunkSearchDocument => Boolean(source && source.status === 'active'))
  }
}

const policyRetrievalService = new PolicyRetrievalService()
export default policyRetrievalService
export { PolicyRetrievalService }
