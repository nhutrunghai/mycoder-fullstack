import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { StatusCodes } from 'http-status-codes'
import env from '~/configs/env.config.js'
import { OtpType, TemplateResendId, UserRole } from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'
import { ForgotPasswordRqType, LoginRqType, RegisterRqType, ResetPasswordRqType } from '~/types/http/request.type.js'
import User from '~/models/schema/client/user.schema.js'
import type OtpCode from '~/models/schema/client/otpCodes.schema.js'
import userInfo from '~/types/auth/user-info.type.js'
import authService from '~/services/client/auth.service.js'
import { generateToken } from '~/utils/crypto.utils.js'
import { getDeviceInfo } from '~/utils/deviceInfo.util.js'
import ms, { StringValue } from 'ms'
import resendProvider from '~/providers/resend.provider.js'
import userService from '~/services/client/users.service.js'
import { VerifyOtpLocals } from '~/types/http/response.type.js'
import _ from 'lodash'
import { clearRefreshTokenCookie, setRefreshTokenCookie } from '~/utils/auth-cookie.util.js'

function storeRefreshToken(
  res: Response,
  result: { RefreshToken: string; AccessToken: string; id: unknown },
  remember = true
) {
  setRefreshTokenCookie(res, result.RefreshToken, remember)
  return {
    id: result.id,
    AccessToken: result.AccessToken
  }
}

export const RegisterController = async (req: Request<ParamsDictionary, any, RegisterRqType>, res: Response) => {
  const device_info = getDeviceInfo(req.headers['user-agent'] as string)
  req.body.role = UserRole.CANDIDATE
  const remember = req.body.remember !== false
  const result = await authService.register(req.body, device_info, remember)
  const { rawToken, hashedToken } = generateToken()
  const ttl = ms(env.ExpiresIn_EMAIL_VERIFY_TOKEN as StringValue) as number
  const payloadOtp = {
    user_id: result.id,
    code: hashedToken,
    type: OtpType.VERIFY_EMAIL,
    expires_at: new Date(Date.now() + ttl)
  }
  await authService.signOtpCode(payloadOtp)
  const payloadSendVerify = {
    from: `${env.MAIL_FROM_NAME} <noti@${env.MAIL_FROM_ADDRESS}>`,
    to: req.body.email,
    variables: {
      fullName: req.body.fullName,
      verify_url: `${env.FRONTEND_URL}/verify-email?email_verify_token=${rawToken}`
    }
  }
  if (env.BUILD_MODE === 'production') {
    await resendProvider.sendWithTemplate(TemplateResendId.VERIFY_EMAIL, [payloadSendVerify])
  }
  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: UserMessages.REGISTER_SUCCESS,
    data: storeRefreshToken(res, result, remember)
  })
}
export const LoginController = async (req: Request<ParamsDictionary, any, LoginRqType>, res: Response) => {
  const { user } = req
  const device_info = getDeviceInfo(req.headers['user-agent'] as string)
  const remember = req.body.remember !== false
  const result = await authService.login(user as User, device_info, remember)
  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: UserMessages.LOGIN_SUCCESS,
    data: storeRefreshToken(res, result, remember)
  })
}
export const OauthGoogleController = async (req: Request, res: Response) => {
  const { code } = req.query
  const device_info = getDeviceInfo(req.headers['user-agent'] as string)
  const result = await authService.loginOauthGoogle(code as string, device_info)
  setRefreshTokenCookie(res, result.RefreshToken, true)
  res.redirect(env.FRONTEND_URL)
}
export const LogoutController = async (req: Request, res: Response) => {
  clearRefreshTokenCookie(res)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.LOGOUT_SUCCESS
  })
}
export const RefreshController = async (req: Request, res: Response) => {
  const device_info = getDeviceInfo(req.headers['user-agent'] as string)
  const result = await authService.refreshToken(req.decodeToken as userInfo, device_info)
  const remember = (req.decodeToken as userInfo).remember !== false
  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: UserMessages.REFRESH_TOKEN_SUCCESS,
    data: storeRefreshToken(res, result, remember)
  })
}
export const verifyEmailController = async (req: Request, res: Response<any, VerifyOtpLocals>) => {
  const device_info = getDeviceInfo(req.headers['user-agent'] as string)
  const result = await authService.verifyEmail(res.locals.otpVerify as OtpCode, device_info)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.EMAIL_VERIFY_SUCCESS,
    data: storeRefreshToken(res, result, true)
  })
}
export const forgotPasswordController = async (
  req: Request<ParamsDictionary, any, ForgotPasswordRqType>,
  res: Response
) => {
  const result = await userService.findUser('email', req.body.email)
  if (result) {
    const { rawToken, hashedToken } = generateToken()
    const ttl = ms(env.ExpiresIn_FORGOT_PASSWORD_TOKEN as StringValue) as number
    const payloadOtp = {
      user_id: result._id,
      code: hashedToken,
      type: OtpType.RESET_PASSWORD,
      expires_at: new Date(Date.now() + ttl)
    }
    await authService.signOtpCode(payloadOtp)
    const payloadSendVerify = {
      from: `${env.MAIL_FROM_NAME} <support@${env.MAIL_FROM_ADDRESS}>`,
      to: req.body.email,
      variables: {
        fullName: result.fullName,
        verify_url: `${env.FRONTEND_URL}/reset-password?forgot_password_token=${rawToken}`
      }
    }
    // Thay template vẫn đang dùng template xác thực email
    if (env.BUILD_MODE === 'production') {
      await resendProvider.sendWithTemplate(TemplateResendId.VERIFY_EMAIL, [payloadSendVerify])
    }
  }
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.FORGOT_PASSWORD_EMAIL_SENT
  })
}
export const resetPasswordController = async (
  req: Request<ParamsDictionary, any, ResetPasswordRqType>,
  res: Response<any, VerifyOtpLocals>
) => {
  await authService.resetPassword(res.locals.otpVerify as OtpCode, req.body.password)
  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.FORGOT_PASSWORD_SUCCESS
  })
}
