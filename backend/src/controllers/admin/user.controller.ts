import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import {
  AdminAuditAction,
  AdminAuditTargetType,
  UserRole,
  UserStatus,
  WalletTopUpOrderStatus
} from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'
import { AppError } from '~/errors/app-error.js'
import { AdminUserLocals } from '~/types/http/response.type.js'
import adminAuditLogService from '~/services/admin/audit-log.service.js'
import adminUserService from '~/services/admin/user.service.js'
import { buildUploadThingFileUrl } from '~/utils/avatar.util.js'

export const getAdminUsersController = async (req: Request, res: Response) => {
  const role =
    req.query.role !== undefined && req.query.role !== '' ? (Number(req.query.role) as UserRole) : undefined
  const status =
    req.query.status !== undefined && req.query.status !== '' ? (Number(req.query.status) as UserStatus) : undefined
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined
  const userId =
    (typeof req.query.userId === 'string' && req.query.userId) ||
    (typeof req.query.user_id === 'string' && req.query.user_id) ||
    undefined
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)

  const result = await adminUserService.getUsers({
    userId: userId ? new ObjectId(userId) : undefined,
    role,
    status,
    keyword,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      users: result.users.map((user) => ({
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        avatar: buildUploadThingFileUrl(user.avatar_file_key),
        role: user.role,
        status: user.status,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      })),
      stats: result.stats,
      pagination: result.pagination
    }
  })
}

export const getAdminUserDetailController = async (
  req: Request,
  res: Response<unknown, AdminUserLocals>
) => {
  const user = res.locals.adminUser
  let company = null
  if (user.role === UserRole.EMPLOYER) {
    const foundCompany = await adminUserService.getUserEmployerCompany(user._id!)
    if (foundCompany) {
      company = {
        _id: foundCompany._id,
        company_name: foundCompany.company_name,
        logo: buildUploadThingFileUrl(foundCompany.logo_file_key) || foundCompany.logo || '',
        address: foundCompany.address,
        website: foundCompany.website,
        verified: foundCompany.verified
      }
    }
  }

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      avatar: buildUploadThingFileUrl(user.avatar_file_key),
      phone: user.phone,
      bio: user.bio,
      address: user.address,
      skills: user.skills,
      role: user.role,
      status: user.status,
      is_verified: user.is_verified,
      company,
      created_at: user.created_at,
      updated_at: user.updated_at
    }
  })
}

export const getAdminUserApplicationsController = async (
  req: Request,
  res: Response<unknown, AdminUserLocals>
) => {
  const user = res.locals.adminUser
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 20)

  const result = await adminUserService.getUserApplicationsForAdmin({
    userId: user._id!,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: result
  })
}

export const getAdminUserWalletController = async (
  req: Request,
  res: Response<unknown, AdminUserLocals>
) => {
  const user = res.locals.adminUser
  const wallet = await adminUserService.getUserWallet(user._id!)

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        avatar: buildUploadThingFileUrl(user.avatar_file_key),
        role: user.role,
        status: user.status,
        is_verified: user.is_verified
      },
      wallet
    }
  })
}

export const getAdminUserTopUpOrdersController = async (
  req: Request,
  res: Response<unknown, AdminUserLocals>
) => {
  const user = res.locals.adminUser
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const status = req.query.status as WalletTopUpOrderStatus | undefined

  const result = await adminUserService.getUserTopUpOrdersForAdmin({
    userId: user._id!,
    status,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        avatar: buildUploadThingFileUrl(user.avatar_file_key),
        role: user.role,
        status: user.status,
        is_verified: user.is_verified
      },
      orders: result.orders,
      pagination: result.pagination
    }
  })
}

export const updateAdminUserStatusController = async (
  req: Request<any, any, { status: UserStatus }>,
  res: Response<unknown, AdminUserLocals>
) => {
  const targetUser = res.locals.adminUser
  const nextStatus = req.body.status
  const currentAdmin = req.user

  if (
    currentAdmin?._id &&
    String(currentAdmin._id) === String(targetUser._id) &&
    nextStatus === UserStatus.BANNED
  ) {
    throw new AppError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: UserMessages.INVALID_DATA
    })
  }

  const updatedUser =
    targetUser.status === nextStatus
      ? targetUser
      : await adminUserService.updateUserStatus(targetUser._id!, nextStatus)

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.USER_STATUS_UPDATE,
    targetType: AdminAuditTargetType.USER,
    targetId: targetUser._id,
    statusCode: StatusCodes.OK,
    metadata: {
      previous_status: targetUser.status,
      next_status: nextStatus
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.USER_UPDATE_SUCCESS,
    data: {
      _id: updatedUser?._id,
      status: updatedUser?.status,
      updated_at: updatedUser?.updated_at
    }
  })
}

export const updateAdminUserRoleController = async (
  req: Request<any, any, { role: UserRole }>,
  res: Response<unknown, AdminUserLocals>
) => {
  const targetUser = res.locals.adminUser
  const nextRole = Number(req.body.role) as UserRole
  const currentAdmin = req.user

  if (
    currentAdmin?._id &&
    String(currentAdmin._id) === String(targetUser._id) &&
    nextRole !== UserRole.ADMIN
  ) {
    throw new AppError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Bạn không thể tự thu hồi quyền Quản trị viên của chính mình.'
    })
  }

  let finalRole = nextRole
  if (nextRole !== UserRole.ADMIN) {
    const company = await databaseService.companies.findOne({ user_id: targetUser._id })
    finalRole = company ? UserRole.EMPLOYER : UserRole.CANDIDATE
  }

  const updatedUser =
    targetUser.role === finalRole
      ? targetUser
      : await adminUserService.updateUserRole(targetUser._id!, finalRole)

  await adminAuditLogService.create({
    req,
    action: AdminAuditAction.USER_ROLE_UPDATE,
    targetType: AdminAuditTargetType.USER,
    targetId: targetUser._id,
    statusCode: StatusCodes.OK,
    metadata: {
      previous_role: targetUser.role,
      next_role: finalRole
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Cập nhật phân quyền người dùng thành công.',
    data: {
      _id: updatedUser?._id,
      role: updatedUser?.role,
      updated_at: updatedUser?.updated_at
    }
  })
}