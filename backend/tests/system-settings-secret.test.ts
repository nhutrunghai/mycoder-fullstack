jest.mock('~/configs/env.config.js', () => ({
  __esModule: true,
  default: {
    SYSTEM_SETTINGS_ENCRYPTION_KEY: 'test-system-settings-encryption-key-123456789'
  }
}))

import { decryptSystemSecret, encryptSystemSecret, maskSecret } from '../src/utils/systemSettingsSecret.util.js'

describe('system settings secrets', () => {
  it('masks secrets without exposing their prefix', () => {
    expect(maskSecret('sk-proj-example-key')).toBe('***************-key')
    expect(maskSecret('abcd')).toBe('****')
    expect(maskSecret(null)).toBeNull()
  })

  it('encrypts and decrypts a secret with distinct ciphertext', () => {
    const value = 'sk-proj-test-secret-value'
    const encrypted = encryptSystemSecret(value)

    expect(encrypted.algorithm).toBe('aes-256-gcm')
    expect(encrypted.ciphertext).not.toContain(value)
    expect(encrypted.preview).toHaveLength(value.length)
    expect(encrypted.preview.endsWith('alue')).toBe(true)
    expect(decryptSystemSecret(encrypted)).toBe(value)
  })

  it('returns null when there is no encrypted secret', () => {
    expect(decryptSystemSecret()).toBeNull()
  })
})
