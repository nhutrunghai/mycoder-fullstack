import { Router } from 'express'
import { UserRole } from '~/constants/enums.js'
import {
  getAdminRagChatConfigController,
  getAdminRagChatHealthController,
  rotateAdminRagChatSecretsController,
  updateAdminRagChatConfigController,
  testAdminRagChatConnectionController
} from '~/controllers/admin/rag-chat.controller.js'
import { adminAuthMiddleware } from '~/middlewares/admin/auth.middleware.js'
import { authorizeAdmin } from '~/middlewares/admin/authorization.middleware.js'
import { adminLimiter, paymentLimiter } from '~/middlewares/common/rate-limit.middleware.js'
import validate from '~/middlewares/common/validator.middleware.js'
import {
  rotateAdminRagChatSecretsValidator,
  updateAdminRagChatConfigValidator,
  testAdminRagChatConnectionValidator
} from '~/validators/admin/rag-chat.validator.js'

const adminRagChatRouter = Router()

adminRagChatRouter.get('/config', adminAuthMiddleware, authorizeAdmin([UserRole.ADMIN]), getAdminRagChatConfigController)
adminRagChatRouter.patch(
  '/config',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  adminLimiter,
  validate(updateAdminRagChatConfigValidator),
  updateAdminRagChatConfigController
)
adminRagChatRouter.patch(
  '/secrets',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  paymentLimiter,
  validate(rotateAdminRagChatSecretsValidator),
  rotateAdminRagChatSecretsController
)
adminRagChatRouter.get('/health', adminAuthMiddleware, authorizeAdmin([UserRole.ADMIN]), getAdminRagChatHealthController)

adminRagChatRouter.post(
  '/test-connection',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  adminLimiter,
  validate(testAdminRagChatConnectionValidator),
  testAdminRagChatConnectionController
)

export default adminRagChatRouter
