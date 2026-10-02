import { Router } from 'express'
import { UserRole } from '~/constants/enums.js'
import {
  getAdminJobApplicationsController,
  getAdminJobDetailController,
  getAdminJobsController,
  updateAdminJobModerationStatusController
} from '~/controllers/admin/job.controller.js'
import { adminAuthMiddleware } from '~/middlewares/admin/auth.middleware.js'
import { authorizeAdmin } from '~/middlewares/admin/authorization.middleware.js'
import { findAdminJobByIdOrThrow } from '~/middlewares/admin/job.middleware.js'
import { adminLimiter } from '~/middlewares/common/rate-limit.middleware.js'
import validate from '~/middlewares/common/validator.middleware.js'
import {
  getAdminJobApplicationsValidator,
  getAdminJobDetailValidator,
  getAdminJobsValidator,
  updateAdminJobModerationStatusValidator
} from '~/validators/admin/job.validator.js'

const adminJobRouter = Router()

adminJobRouter.get(
  '/',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminJobsValidator),
  getAdminJobsController
)

adminJobRouter.get(
  '/:jobId',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminJobDetailValidator),
  findAdminJobByIdOrThrow,
  getAdminJobDetailController
)

adminJobRouter.patch(
  '/:jobId/moderation-status',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  adminLimiter,
  validate(updateAdminJobModerationStatusValidator),
  findAdminJobByIdOrThrow,
  updateAdminJobModerationStatusController
)


adminJobRouter.get(
  '/:jobId/applications',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminJobApplicationsValidator),
  findAdminJobByIdOrThrow,
  getAdminJobApplicationsController
)

export default adminJobRouter
