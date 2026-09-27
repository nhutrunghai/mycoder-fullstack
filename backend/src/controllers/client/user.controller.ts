import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import UserMessages from '~/constants/messages/index'
import { AppError } from '~/errors/app-error'
import { GetUserRqType, newPasswordRqType, UpdateUserAvatarRqType } from '~/types/http/request.type'
import userService from '~/services/client/users.service'
import { ObjectId } from 'mongodb'
import env from '~/configs/env.config'
import { OtpType, TemplateResendId } from '~/constants/enums'
import { generateOtpChangePassword, generateToken } from '~/utils/crypto.utils'
import ms, { StringValue } from 'ms'
import databaseService from '~/configs/database.config'
import resendProvider from '~/providers/resend.provider'
import { UserLocals } from '~/types/http/response.type'
import User from '~/models/schema/client/user.schema'
import { ParamsDictionary } from 'express-serve-static-core'
import { hashPassword } from '~/utils/crypto.utils'
import { attachUserAvatarUrl } from '~/utils/avatar.util.js'
export const getProfileMeController = async (req: Request, res: Response) => {
  const projection = {
    username: 1,
    fullName: 1,
    avatar_file_key: 1
  }
  const user = await userService.findUser('_id', new ObjectId(req.decodeToken?.userId as string), projection)
  return res.status(StatusCodes.OK).json({ status: 'success', data: attachUserAvatarUrl(user) })
}
export const getProfileUserController = async (req: Request<GetUserRqType>, res: Response) => {
  const projection = { email: 0, password: 0, is_verified: 0, role: 0, updated_at: 0, phone: 0, avatar: 0 }
  const user = await userService.findUser('username', req.params.id, projection)
  if (!user || user.status === 2) {
    throw new AppError({ statusCode: StatusCodes.NOT_FOUND, message: UserMessages.USER_NOT_FOUND })
  }
  delete user.status
  return res.status(StatusCodes.OK).json({ status: 'success', data: attachUserAvatarUrl(user) })
}
export const updateProfileUserController = async (req: Request, res: Response) => {
  await userService.updateProfile(req.decodeToken?.userId as string, req.body)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.USER_UPDATE_SUCCESS
  })
}
export const updateUserAvatarController = async (
  req: Request<ParamsDictionary, any, UpdateUserAvatarRqType>,
  res: Response
) => {
  await userService.updateAvatar(req.decodeToken?.userId as string, req.body)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Cập nhật avatar thành công'
  })
}
export const getSettingUserController = async (req: Request, res: Response) => {
  const projection = {
    username: 1,
    email: 1,
    phone: 1,
    is_verified: 1
  }
  const user = await userService.findUser('_id', new ObjectId(req.decodeToken?.userId as string), projection)
  return res.status(StatusCodes.OK).json({ status: 'success', data: user })
}
export const updateSettingUserController = async (req: Request, res: Response) => {
  await userService.updateProfile(req.decodeToken?.userId as string, req.body)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.SETTING_USER_UPDATE_SUCCESS
  })
}
export const resendMailController = async (req: Request, res: Response<any, UserLocals>) => {
  const userId = req.decodeToken?.userId as string
  const { rawToken, hashedToken } = generateToken()
  const ttl = ms(env.ExpiresIn_EMAIL_VERIFY_TOKEN as StringValue) as number
  const payloadOtp = {
    user_id: new ObjectId(userId),
    code: hashedToken,
    type: OtpType.VERIFY_EMAIL,
    expires_at: new Date(Date.now() + ttl)
  }
  await userService.handlerOtpCode(userId, payloadOtp, OtpType.UPDATE_EMAIL)
  const payloadSendVerify = {
    from: `${env.MAIL_FROM_NAME} <noti@${env.MAIL_FROM_ADDRESS}>`,
    to: res.locals.user.email,
    variables: {
      fullName: res.locals.user.fullName,
      verify_url: `${env.FRONTEND_URL}/verify-email?email_verify_token=${rawToken}`
    }
  }
  if (env.NODE_ENV === 'production') {
    await resendProvider.sendWithTemplate(TemplateResendId.VERIFY_EMAIL, [payloadSendVerify])
  }
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.EMAIL_RESEND_SUCCESS
  })
}
export const changePasswordController = async (req: Request, res: Response<any, UserLocals>) => {
  const userId = req.decodeToken?.userId as string
  const user = (await databaseService.users.findOne({ _id: new ObjectId(userId) })) as User
  const otpCode = generateOtpChangePassword()
  const ttl = ms(env.ExpiresIn_FORGOT_PASSWORD_TOKEN as StringValue) as number
  const payloadOtp = {
    user_id: new ObjectId(userId),
    code: otpCode,
    type: OtpType.CHANGE_PASSWORD,
    expires_at: new Date(Date.now() + ttl)
  }
  await userService.handlerOtpCode(userId, payloadOtp, OtpType.CHANGE_PASSWORD)
  const payloadSendVerify = {
    from: `${env.MAIL_FROM_NAME} <security@${env.MAIL_FROM_ADDRESS}>`,
    to: user.email,
    variables: {
      userName: user.fullName,
      otpCode: otpCode
    }
  }
  if (env.NODE_ENV === 'production') {
    await resendProvider.sendWithTemplate(TemplateResendId.CHANGE_PASSWORD, [payloadSendVerify])
  }
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.EMAIL_RESEND_SUCCESS
  })
}
export const newPasswordController = async (req: Request<ParamsDictionary, any, newPasswordRqType>, res: Response) => {
  const userId = req.decodeToken?.userId as string
  const hashedPassword = await hashPassword(req.body.newPassword)
  await userService.setNewPassword(userId, hashedPassword, req.body.OtpCode)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.FORGOT_PASSWORD_SUCCESS
  })
}
