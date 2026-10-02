import { SignOptions } from 'jsonwebtoken'
import { generateJwt } from '~/utils/jwt.util.js'
import userInfo from '~/types/auth/user-info.type.js'
import databaseService from '~/configs/database.config.js'
import User from '~/models/schema/client/user.schema.js'
import RefreshToken from '~/models/schema/client/refreshTokens.schema.js'
import { v4 as uuidv4 } from 'uuid'
import env from '~/configs/env.config.js'
import { ObjectId } from 'mongodb'
import { hashPassword } from '~/utils/crypto.utils.js'
import OtpCode from '~/models/schema/client/otpCodes.schema.js'
import axios from 'axios'
import { GoogleTokenResponse } from '~/types/oauth/google-oauth.type.js'
import { AppError } from '~/errors/app-error.js'
import { StatusCodes } from 'http-status-codes'
import UserMessages from '~/constants/messages/index.js'
import userService from './users.service.js'
import { OtpType, UserRole, UserStatus } from '~/constants/enums.js'
class AuthService {
  private signAccessToken({
    userInfoAccessToken,
    privateKey = env.SECRET_ACCESS_TOKEN,
    option = { expiresIn: env.ExpiresIn_ACCESS_TOKEN } as SignOptions
  }: {
    userInfoAccessToken: userInfo
    privateKey?: string
    option?: SignOptions
  }) {
    return generateJwt(userInfoAccessToken, privateKey, option)
  }
  private signRefreshToken({
    userInfoRefreshToken,
    privateKey = env.SECRET_REFRESH_TOKEN,
    option = { expiresIn: env.ExpiresIn_REFRESH_TOKEN } as SignOptions
  }: {
    userInfoRefreshToken: userInfo
    privateKey?: string
    option?: SignOptions
  }) {
    return generateJwt(userInfoRefreshToken, privateKey, option)
  }
  async signOtpCode(payload: OtpCode) {
    await databaseService.otpCodes.insertOne(new OtpCode(payload))
  }
  private async signAccessAndRefresh(
    userInfo: object,
    device_info: string,
    option?: { expiresAt?: Date; remember?: boolean }
  ) {
    const jtiAccessToken = uuidv4()
    const jtiRefreshToken = uuidv4()
    const userInfoAccessToken = { ...userInfo, jti: jtiAccessToken, typeJwt: 'ACCESS_TOKEN' } as userInfo
    const userInfoRefreshToken = {
      ...userInfo,
      jti: jtiRefreshToken,
      typeJwt: 'REFRESH_TOKEN',
      remember: option?.remember ?? true
    } as userInfo
    let expiresAt
    if (!option?.expiresAt) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(env.ExpiresIn_REFRESH_TOKEN?.split(' ')[0]))
    } else {
      expiresAt = option.expiresAt
    }

    await databaseService.refreshTokens.insertOne(
      new RefreshToken({
        jti: jtiRefreshToken,
        user_id: new ObjectId(userInfoRefreshToken.userId),
        device_info: device_info,
        expires_at: expiresAt
      })
    )
    const refreshTokenOption = option?.expiresAt
      ? ({ expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) } as SignOptions)
      : undefined
    const refreshTokenPromise = refreshTokenOption
      ? this.signRefreshToken({ userInfoRefreshToken, option: refreshTokenOption })
      : this.signRefreshToken({ userInfoRefreshToken })
    return Promise.all([this.signAccessToken({ userInfoAccessToken }), refreshTokenPromise])
  }
  async register(payload: User, device_info: string, remember = true) {
    if (!payload.is_verified) {
      payload.password = await hashPassword(payload.password)
    }
    const result = await databaseService.users.insertOne(new User(payload))
    const user_id = result.insertedId
    const userInfo = { userId: user_id, role: payload.role, vfd: payload.is_verified || false }
    const [AccessToken, RefreshToken] = await this.signAccessAndRefresh(userInfo, device_info, { remember })
    return { id: user_id, AccessToken, RefreshToken }
  }
  async login(user: User, device_info: string, remember = true) {
    const userInfo = { userId: user._id, role: user.role as UserRole, vfd: user.is_verified }
    const [AccessToken, RefreshToken] = await this.signAccessAndRefresh(userInfo, device_info, { remember })
    return { id: user._id, AccessToken, RefreshToken }
  }
  private async getOauthGoogleToken(code: string) {
    const body = {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URL,
      grant_type: 'authorization_code'
    }
    const tokenResponse = await axios.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', body)
    return tokenResponse.data.access_token
  }
  private async getGoogleUserInfo(access_token: string) {
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    return userResponse.data
  }
  async loginOauthGoogle(code: string, device_info: string) {
    const access_token = await this.getOauthGoogleToken(code)
    const userInfo = await this.getGoogleUserInfo(access_token)
    if (!userInfo.email_verified) {
      throw new AppError({ statusCode: StatusCodes.FORBIDDEN, message: UserMessages.OAUTH_GOOGLE_EMAIL_NOT_VERIFIED })
    }
    const user = await userService.findUser('email', userInfo.email)
    if (user) {
      if (user.status === UserStatus.BANNED) {
        throw new AppError({ statusCode: StatusCodes.FORBIDDEN, message: UserMessages.ACCOUNT_BANNED })
      }
      if (user.status === UserStatus.DELETED) {
        throw new AppError({ statusCode: StatusCodes.FORBIDDEN, message: UserMessages.ACCOUNT_DELETED })
      }
      if (!user.is_verified) {
        await Promise.all([
          databaseService.users.updateOne({ _id: user._id }, { $set: { is_verified: true, updated_at: new Date() } }),
          await databaseService.refreshTokens.deleteMany({ user_id: user._id })
        ])
      }
      const userInfo = { userId: user._id, role: user.role, vfd: true }
      const [AccessToken, RefreshToken] = await this.signAccessAndRefresh(userInfo, device_info)
      return { id: user._id, AccessToken, RefreshToken }
    } else {
      const payload: User = {
        fullName: userInfo.name,
        email: userInfo.email,
        password: '',
        is_verified: true,
        role: UserRole.CANDIDATE
      }
      return this.register(payload, device_info, true)
    }
  }
  async refreshToken(payload: userInfo, device_info: string) {
    const userInfo = { userId: payload.userId, role: payload.role, vfd: payload.vfd }
    const expiresAt = new Date((payload.exp as number) * 1000)
    const [AccessToken, RefreshToken] = await this.signAccessAndRefresh(userInfo, device_info, {
      expiresAt,
      remember: payload.remember !== false
    })
    return { id: payload.userId, AccessToken, RefreshToken }
  }
  async verifyEmail(payload: OtpCode, device_info: string) {
    const [user] = await Promise.all([
      databaseService.users.findOneAndUpdate(
        { _id: payload.user_id },
        { $set: { is_verified: true, updated_at: new Date() } }
      ),
      databaseService.otpCodes.deleteOne({ code: payload.code, type: OtpType.VERIFY_EMAIL })
    ])
    if (!user) {
      throw new AppError({ statusCode: StatusCodes.UNAUTHORIZED, message: UserMessages.USER_NOT_FOUND })
    } else {
      const userInfo = { userId: payload.user_id, role: user.role, vfd: true }
      await databaseService.refreshTokens.deleteMany({ user_id: payload.user_id })
      const [AccessToken, RefreshToken] = await this.signAccessAndRefresh(userInfo, device_info)
      return { id: payload.user_id, AccessToken, RefreshToken }
    }
  }
  async resetPassword(payload: OtpCode, password: string) {
    password = await hashPassword(password)
    return Promise.all([
      databaseService.users.updateOne(
        { _id: payload.user_id },
        { $set: { password: password, updated_at: new Date() } }
      ),
      databaseService.otpCodes.deleteOne({ code: payload.code, type: OtpType.RESET_PASSWORD })
    ])
  }
}
const authService = new AuthService()
export default authService

