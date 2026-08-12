/**
 * Partitioned browser persistence for the LMS.
 * Requisitions & notifications are stored separately from the heavy core blob
 * so teacher submissions never disappear when the main document cannot be written.
 */
import type { AppNotification, LmsData, Requisition } from './types'
import { createSeedData } from './seed-data'
import {
  applyPermissionMigrations,
  LMS_SCHEMA_VERSION,
  syncAdminPermissions,
} from './permissions'
import { createDefaultSettings } from './seed-data'
import {
  mergeLmsData,
  mergeNotifications,
  mergeRequisitions,
  revisionOfData,
  sanitizeNotifications,
} from './lms-merge'

export {
  mergeLmsData,
  mergeNotifications,
  mergeRequisitions,
  revisionOfData,
  sanitizeNotifications,
} from './lms-merge'

export const PERSIST_KEYS = {
  core: 'lms.core.v5',
  requisitions: 'lms.requisitions.v5',
  notifications: 'lms.notifications.v5',
  session: 'lms.session.v5',
} as const

const LEGACY_KEYS = [
  'lms.data.v2',
  'lms.requisitions.v2',
  'lms.session.v2',
  'lms.data.v3',
  'lms.requisitions.v3',
  'lms.session.v3',
  'lms.data.v4',
  'lms.requisitions.v4',
  'lms.session.v4',
] as const

const CHANNEL_NAME = 'lms-data-sync-v5'

export type PersistResult = 'ok' | 'partial' | 'fail'

function revisionOf(data: { revision?: number } | null | undefined) {
  return data?.revision ?? 0
}

export function clearLegacyStorage() {
  if (typeof window === 'undefined') return
  for (const key of LEGACY_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function normalizeCore(parsed: LmsData): LmsData {
  const fromVersion = parsed.schemaVersion ?? 0
  applyPermissionMigrations(parsed.roles, fromVersion, LMS_SCHEMA_VERSION)
  for (const role of parsed.roles) {
    role.permissions = syncAdminPermissions(role)
  }
  parsed.schemaVersion = LMS_SCHEMA_VERSION

  if (!parsed.settings?.periods?.length) {
    parsed.settings = createDefaultSettings()
  } else {
    const defaults = createDefaultSettings()
    parsed.settings = {
      ...defaults,
      ...parsed.settings,
      periods: parsed.settings.periods?.length ? parsed.settings.periods : defaults.periods,
      subjects: parsed.settings.subjects?.length ? parsed.settings.subjects : defaults.subjects,
      forms: parsed.settings.forms?.length ? parsed.settings.forms : defaults.forms,
      notDoneReasons: parsed.settings.notDoneReasons?.length
        ? parsed.settings.notDoneReasons
        : defaults.notDoneReasons,
    }
  }

  if (!Array.isArray(parsed.requisitions)) parsed.requisitions = []
  if (!Array.isArray(parsed.notifications)) parsed.notifications = []
  if (!Array.isArray(parsed.items)) parsed.items = []
  if (!Array.isArray(parsed.sessions)) parsed.sessions = []
  if (!Array.isArray(parsed.breakages)) parsed.breakages = []
  if (!Array.isArray(parsed.movements)) parsed.movements = []
  if (!Array.isArray(parsed.audit)) parsed.audit = []
  if (typeof parsed.revision !== 'number') parsed.revision = 1
  return parsed
}

function stripAvatars(data: LmsData): LmsData {
  const copy: LmsData = JSON.parse(JSON.stringify(data))
  for (const user of copy.users) user.avatarUrl = undefined
  copy.audit = copy.audit.slice(0, 50)
  copy.movements = copy.movements.slice(0, 50)
  return copy
}

export function loadPersistedData(): LmsData {
  if (typeof window === 'undefined') return createSeedData()

  clearLegacyStorage()

  let core = readJson<LmsData>(PERSIST_KEYS.core)
  if (!core?.roles?.length || !core?.users?.length) {
    // Migrate leftover monolith if present
    const monolith = readJson<LmsData>('lms.data.v4')
    if (monolith?.roles?.length && monolith?.users?.length) {
      core = monolith
    }
  }

  if (!core?.roles?.length || !core?.users?.length) {
    core = createSeedData()
  } else {
    core = normalizeCore(core)
  }

  const reqPart = readJson<Requisition[]>(PERSIST_KEYS.requisitions)
  const ntfPart = readJson<AppNotification[]>(PERSIST_KEYS.notifications)

  const requisitions = mergeRequisitions(
    Array.isArray(core.requisitions) ? core.requisitions : [],
    Array.isArray(reqPart) ? reqPart : [],
  )
  const notifications = mergeNotifications(
    Array.isArray(core.notifications) ? core.notifications : [],
    Array.isArray(ntfPart) ? ntfPart : [],
  )

  return sanitizeNotifications({
    ...core,
    requisitions,
    notifications,
  })
}

export function persistData(payload: LmsData): PersistResult {
  if (typeof window === 'undefined') return 'fail'

  // Never keep password hashes/plaintext in browser storage.
  const clean = sanitizeNotifications({
    ...payload,
    users: payload.users.map((u) => ({ ...u, password: '' })),
  })
  const reqOk = writeJson(PERSIST_KEYS.requisitions, clean.requisitions)
  const ntfOk = writeJson(PERSIST_KEYS.notifications, clean.notifications)

  const coreBody: LmsData = {
    ...clean,
    // Partitions own these — keep core lighter
    requisitions: [],
    notifications: [],
  }

  let coreOk = writeJson(PERSIST_KEYS.core, coreBody)
  if (!coreOk) {
    coreOk = writeJson(PERSIST_KEYS.core, stripAvatars(coreBody))
  }

  // Critical path: requisitions must survive even if core fails.
  if (!reqOk) {
    try {
      writeJson(PERSIST_KEYS.requisitions, clean.requisitions.slice(0, 80))
    } catch {
      // ignore
    }
  }

  broadcast(clean)

  if (coreOk && reqOk && ntfOk) return 'ok'
  if (reqOk) return 'partial'
  return 'fail'
}

export function persistSession(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(PERSIST_KEYS.session, userId)
    else window.localStorage.removeItem(PERSIST_KEYS.session)
  } catch {
    // ignore
  }
}

export function loadSession(): string | null {
  try {
    return window.localStorage.getItem(PERSIST_KEYS.session)
  } catch {
    return null
  }
}

type SyncListener = (data: LmsData) => void
const syncListeners = new Set<SyncListener>()
let channel: BroadcastChannel | null = null

function getChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => {
      const data = event.data as LmsData | null
      if (!data?.roles?.length) return
      for (const listener of syncListeners) listener(data)
    }
  }
  return channel
}

