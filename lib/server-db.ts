import { promises as fs } from 'fs'
import path from 'path'
import { createSeedData } from './seed-data'
import { mergeLmsData, sanitizeNotifications } from './lms-merge'
import { ensureHashedPasswords } from './security/sanitize'
import {
  readNeonData,
  writeNeonData,
  writeNeonDataIfRevision,
} from './db/neon-store'
import type { LmsData } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'lms-db.json')

/** Serialize local file writes so concurrent saves cannot corrupt the file. */
let writeChain: Promise<void> = Promise.resolve()

export function usesCloudDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readFileData(): Promise<LmsData> {
  await ensureDir()
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as LmsData
    if (parsed?.roles?.length && parsed?.users?.length) {
      if (!Array.isArray(parsed.requisitions)) parsed.requisitions = []
      if (!Array.isArray(parsed.notifications)) parsed.notifications = []
      const cleaned = sanitizeNotifications(parsed)
      const { data, changed } = ensureHashedPasswords(cleaned)
      if (changed) await writeFileData(data)
      return data
    }
  } catch {
    // missing or corrupt — seed below
  }
  const seed = createSeedData()
  const { data: hashedSeed } = ensureHashedPasswords(seed)
  await writeFileData(hashedSeed)
  return hashedSeed
}

async function writeFileData(data: LmsData): Promise<LmsData> {
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

export async function readServerData(): Promise<LmsData> {
  if (usesCloudDatabase()) return readNeonData()
  return readFileData()
}

export async function writeServerData(data: LmsData): Promise<LmsData> {
  if (usesCloudDatabase()) return writeNeonData(data)
  return writeFileData(data)
}

function sameOperationalSnapshot(a: LmsData, b: LmsData) {
  const sameReqs =
    JSON.stringify(
      (a.requisitions ?? []).map((r) => [r.id, r.status, r.submittedAt ?? r.createdAt]),
    ) ===
    JSON.stringify(
      (b.requisitions ?? []).map((r) => [r.id, r.status, r.submittedAt ?? r.createdAt]),
    )
  const sameNtf =
    JSON.stringify(
      (a.notifications ?? []).map((n) => `${n.id}:${n.read ? 1 : 0}`).sort(),
    ) ===
    JSON.stringify(
      (b.notifications ?? []).map((n) => `${n.id}:${n.read ? 1 : 0}`).sort(),
    )
  return sameReqs && sameNtf
}

function buildMerged(current: LmsData, incoming: LmsData): LmsData | 'noop' {
  const primary =
    (incoming.revision ?? 0) >= (current.revision ?? 0) ? incoming : current
  const secondary =
    (incoming.revision ?? 0) >= (current.revision ?? 0) ? current : incoming
  const merged = sanitizeNotifications(mergeLmsData(primary, secondary))

  if (sameOperationalSnapshot(current, merged) && (incoming.revision ?? 0) <= (current.revision ?? 0)) {
    return 'noop'
  }

  merged.revision =
    Math.max(incoming.revision ?? 0, current.revision ?? 0, merged.revision ?? 0) + 1
  return merged
}

/** Merge client payload with the shared DB so no account loses the other's submissions. */
export async function mergeAndSave(incoming: LmsData): Promise<LmsData> {
  if (!usesCloudDatabase()) {
    const current = await readFileData()
    const merged = buildMerged(current, incoming)
    if (merged === 'noop') return current
    return writeFileData(merged)
  }

  // Neon / Postgres: optimistic concurrency so serverless instances stay in sync.
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readNeonData()
    const expectedRevision = current.revision ?? 0
    const merged = buildMerged(current, incoming)
    if (merged === 'noop') return current

    const saved = await writeNeonDataIfRevision(merged, expectedRevision)
    if (saved) return saved
  }

  // Last resort after races: force write the latest merge.
  const current = await readNeonData()
  const merged = buildMerged(current, incoming)
  if (merged === 'noop') return current
  return writeNeonData(merged)
}
