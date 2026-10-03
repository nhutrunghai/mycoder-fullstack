import crypto from 'node:crypto'
import { StatusCodes } from 'http-status-codes'
import env from '~/configs/env.config.js'
import UserMessages from '~/constants/messages/index.js'
import { AppError } from '~/errors/app-error.js'

export type EncryptedSystemSecret = {
  algorithm: 'aes-256-gcm'
  iv: string
  tag: string
  ciphertext: string
  preview: string
  updated_at: Date
}

const getEncryptionKey = () => {
  if (!env.SYSTEM_SETTINGS_ENCRYPTION_KEY) {
    throw new AppError({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: UserMessages.SYSTEM_SETTINGS_ENCRYPTION_KEY_REQUIRED
    })
  }

  return crypto.createHash('sha256').update(env.SYSTEM_SETTINGS_ENCRYPTION_KEY).digest()
}

export const maskSecret = (value?: string | null, visibleTail = 4) => {
  if (!value) {
    return null
  }

  const str = value.trim()
  if (str.length <= visibleTail) {
    return '••••'
  }

  if (str.startsWith('sk-proj-')) {
    return `sk-proj-••••${str.slice(-visibleTail)}`
  }
  if (str.startsWith('sk-')) {
    return `sk-••••${str.slice(-visibleTail)}`
  }
  if (str.startsWith('AIzaSy')) {
    return `AIzaSy••••${str.slice(-visibleTail)}`
  }
  if (str.startsWith('AIza')) {
    return `AIza••••${str.slice(-visibleTail)}`
  }

  const head = str.length > 8 ? str.slice(0, 3) : ''
  return head ? `${head}••••${str.slice(-visibleTail)}` : `••••${str.slice(-visibleTail)}`
}

export const encryptSystemSecret = (value: string): EncryptedSystemSecret => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    preview: maskSecret(value) || '',
    updated_at: new Date()
  }
}

export const decryptSystemSecret = (secret?: EncryptedSystemSecret | null) => {
  if (!secret) {
    return null
  }

  const decipher = crypto.createDecipheriv(
    secret.algorithm,
    getEncryptionKey(),
    Buffer.from(secret.iv, 'base64')
  )

  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8')
}
