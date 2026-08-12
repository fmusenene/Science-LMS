import { promises as fs } from 'fs'
import path from 'path'
import { createSeedData } from './seed-data'
import { mergeLmsData, sanitizeNotifications } from './lms-merge'
import { ensureHashedPasswords } from './security/sanitize'
import type { LmsData } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'lms-db.json')

/** Serialize writes so concurrent teacher/admin saves cannot corrupt the file. */
let writeChain: Promise<void> = Promise.resolve()

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

export async function readServerData(): Promise<LmsData> {
  await ensureDir()
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as LmsData
    if (parsed?.roles?.length && parsed?.users?.length) {
      if (!Array.isArray(parsed.requisitions)) parsed.requisitions = []
      if (!Array.isArray(parsed.notifications)) parsed.notifications = []
      const cleaned = sanitizeNotifications(parsed)
      const { data, changed } = ensureHashedPasswords(cleaned)
      if (changed) await writeServerData(data)
      return data
    }
  } catch {
    // missing or corrupt — seed below
  }
  const seed = createSeedData()
  const { data: hashedSeed } = ensureHashedPasswords(seed)
  await writeServerData(hashedSeed)
  return hashedSeed
}

export async function writeServerData(data: LmsData): Promise<LmsData> {
  const clean = sanitizeNotifications(data)
  writeChain = writeChain.then(async () => {
    await ensureDir()
    const tmp = `${DATA_FILE}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(clean, null, 2), 'utf8')
    await fs.rename(tmp, DATA_FILE)
  })
  await writeChain
  return clean
}

/** Merge client payload with on-disk DB so no account loses the other's submissions. */
export async function mergeAndSave(incoming: LmsData): Promise<LmsData> {
  const current = await readServerData()
  const primary =
    (incoming.revision ?? 0) >= (current.revision ?? 0) ? incoming : current
  const secondary =
    (incoming.revision ?? 0) >= (current.revision ?? 0) ? current : incoming
  const merged = sanitizeNotifications(mergeLmsData(primary, secondary))

  const sameReqs =
    JSON.stringify(
      (current.requisitions ?? []).map((r) => [r.id, r.status, r.submittedAt ?? r.createdAt]),
    ) ===
    JSON.stringify(
      (merged.requisitions ?? []).map((r) => [r.id, r.status, r.submittedAt ?? r.createdAt]),
    )
  const sameNtf =
    JSON.stringify(
      (current.notifications ?? []).map((n) => `${n.id}:${n.read ? 1 : 0}`).sort(),
    ) ===
    JSON.stringify(
      (merged.notifications ?? []).map((n) => `${n.id}:${n.read ? 1 : 0}`).sort(),
    )

  // No-op saves must not bump revision — that caused clients to re-render every poll.
  // Still write when notification read flags changed.
  if (sameReqs && sameNtf && (incoming.revision ?? 0) <= (current.revision ?? 0)) {
    return current
  }

  merged.revision =
    Math.max(incoming.revision ?? 0, current.revision ?? 0, merged.revision ?? 0) + 1
  return writeServerData(merged)
}
