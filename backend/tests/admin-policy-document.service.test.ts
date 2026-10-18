import { ObjectId } from 'mongodb'

const mockInsertOne = jest.fn()
const mockFindOne = jest.fn()
const mockUpdateOne = jest.fn()
const mockDeleteOne = jest.fn()
const mockCountDocuments = jest.fn()
const mockToArray = jest.fn()
const mockFind = jest.fn()
const mockIngestPolicyDocument = jest.fn()
const mockReindexPolicyDocument = jest.fn()
const mockRemovePolicyDocument = jest.fn()

jest.mock('../src/configs/database.config.js', () => ({
  __esModule: true,
  default: {
    policyDocuments: {
      insertOne: mockInsertOne,
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
      deleteOne: mockDeleteOne,
      countDocuments: mockCountDocuments,
      find: mockFind
    }
  }
}))

jest.mock('../src/services/chat/ingestion/policy-ingestion.service.js', () => ({
  __esModule: true,
  default: {
    ingestPolicyDocument: mockIngestPolicyDocument,
    reindexPolicyDocument: mockReindexPolicyDocument,
    removePolicyDocument: mockRemovePolicyDocument
  }
}))

import adminPolicyDocumentService from '../src/services/admin/policy-document.service.js'
import {
  createAdminPolicyDocumentValidator,
  getAdminPolicyDocumentsValidator,
  updateAdminPolicyDocumentValidator
} from '../src/validators/admin/policy-document.validator.js'

const documentId = new ObjectId('507f1f77bcf86cd799439011')
const activeDocument = {
  _id: documentId,
  title: 'Chính sách bảo hiểm',
  content: 'Nội dung chính sách đang hiệu lực.',
  source_url: 'https://example.com/policy',
  version: '2026.10',
  status: 'active' as const,
  created_at: new Date('2026-10-01T00:00:00.000Z'),
  updated_at: new Date('2026-10-01T00:00:00.000Z')
}

