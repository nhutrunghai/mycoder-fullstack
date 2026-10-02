import { Request, Response, NextFunction } from 'express'
import { checkConflict } from '../common/check-conflict.middleware.js'
import { ParamsDictionary } from 'express-serve-static-core'
import databaseService from '~/configs/database.config.js'
import { Collection, ObjectId } from 'mongodb'
import { AppError } from '~/errors/app-error.js'
import { StatusCodes } from 'http-status-codes'
import UserMessages from '~/constants/messages/index.js'
import ErrorCode from '~/constants/error-code.js'
import {
  EmailVerifyRqType,
  LoginRqType,
  RegisterRqType,
  ResetPasswordRqType
} from '~/types/http/request.type.js'
import { verifyToken } from '~/utils/jwt.util.js'
import env from '~/configs/env.config.js'
import RedisService from '~/configs/redis.config.js'
import { comparePassword, hashToken } from '~/utils/crypto.utils.js'
import { OtpType, UserStatus } from '~/constants/enums.js'
import { VerifyOtpLocals } from '~/types/http/response.type.js'
import OtpCode from '~/models/schema/client/otpCodes.schema.js'
import { clearRefreshTokenCookie } from '~/utils/auth-cookie.util.js'

export const TrustedAuthOriginMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (!origin) return next()

  const trustedOrigins = new Set([
    ...env.ALLOWED_ORIGINS,
    new URL(env.FRONTEND_URL).origin
  ])
  if (trustedOrigins.has(origin)) return next()

  return next(new AppError({ statusCode: StatusCodes.FORBIDDEN, message: 'Nguồn yêu cầu xác thực không được phép.' }))
}

export const checkOtpVerify = async (condition: { code: string; type: OtpType }, next: NextFunction) => {
  const result = await databaseService.otpCodes.findOne(condition)
  if (!result) {
    return next(new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.VERIFY_TOKEN_INVALID }))
  }
  const exp = new Date(result.expires_at).getTime()
  if (exp < Date.now()) {
    return next(new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.VERIFY_TOKEN_INVALID }))
  }
  return result
}

export const registerMiddleware = async (
  req: Request<ParamsDictionary, any, RegisterRqType>,
  res: Response,
  next: NextFunction
) => {
  const hasConflict = await checkConflict(databaseService.users as unknown as Collection, 'email')(req)
  if (hasConflict) {
    return next(new AppError({ statusCode: StatusCodes.CONFLICT, message: UserMessages.EMAIL_EXISTS }))
  }
  next()
}

export const LoginMiddleware = async (
  req: Request<ParamsDictionary, any, LoginRqType>,
  res: Response,
  next: NextFunction
) => {
  const { email, password } = req.body
  const user = await databaseService.users.findOne({ email: email })
  if (!user) {
    return next(new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.UNAUTHORIZED }))
  }
  const isCheckPassword = await comparePassword(password, user.password)
  if (!isCheckPassword) {
    return next(
      new AppError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: UserMessages.UNAUTHORIZED
      })
    )
  }

  // Check account status: BANNED or DELETED accounts must not log in
  if (user.status === UserStatus.BANNED) {
    return next(
      new AppError({
        statusCode: StatusCodes.FORBIDDEN,
        message: UserMessages.ACCOUNT_BANNED,
        errorCode: ErrorCode.ACCOUNT_BANNED
      })
    )
  }
  if (user.status === UserStatus.DELETED) {
    return next(
      new AppError({
        statusCode: StatusCodes.FORBIDDEN,
        message: UserMessages.ACCOUNT_DELETED,
        errorCode: ErrorCode.ACCOUNT_DELETED
      })
    )
  }

  req.user = user
  next()
}

export const OauthGoogleMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { code, error } = req.query
  if (error) {
    return next(
      new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.OAUTH_GOOGELE_UNAUTHORIZED })
    )
  }
  if (!code) {
    return next(new AppError({ statusCode: StatusCodes.BAD_REQUEST, message: UserMessages.OAUTH_GOOGELE_MISSING_CODE }))
  }
  next()
}

