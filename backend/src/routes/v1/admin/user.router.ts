import { Router } from 'express'
import { UserRole } from '~/constants/enums.js'
import {
  getAdminUserTopUpOrdersController,
  getAdminUserApplicationsController,
  getAdminUserDetailController,
  getAdminUserWalletController,
  getAdminUsersController,
  updateAdminUserStatusController,
  updateAdminUserRoleController
} from '~/controllers/admin/user.controller.js'
import { adminAuthMiddleware } from '~/middlewares/admin/auth.middleware.js'
import { authorizeAdmin } from '~/middlewares/admin/authorization.middleware.js'
import { findAdminUserByIdOrThrow } from '~/middlewares/admin/user.middleware.js'
import { adminLimiter } from '~/middlewares/common/rate-limit.middleware.js'
import validate from '~/middlewares/common/validator.middleware.js'
import {
  getAdminUserDetailValidator,
  getAdminUserTopUpOrdersValidator,
  getAdminUserApplicationsValidator,
  getAdminUsersValidator,
  getAdminUserWalletValidator,
  updateAdminUserStatusValidator,
  updateAdminUserRoleValidator
} from '~/validators/admin/user.validator.js'

const adminUserRouter = Router()

adminUserRouter.get(
  '/',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminUsersValidator),
  getAdminUsersController
)

adminUserRouter.get(
  '/:userId',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminUserDetailValidator),
  findAdminUserByIdOrThrow,
  getAdminUserDetailController
)

adminUserRouter.get(
  '/:userId/wallet',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminUserWalletValidator),
  findAdminUserByIdOrThrow,
  getAdminUserWalletController
)

adminUserRouter.get(
  '/:userId/wallet-topup-orders',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminUserTopUpOrdersValidator),
  findAdminUserByIdOrThrow,
  getAdminUserTopUpOrdersController
)

adminUserRouter.get(
  '/:userId/applications',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  validate(getAdminUserApplicationsValidator),
  findAdminUserByIdOrThrow,
  getAdminUserApplicationsController
)


adminUserRouter.patch(
  '/:userId/status',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  adminLimiter,
  validate(updateAdminUserStatusValidator),
  findAdminUserByIdOrThrow,
  updateAdminUserStatusController
)

adminUserRouter.patch(
  '/:userId/role',
  adminAuthMiddleware,
  authorizeAdmin([UserRole.ADMIN]),
  adminLimiter,
  validate(updateAdminUserRoleValidator),
  findAdminUserByIdOrThrow,
  updateAdminUserRoleController
)

export default adminUserRouter