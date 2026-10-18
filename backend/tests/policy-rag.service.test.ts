import { ObjectId } from 'mongodb'

jest.mock('../src/configs/env.config.js', () => ({
  __esModule: true,
  default: {
    POLICY_SEARCH_INDEX: 'policy_documents_chunks',
    RESUME_EMBEDDING_DIMS: 1536,
    OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
    OPENAI_API_TIMEOUT_MS: 30000,
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_API_KEY: 'test-key',
    EMBEDDING_API_URL: 'http://localhost:8000',
    GEMINI_API_KEY: undefined
  }
}))

jest.mock('../src/configs/search.config.js', () => ({
  __esModule: true,
  POLICY_EMBEDDING_DIMS: 1536
}))

import { POLICY_EMBEDDING_DIMS } from '../src/configs/search.config.js'
import PolicyDocument from '../src/models/schema/system/policyDocuments.schema.js'
import { AgentPolicyToolsService } from '../src/services/chat/agent/tools/policy-tools.service.js'
import { PolicyIngestionService } from '../src/services/chat/ingestion/policy-ingestion.service.js'
import { PolicyIndexService } from '../src/services/chat/indexing/policy-index.service.js'
import { PolicyRetrievalService } from '../src/services/chat/retrieval/policy-retrieval.service.js'

const policyDocumentId = '507f1f77bcf86cd799439011'

describe('policy RAG services', () => {
  it('filters archived chunks at Elasticsearch query and result boundaries', async () => {
    const embeddingGenerator = jest.fn().mockResolvedValue(Array(POLICY_EMBEDDING_DIMS).fill(0.1))
    const search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              policy_document_id: policyDocumentId,
              chunk_id: `${policyDocumentId}:0`,
              chunk_index: 0,
              title: 'Quy dinh bao hiem',
              text: 'Noi dung dang hieu luc',
              status: 'active'
            }
          },
          {
            _source: {
              policy_document_id: '507f1f77bcf86cd799439012',
              chunk_id: '507f1f77bcf86cd799439012:0',
              chunk_index: 0,
              title: 'Quy dinh cu',
              text: 'Noi dung da luu tru',
              status: 'archived'
            }
          }
        ]
      }
    })
    const service = new PolicyRetrievalService(() => ({ search } as never), embeddingGenerator)

    await expect(service.search('bao hiem', 20)).resolves.toEqual([
      {
        policy_document_id: policyDocumentId,
        chunk_id: `${policyDocumentId}:0`,
        chunk_index: 0,
        title: 'Quy dinh bao hiem',
        text: 'Noi dung dang hieu luc',
        status: 'active'
      }
    ])
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 10,
        query: expect.objectContaining({
          script_score: expect.objectContaining({
            query: { bool: { filter: [{ term: { status: 'active' } }] } }
          })
        })
      })
    )
  })

  it('caps policy tool results and exposes only safe snippets', async () => {
    const longText = `${'Noi dung chinh sach '.repeat(80)}private-embedding-value`
    const documents = Array.from({ length: 12 }, (_, index) => ({
      policy_document_id: policyDocumentId,
      chunk_id: `${policyDocumentId}:${index}`,
      chunk_index: index,
      title: 'Quy dinh bao hiem',
      text: longText,
      source_url: 'https://example.com/policy',
      version: '2026.10',
      status: 'active',
      embedding: [0.1, 0.2],
      internal_note: 'must not leak'
    }))
    const search = jest.fn().mockResolvedValue(documents)
    const service = new AgentPolicyToolsService({ search } as never)

    const result = await service.searchPolicyDocuments({ query: 'bao hiem', limit: 99 } as never, {
      user_id: '507f1f77bcf86cd799439013'
    })

    expect(search).toHaveBeenCalledWith('bao hiem', 10)
    expect(result.data.limit).toBe(10)
    expect(result.data.items).toHaveLength(10)
    expect(result.data.items[0]).toEqual({
      policy_document_id: policyDocumentId,
      chunk_id: `${policyDocumentId}:0`,
      chunk_index: 0,
      title: 'Quy dinh bao hiem',
      snippet: expect.any(String),
      source_url: 'https://example.com/policy',
      version: '2026.10'
    })
    expect(result.data.items[0].snippet.length).toBeLessThanOrEqual(500)
    expect(JSON.stringify(result)).not.toContain('private-embedding-value')
    expect(JSON.stringify(result)).not.toContain('internal_note')
  })

  it('deletes previous chunks before indexing active policy chunks', async () => {
    const calls: string[] = []
    const deletePolicyChunks = jest.fn().mockImplementation(async () => calls.push('delete'))
    const indexPolicyChunks = jest.fn().mockImplementation(async () => {
      calls.push('index')
      return { indexed: 1 }
    })
    const ingestion = new PolicyIngestionService({ deletePolicyChunks, indexPolicyChunks } as never)
    const document = new PolicyDocument({
      _id: new ObjectId(policyDocumentId),
      title: 'Quy dinh bao hiem',
      content: 'Noi dung chinh sach dang hieu luc.',
      source_url: 'https://example.com/policy',
      status: 'active',
      version: '2026.10',
      created_at: new Date('2026-10-01T00:00:00.000Z'),
      updated_at: new Date('2026-10-10T00:00:00.000Z')
    })

    await expect(ingestion.ingestPolicyDocument(document)).resolves.toEqual({
      status: 'completed',
      chunks_indexed: 1
    })

    expect(calls).toEqual(['delete', 'index'])
    expect(deletePolicyChunks).toHaveBeenCalledWith(policyDocumentId)
    expect(indexPolicyChunks).toHaveBeenCalledWith([
      expect.objectContaining({
        policy_document_id: policyDocumentId,
        chunk_id: `${policyDocumentId}:0`,
        status: 'active',
        version: '2026.10',
        source_url: 'https://example.com/policy'
      })
    ])
  })

  it('indexes policy chunks with the configured embedding shape', async () => {
    const bulk = jest.fn().mockResolvedValue({ errors: false })
    const embeddingGenerator = jest.fn().mockResolvedValue(Array(POLICY_EMBEDDING_DIMS).fill(0.1))
    const indexService = new PolicyIndexService(() => ({ bulk } as never), embeddingGenerator)

    await expect(
      indexService.indexPolicyChunks([
        {
          policy_document_id: policyDocumentId,
          chunk_id: `${policyDocumentId}:0`,
          chunk_index: 0,
          title: 'Quy dinh bao hiem',
          text: 'Noi dung dang hieu luc',
          status: 'active',
          created_at: new Date('2026-10-01T00:00:00.000Z'),
          updated_at: new Date('2026-10-10T00:00:00.000Z')
        }
      ])
    ).resolves.toEqual({ indexed: 1 })

    expect(bulk).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            embedding_model: expect.any(String),
            embedding: Array(POLICY_EMBEDDING_DIMS).fill(0.1),
            status: 'active'
          })
        ])
      })
    )
  })

  it('propagates retrieval failures instead of returning an empty result', async () => {
    const service = new PolicyRetrievalService(
      () => ({
        search: jest.fn().mockRejectedValue(new Error('Elasticsearch unavailable'))
      }) as never,
      jest.fn().mockResolvedValue(Array(POLICY_EMBEDDING_DIMS).fill(0.1))
    )

    await expect(service.search('bao hiem', 5)).rejects.toThrow('Elasticsearch unavailable')
  })
})
