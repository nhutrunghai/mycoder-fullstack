import { Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { AdminAuditAction, AdminAuditTargetType } from '~/constants/enums.js'
import adminAuditLogService from '~/services/admin/audit-log.service.js'
import adminPolicyDocumentService from '~/services/admin/policy-document.service.js'

export const getAdminPolicyDocumentsController = async (req: Request, res: Response) => {
  const result = await adminPolicyDocumentService.listDocuments({
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
    status: req.query.status as 'active' | 'archived' | undefined,
    page: Number(req.query.page),
    limit: Number(req.query.limit)
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: result
  })
}

export const getAdminPolicyDocumentDetailController = async (req: Request, res: Response) => {
  const document = await adminPolicyDocumentService.getDocumentById(new ObjectId(String(req.params.documentId)))
  return res.status(StatusCodes.OK).json({ status: 'success', data: document })
}

export const createAdminPolicyDocumentController = async (req: Request, res: Response) => {
  const document = await adminPolicyDocumentService.createDocument(req.body)
  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.POLICY_DOCUMENT_CREATE,
    targetType: AdminAuditTargetType.POLICY_DOCUMENT,
    targetId: document._id,
    statusCode: StatusCodes.CREATED,
    metadata: { title: document.title, status: document.status }
  })
  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Tạo tài liệu chính sách thành công',
    data: document
  })
}

export const updateAdminPolicyDocumentController = async (req: Request, res: Response) => {
  const documentId = new ObjectId(String(req.params.documentId))
  const document = await adminPolicyDocumentService.updateDocument(documentId, req.body)
  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.POLICY_DOCUMENT_UPDATE,
    targetType: AdminAuditTargetType.POLICY_DOCUMENT,
    targetId: documentId,
    statusCode: StatusCodes.OK,
    metadata: { updated_fields: Object.keys(req.body), status: document.status }
  })
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Cập nhật tài liệu chính sách thành công',
    data: document
  })
}

export const deleteAdminPolicyDocumentController = async (req: Request, res: Response) => {
  const documentId = new ObjectId(String(req.params.documentId))
  const document = await adminPolicyDocumentService.deleteDocument(documentId)
  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.POLICY_DOCUMENT_DELETE,
    targetType: AdminAuditTargetType.POLICY_DOCUMENT,
    targetId: documentId,
    statusCode: StatusCodes.OK,
    metadata: { title: document.title }
  })
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Xóa tài liệu chính sách thành công',
    data: { _id: documentId }
  })
}
