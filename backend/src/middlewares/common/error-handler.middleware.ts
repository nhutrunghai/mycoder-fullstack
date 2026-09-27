import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { StatusCodes } from 'http-status-codes'
import { AppError } from '~/errors/app-error.js'
import UserMessages from '~/constants/messages/index.js'
import env from '~/configs/env.config'
import logger from '~/configs/logger.config.js'
const isDev = env.BUILD_MODE === 'dev'
const globalErrorHandle = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const isJsonParseError =
    err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err)
  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : isJsonParseError
        ? StatusCodes.BAD_REQUEST
        : err instanceof ZodError
          ? StatusCodes.UNPROCESSABLE_ENTITY
          : StatusCodes.INTERNAL_SERVER_ERROR
  const logContext = {
    method: req.method,
    path: req.path,
    status_code: statusCode
  }

  if (statusCode >= 500) {
    logger.error({ err, ...logContext }, 'Unhandled request error')
  } else if (isDev) {
    logger.debug(logContext, 'Request rejected')
  }

  if (isJsonParseError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'fail',
      message: UserMessages.INVALID_DATA
    })
  }
  if (err instanceof ZodError) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      status: 'fail',
      message: UserMessages.INVALID_DATA,
      error: err.issues.map((e) => ({
        path: e.path[1],
        location: e.path[0],
        message: e.message
      }))
    })
  }
  const dataError = {
    status: 'error',
    message: UserMessages.SERVER_ERROR,
    stack: err.stack
  }
  if (!isDev) {
    delete dataError.stack
  }
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json(Object.assign(dataError, { status: 'fail', errorCode: err.errorCode, message: err.message }))
  }
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(dataError)
}
export default globalErrorHandle
