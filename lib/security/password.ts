import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const PREFIX = 'scrypt'
const KEYLEN = 64

/** Hash a password for storage (Node only). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, KEYLEN).toString('hex')
  return `${PREFIX}$${salt}$${hash}`
}

export function isPasswordHashed(stored: string | undefined | null): boolean {
  if (!stored) return false
  return stored.startsWith(`${PREFIX}$`)
}

/** Constant-time verify. Accepts legacy plaintext during migration. */
export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false
  if (!isPasswordHashed(stored)) {
    const a = Buffer.from(plain)
    const b = Buffer.from(stored)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== PREFIX) return false
  const [, salt, expectedHex] = parts
  const actual = scryptSync(plain, salt, KEYLEN)
  const expected = Buffer.from(expectedHex, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/** Stable fingerprint for rate-limit keys (not for auth). */
export function fingerprint(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