function broadcast(data: LmsData) {
  try {
    getChannel()?.postMessage(data)
  } catch {
    // ignore
  }
}

export function subscribeDataSync(listener: SyncListener) {
  syncListeners.add(listener)
  getChannel()
  return () => {
    syncListeners.delete(listener)
  }
}

/** Load the shared server database (file-backed). Requires a valid session cookie. */
export async function fetchServerData(): Promise<LmsData | null> {
  try {
    const res = await fetch('/api/lms/data', { cache: 'no-store', credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as LmsData
    if (!data?.roles?.length || !data?.users?.length) return null
    return sanitizeNotifications(data)
  } catch {
    return null
  }
}

/** Push local state into the shared server database and return the merged result. */
export async function pushServerData(data: LmsData): Promise<LmsData | null> {
  try {
    const res = await fetch('/api/lms/data', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        sanitizeNotifications({
          ...data,
          // Blank passwords — server preserves hashes.
          users: data.users.map((u) => ({
            ...u,
            password: u.password && !u.password.startsWith('scrypt$') ? u.password : '',
          })),
        }),
      ),
    })
    if (!res.ok) return null
    const saved = (await res.json()) as LmsData
    if (!saved?.roles?.length) return null
    return sanitizeNotifications(saved)
  } catch {
    return null
  }
}

export async function loginOnServer(
  email: string,
  password: string,
): Promise<
  | { ok: true; userId: string; roleId: string; data: LmsData }
  | { ok: false; error: string; status?: number }
> {
  try {
    const res = await fetch('/api/lms/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      userId?: string
      roleId?: string
      data?: LmsData
    }
    if (!res.ok || !body.userId || !body.data) {
      return { ok: false, error: body.error ?? 'Sign-in failed.', status: res.status }
    }
    return {
      ok: true,
      userId: body.userId,
      roleId: body.roleId ?? '',
      data: sanitizeNotifications(body.data),
    }
  } catch {
    return { ok: false, error: 'Cannot reach the sign-in service.' }
  }
}

export async function logoutOnServer(): Promise<void> {
  try {
    await fetch('/api/lms/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // ignore
  }
}

export async function fetchServerSession(): Promise<
  | { authenticated: true; userId: string; data: LmsData }
  | { authenticated: false }
> {
  try {
    const res = await fetch('/api/lms/auth/session', { cache: 'no-store', credentials: 'include' })
    if (!res.ok) return { authenticated: false }
    const body = (await res.json()) as {
      authenticated?: boolean
      userId?: string
      data?: LmsData
    }
    if (!body.authenticated || !body.userId || !body.data?.roles?.length) {
      return { authenticated: false }
    }
    return {
      authenticated: true,
      userId: body.userId,
      data: sanitizeNotifications(body.data),
    }
  } catch {
    return { authenticated: false }
  }
}
