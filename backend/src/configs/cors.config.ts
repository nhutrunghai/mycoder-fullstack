import { CorsOptions } from 'cors'
import env from './env.config'
import { AppError } from '~/errors/app-error'
import { StatusCodes } from 'http-status-codes'
const isDevelopment = env.NODE_ENV === 'development'
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isDevelopment) return callback(null, true)
    if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new AppError({ statusCode: StatusCodes.FORBIDDEN, message: 'Not allowed by CORS' }))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}
export default corsOptions
