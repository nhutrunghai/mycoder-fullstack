import { Request, Response, NextFunction } from 'express'
import env from '~/configs/env.config'
import RedisService from '~/configs/redis.config'
import { verifyToken } from '~/utils/jwt.util'

const getBearerToken = (authorization?: string) => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim()
}

const optionalDecodeToken = async (req: Request, res: Response, next: NextFunction) => {
  const accessToken = getBearerToken(req.headers.authorization)

  if (!accessToken) {
    return next()
  }

  try {
    const payload = await verifyToken(accessToken, env.SECRET_ACCESS_TOKEN)
    const redis = RedisService.getInstance()
    const [isTokenBlacklisted, isUserBlacklisted] = await Promise.all([
      redis.get(`blacklist:${payload.jti}`),
      redis.get(`blacklist:user:${payload.userId}`)
    ])

    if (!isTokenBlacklisted && !isUserBlacklisted) {
      req.decodeToken = payload
    }
  } catch {
    // Token loi, het han hoac bi thu hoi thi tiep tuc nhu guest
  }

  next()
}

export default optionalDecodeToken