export const LogoutMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const access_token = req.headers['authorization']?.split('Bearer ')[1]
  if (access_token) {
    try {
      const payload = await verifyToken(access_token, env.SECRET_ACCESS_TOKEN)
      req.decodeToken = payload
      const redis = RedisService.getInstance()
      const currentTime = Math.floor(Date.now() / 1000)
      const ttl = (payload.exp as number) - currentTime
      if (ttl > 0) {
        await redis.set(`blacklist:${payload.jti}`, '1', 'EX', ttl)
      }
    } catch {
      // Logout is idempotent: an expired access token must not prevent cookie cleanup.
    }
  }
  const refresh_token = req.cookies?.[env.AUTH_REFRESH_COOKIE_NAME]
  if (refresh_token) {
    try {
      const payload = await verifyToken(refresh_token, env.SECRET_REFRESH_TOKEN)
      await databaseService.refreshTokens.deleteOne({ user_id: new ObjectId(payload.userId), jti: payload.jti })
    } catch {
      // The controller still clears an invalid or expired refresh cookie.
    }
  }
  next()
}

export const RefreshMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const refresh_token = req.cookies?.[env.AUTH_REFRESH_COOKIE_NAME]
  if (!refresh_token) {
    clearRefreshTokenCookie(res)
    return next(new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.REFRESH_TOKEN_NOT_FOUND }))
  }
  try {
    const payload = await verifyToken(refresh_token, env.SECRET_REFRESH_TOKEN)
    req.decodeToken = payload
    const userId = new ObjectId(payload.userId)

    // Verify user is not banned or deleted in database
    const user = await databaseService.users.findOne({ _id: userId })
    if (!user || user.status === UserStatus.BANNED || user.status === UserStatus.DELETED) {
      await databaseService.refreshTokens.deleteMany({ user_id: userId })
      clearRefreshTokenCookie(res)
      return next(
        new AppError({
          statusCode: StatusCodes.FORBIDDEN,
          message: user?.status === UserStatus.BANNED ? UserMessages.ACCOUNT_BANNED : UserMessages.ACCOUNT_DELETED,
          errorCode: user?.status === UserStatus.BANNED ? ErrorCode.ACCOUNT_BANNED : ErrorCode.ACCOUNT_DELETED
        })
      )
    }

    const result = await databaseService.refreshTokens.findOneAndDelete({
      user_id: userId,
      jti: payload.jti
    })
    if (result) {
      return next()
    }
    clearRefreshTokenCookie(res)
    next(new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.REFRESH_TOKEN_INVALID }))
  } catch {
    clearRefreshTokenCookie(res)
    next(new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.REFRESH_TOKEN_INVALID }))
  }
}

export const verifyEmailMiddleware = async (
  req: Request<ParamsDictionary, any, EmailVerifyRqType>,
  res: Response<any, VerifyOtpLocals>,
  next: NextFunction
) => {
  const hashedToken = hashToken(req.body.email_verify_token)
  const result = await checkOtpVerify({ code: hashedToken, type: OtpType.VERIFY_EMAIL }, next)
  if (!result) return
  const user = await databaseService.users.findOne({ _id: result?.user_id })
  if (user?.is_verified) {
    await databaseService.otpCodes.deleteOne({ code: hashedToken, type: OtpType.VERIFY_EMAIL })
    return res.status(StatusCodes.OK).json({
      status: 'success',
      message: UserMessages.EMAIL_ALREADY_VERIFIED
    })
  }
  res.locals.otpVerify = result as OtpCode
  next()
}

export const resetPasswordMiddleware = async (
  req: Request<ParamsDictionary, any, ResetPasswordRqType>,
  res: Response<any, VerifyOtpLocals>,
  next: NextFunction
) => {
  const hashedToken = hashToken(req.body.forgot_password_token)
  const result = await checkOtpVerify({ code: hashedToken, type: OtpType.RESET_PASSWORD }, next)
  if (!result) return
  res.locals.otpVerify = result as OtpCode
  next()
}
