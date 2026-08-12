import type { LmsData, User } from '@/lib/types'
import { hashPassword, isPasswordHashed } from '@/lib/security/password'

/** Remove password material before sending data to browsers. */
export function stripSecrets<T extends LmsData>(data: T): T {
  const copy = JSON.parse(JSON.stringify(data)) as T
  for (const user of copy.users ?? []) {
    user.password = ''
  }
  return copy
}

/** Ensure every user password is hashed (migrates legacy plaintext). */
export function ensureHashedPasswords(data: LmsData): { data: LmsData; changed: boolean } {
  let changed = false
  const users = data.users.map((u) => {
    if (!u.password) return u
    if (isPasswordHashed(u.password)) return u
    changed = true
    return { ...u, password: hashPassword(u.password) }
  })
  return { data: changed ? { ...data, users } : data, changed }
}

/**
 * When merging a client payload, never let blank/stripped passwords wipe hashes.
 * Plaintext passwords from an authorized admin save are hashed here.
 */
export function reconcileUserPasswords(incoming: LmsData, current: LmsData): LmsData {
  const byId = new Map(current.users.map((u) => [u.id, u]))
  const users: User[] = incoming.users.map((u) => {
    const prev = byId.get(u.id)
    const pwd = (u.password ?? '').trim()
    if (!pwd) {
      return { ...u, password: prev?.password ?? hashPassword(cryptoRandomFallback()) }
    }
    if (isPasswordHashed(pwd)) {
      // Clients must not supply raw hashes — keep existing unless identical to prev.
      if (prev && pwd === prev.password) return { ...u, password: prev.password }
      return { ...u, password: prev?.password ?? hashPassword(cryptoRandomFallback()) }
    }
    return { ...u, password: hashPassword(pwd) }
  })
  return { ...incoming, users }
}

function cryptoRandomFallback(): string {
  return `locked-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
