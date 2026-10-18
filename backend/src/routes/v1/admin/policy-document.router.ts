import { Router } from 'express'
import { UserRole } from '~/constants/enums.js'
import {
  createAdminPolicyDocumentController,
  deleteAdminPolicyDocumentController,
  getAdminPolicyDocumentDetailController,
  getAdminPolicyDocumentsController,
  updateAdminPolicyDocumentController
} from '~/controllers/admin/policy-document.controller.js'
import { adminAuthMiddleware } from '~/middlewares/admin/auth.middleware.js'
import { authorizeAdmin } from '~/middlewares/admin/authorization.middleware.js'
import { adminLimiter } from '~/middlewares/common/rate-limit.middleware.js'
import validate from '~/middlewares/common/validator.middleware.js'
import {
  adminPolicyDocumentIdValidator,
  createAdminPolicyDocumentValidator,
  getAdminPolicyDocumentsValidator,
  updateAdminPolicyDocumentValidator
} from '~/validators/admin/policy-document.validator.js'

const router = Router()
router.use(adminAuthMiddleware, authorizeAdmin([UserRole.ADMIN]))
router.get('/', validate(getAdminPolicyDocumentsValidator), getAdminPolicyDocumentsController)
router.get('/:documentId', validate(adminPolicyDocumentIdValidator), getAdminPolicyDocumentDetailController)
router.post('/', adminLimiter, validate(createAdminPolicyDocumentValidator), createAdminPolicyDocumentController)
router.patch(
  '/:documentId',
  adminLimiter,
  validate(updateAdminPolicyDocumentValidator),
  updateAdminPolicyDocumentController
)
router.delete(
  '/:documentId',
  adminLimiter,
  validate(adminPolicyDocumentIdValidator),
  deleteAdminPolicyDocumentController
)

export default router