describe('admin policy document lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInsertOne.mockResolvedValue({ insertedId: documentId })
    mockUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
    mockIngestPolicyDocument.mockResolvedValue({ status: 'completed', chunks_indexed: 1 })
    mockReindexPolicyDocument.mockResolvedValue({ status: 'completed', chunks_indexed: 1 })
    mockRemovePolicyDocument.mockResolvedValue({})
  })

  it('creates Mongo document then indexes it before returning searchable success', async () => {
    mockFindOne.mockResolvedValueOnce(activeDocument)

    await expect(
      adminPolicyDocumentService.createDocument({
        title: 'Chính sách bảo hiểm',
        content: 'Nội dung chính sách đang hiệu lực.',
        source_url: 'https://example.com/policy',
        version: '2026.10',
        status: 'active'
      })
    ).resolves.toEqual(activeDocument)

    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: undefined,
        title: 'Chính sách bảo hiểm',
        content: 'Nội dung chính sách đang hiệu lực.',
        status: 'active'
      })
    )
    expect(mockIngestPolicyDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: documentId,
        status: 'active'
      })
    )
  })

  it('compensates create when ingestion fails so the new document has no searchable chunks', async () => {
    mockIngestPolicyDocument.mockRejectedValueOnce(new Error('Elasticsearch unavailable'))

    await expect(
      adminPolicyDocumentService.createDocument({
        title: 'Chính sách bảo hiểm',
        content: 'Nội dung chính sách đang hiệu lực.',
        status: 'active'
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Không thể lập chỉ mục tài liệu chính sách'
    })

    expect(mockRemovePolicyDocument).toHaveBeenCalledWith(String(documentId))
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: documentId })
  })

  it('removes chunks before archiving so stale active content is not searchable', async () => {
    const archivedDocument = { ...activeDocument, status: 'archived' as const }
    mockFindOne.mockResolvedValueOnce(activeDocument).mockResolvedValueOnce(archivedDocument)

    await expect(
      adminPolicyDocumentService.updateDocument(documentId, {
        status: 'archived'
      })
    ).resolves.toEqual(archivedDocument)

    expect(mockRemovePolicyDocument).toHaveBeenCalledWith(String(documentId))
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: documentId },
      {
        $set: expect.objectContaining({
          status: 'archived',
          content: activeDocument.content
        })
      }
    )
    expect(mockReindexPolicyDocument).not.toHaveBeenCalled()
  })

  it('reindexes active document updates and restores the old index when reindexing fails', async () => {
    mockFindOne.mockResolvedValueOnce(activeDocument)
    mockReindexPolicyDocument.mockRejectedValueOnce(new Error('Elasticsearch unavailable'))

    await expect(
      adminPolicyDocumentService.updateDocument(documentId, {
        content: 'Nội dung chính sách mới.'
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Không thể cập nhật và lập chỉ mục tài liệu chính sách'
    })

    expect(mockReindexPolicyDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Nội dung chính sách mới.',
        status: 'active'
      })
    )
    expect(mockRemovePolicyDocument).toHaveBeenCalledWith(String(documentId))
    expect(mockIngestPolicyDocument).toHaveBeenCalledWith(activeDocument)
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('deletes chunks before deleting Mongo document and restores chunks if Mongo deletion fails', async () => {
    mockFindOne.mockResolvedValueOnce(activeDocument)
    mockDeleteOne.mockRejectedValueOnce(new Error('MongoDB unavailable'))

    await expect(adminPolicyDocumentService.deleteDocument(documentId)).rejects.toThrow('MongoDB unavailable')

    expect(mockRemovePolicyDocument).toHaveBeenCalledWith(String(documentId))
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: documentId })
    expect(mockIngestPolicyDocument).toHaveBeenCalledWith(activeDocument)
  })

  it('uses database pagination and omits full content from list results', async () => {
    const cursor = {
      toArray: mockToArray
    }
    mockFind.mockReturnValue(cursor)
    mockToArray.mockResolvedValue([
      {
        _id: documentId,
        title: activeDocument.title,
        status: 'active',
        updated_at: activeDocument.updated_at
      }
    ])
    mockCountDocuments.mockResolvedValue(11)

    await expect(
      adminPolicyDocumentService.listDocuments({
        keyword: 'bảo hiểm',
        page: 2,
        limit: 5
      })
    ).resolves.toEqual({
      documents: [
        {
          _id: documentId,
          title: activeDocument.title,
          status: 'active',
          updated_at: activeDocument.updated_at
        }
      ],
      pagination: {
        page: 2,
        limit: 5,
        total: 11,
        total_pages: 3
      }
    })

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.any(Array)
      }),
      expect.objectContaining({
        projection: { content: 0 },
        skip: 5,
        limit: 5
      })
    )
  })
})

describe('admin policy document validation', () => {
  it('trims valid text input and rejects invalid source URLs', () => {
    expect(
      createAdminPolicyDocumentValidator.parse({
        body: {
          title: '  Chính sách  ',
          content: '  Nội dung  ',
          source_url: 'https://example.com/policy'
        }
      }).body
    ).toEqual({
      title: 'Chính sách',
      content: 'Nội dung',
      source_url: 'https://example.com/policy',
      status: 'active'
    })

    expect(() =>
      createAdminPolicyDocumentValidator.parse({
        body: {
          title: 'Chính sách',
          content: 'Nội dung',
          source_url: 'not-a-url'
        }
      })
    ).toThrow()
  })

  it('validates paginated list queries and requires an update field', () => {
    expect(
      getAdminPolicyDocumentsValidator.parse({
        query: { page: '2', limit: '25', status: 'active' }
      }).query
    ).toEqual({
      page: 2,
      limit: 25,
      status: 'active'
    })

    expect(() =>
      updateAdminPolicyDocumentValidator.parse({
        params: { documentId: String(documentId) },
        body: {}
      })
    ).toThrow()
  })
})
