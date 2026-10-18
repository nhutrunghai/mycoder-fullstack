import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import databaseService from '~/configs/database.config.js'
import { AppError } from '~/errors/app-error.js'
import PolicyDocument, { PolicyDocumentStatus } from '~/models/schema/system/policyDocuments.schema.js'
import policyIngestionService from '~/services/chat/ingestion/policy-ingestion.service.js'

type PolicyDocumentInput = {
  title: string
  content: string
  source_url?: string
  version?: string
  status: PolicyDocumentStatus
}

type PolicyDocumentUpdate = Partial<PolicyDocumentInput>

const notFoundError = () =>
  new AppError({
    statusCode: StatusCodes.NOT_FOUND,
    message: 'Không tìm thấy tài liệu chính sách'
  })

class AdminPolicyDocumentService {
  async listDocuments({
    keyword,
    status,
    page,
    limit
  }: {
    keyword?: string
    status?: PolicyDocumentStatus
    page: number
    limit: number
  }) {
    const query: {
      status?: PolicyDocumentStatus
      $or?: Array<Record<string, unknown>>
    } = {}

    if (status) query.status = status
    if (keyword) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { version: { $regex: escaped, $options: 'i' } }
      ]
    }

    const [documents, total] = await Promise.all([
      databaseService.policyDocuments
        .find(query, {
          projection: {
            content: 0
          },
          sort: { updated_at: -1 },
          skip: (page - 1) * limit,
          limit
        })
        .toArray(),
      databaseService.policyDocuments.countDocuments(query)
    ])

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async getDocumentById(documentId: ObjectId) {
    const document = await databaseService.policyDocuments.findOne({ _id: documentId })
    if (!document) throw notFoundError()
    return document
  }

  async createDocument(input: PolicyDocumentInput) {
    const normalized = this.normalizeInput(input)
    const document = new PolicyDocument({
      title: normalized.title!,
      content: normalized.content!,
      source_url: normalized.source_url,
      version: normalized.version,
      status: normalized.status!
    })
    const result = await databaseService.policyDocuments.insertOne(document)
    const saved = new PolicyDocument({ ...document, _id: result.insertedId })

    try {
      const ingestion = await policyIngestionService.ingestPolicyDocument(saved)
      if (ingestion.status !== 'completed' || ingestion.chunks_indexed < 1) {
        throw new Error('Tài liệu chính sách không có nội dung để lập chỉ mục')
      }
      return this.getDocumentById(result.insertedId)
    } catch (error) {
      await policyIngestionService.removePolicyDocument(String(result.insertedId)).catch(() => undefined)
      await databaseService.policyDocuments.deleteOne({ _id: result.insertedId })
      throw new AppError({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Không thể lập chỉ mục tài liệu chính sách'
      })
    }
  }

  async updateDocument(documentId: ObjectId, input: PolicyDocumentUpdate) {
    const current = await this.getDocumentById(documentId)
    const next = new PolicyDocument({
      ...current,
      ...this.normalizeInput(input),
      _id: documentId,
      updated_at: new Date()
    })

    if (next.status === 'archived') {
      await policyIngestionService.removePolicyDocument(String(documentId))
      try {
        await databaseService.policyDocuments.updateOne(
          { _id: documentId },
          { $set: this.toPersistedFields(next) }
        )
      } catch (error) {
        await policyIngestionService.ingestPolicyDocument(current).catch(() => undefined)
        throw error
      }
      return this.getDocumentById(documentId)
    }

    try {
      const ingestion = await policyIngestionService.reindexPolicyDocument(next)
      if (ingestion.status !== 'completed' || ingestion.chunks_indexed < 1) {
        throw new Error('Tài liệu chính sách không có nội dung để lập chỉ mục')
      }
      await databaseService.policyDocuments.updateOne(
        { _id: documentId },
        { $set: this.toPersistedFields(next) }
      )
      return this.getDocumentById(documentId)
    } catch (error) {
      await policyIngestionService.removePolicyDocument(String(documentId)).catch(() => undefined)
      await policyIngestionService.ingestPolicyDocument(current).catch(() => undefined)
      throw new AppError({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Không thể cập nhật và lập chỉ mục tài liệu chính sách'
      })
    }
  }

  async deleteDocument(documentId: ObjectId) {
    const current = await this.getDocumentById(documentId)
    await policyIngestionService.removePolicyDocument(String(documentId))

    try {
      await databaseService.policyDocuments.deleteOne({ _id: documentId })
    } catch (error) {
      await policyIngestionService.ingestPolicyDocument(current).catch(() => undefined)
      throw error
    }

    return current
  }

  private normalizeInput(input: Partial<PolicyDocumentInput>) {
    return {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.content !== undefined ? { content: input.content.replaceAll('\0', ' ').trim() } : {}),
      ...(input.source_url !== undefined ? { source_url: input.source_url?.trim() || undefined } : {}),
      ...(input.version !== undefined ? { version: input.version?.trim() || undefined } : {}),
      ...(input.status !== undefined ? { status: input.status } : {})
    }
  }

  private toPersistedFields(document: PolicyDocument) {
    return {
      title: document.title,
      content: document.content,
      source_url: document.source_url,
      version: document.version,
      status: document.status,
      updated_at: document.updated_at
    }
  }
}

const adminPolicyDocumentService = new AdminPolicyDocumentService()
export default adminPolicyDocumentService
