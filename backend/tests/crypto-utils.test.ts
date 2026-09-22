import {
  comparePassword,
  generateOtpChangePassword,
  generateToken,
  hashPassword,
  hashToken
} from '../src/utils/crypto.utils.js'

describe('crypto utilities', () => {
  it('generates a raw token with a matching SHA-256 hash', () => {
    const { rawToken, hashedToken } = generateToken()

    expect(rawToken).toMatch(/^[a-f0-9]{64}$/)
    expect(hashedToken).toMatch(/^[a-f0-9]{64}$/)
    expect(hashToken(rawToken)).toBe(hashedToken)
  })

  it('hashes passwords and only accepts the original password', async () => {
    const hashedPassword = await hashPassword('secure-password-123')

    await expect(comparePassword('secure-password-123', hashedPassword)).resolves.toBe(true)
    await expect(comparePassword('different-password', hashedPassword)).resolves.toBe(false)
  })

  it('generates an eight-character password reset OTP', () => {
    expect(generateOtpChangePassword()).toMatch(/^[a-z0-9]{8}$/)
  })
})
