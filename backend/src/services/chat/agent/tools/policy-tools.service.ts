import { AgentToolArguments } from '~/services/chat/agent/tools/tool-arguments.schema.js'
import policyRetrievalService, {
  PolicyChunkSearchDocument
} from '~/services/chat/retrieval/policy-retrieval.service.js'
import { AgentToolExecutionContext } from './job-tools.service.js'

type SearchPolicyArguments = AgentToolArguments['search_policy_documents']

export type SafePolicySearchResult = {
  policy_document_id: string
  chunk_id: string
  chunk_index: number
  title: string
  snippet: string
  source_url?: string
  version?: string
}

export type PolicyToolExecutionResult = {
  tool: 'search_policy_documents'
  data: {
    items: SafePolicySearchResult[]
    limit: number
  }
  sources: Array<{
    type: 'policy'
    id: string
    title: string
  }>
}

const MAX_POLICY_RESULTS = 10
const MAX_SNIPPET_LENGTH = 500

function toSafePolicyResult(document: PolicyChunkSearchDocument): SafePolicySearchResult {
  const snippet = document.text.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_LENGTH)

  return {
    policy_document_id: document.policy_document_id,
    chunk_id: document.chunk_id,
    chunk_index: document.chunk_index,
    title: document.title,
    snippet,
    source_url: document.source_url,
    version: document.version
  }
}

export class AgentPolicyToolsService {
  constructor(private readonly retrievalService = policyRetrievalService) {}

  async searchPolicyDocuments(
    args: SearchPolicyArguments,
    _context: AgentToolExecutionContext
  ): Promise<PolicyToolExecutionResult> {
    const limit = Math.min(args.limit ?? MAX_POLICY_RESULTS, MAX_POLICY_RESULTS)
    const documents = await this.retrievalService.search(args.query, limit)
    const items = documents.slice(0, limit).map(toSafePolicyResult)

    return {
      tool: 'search_policy_documents',
      data: {
        items,
        limit
      },
      sources: items.map((item) => ({
        type: 'policy',
        id: item.policy_document_id,
        title: item.title
      }))
    }
  }
}

const agentPolicyToolsService = new AgentPolicyToolsService()
export default agentPolicyToolsService
