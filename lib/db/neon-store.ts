import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { createSeedData } from '@/lib/seed-data'
import { ensureHashedPasswords } from '@/lib/security/sanitize'
import { sanitizeNotifications } from '@/lib/lms-merge'
import type { LmsData } from '@/lib/types'

const ROW_ID = 'default'

let sql: NeonQueryFunction<false, false> | null = null
let schemaReady = false

/**
 * Neon sometimes adds channel_binding=require which breaks some serverless drivers.
 * Keep sslmode=require for encrypted connections.
 */
export function normalizeDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.searchParams.delete('channel_binding')
    if (!url.searchParams.get('sslmode')) {
      url.searchParams.set('sslmode', 'require')
    }
    return url.toString()
  } catch {
    return raw
      .replace(/([?&])channel_binding=require&?/g, '$1')
      .replace(/[?&]$/, '')
  }
}

function getSql() {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    throw new Error('DATABASE_URL is not set. Add it in Vercel Environment Variables and redeploy.')
  }
  if (!sql) {
    sql = neon(normalizeDatabaseUrl(raw))
  }
  return sql
}

async function ensureSchema() {
  if (schemaReady) return
  const db = getSql()
  await db`
    CREATE TABLE IF NOT EXISTS lms_data (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  schemaReady = true
}

function normalize(parsed: LmsData): LmsData {
  if (!Array.isArray(parsed.requisitions)) parsed.requisitions = []
  if (!Array.isArray(parsed.notifications)) parsed.notifications = []
  return sanitizeNotifications(parsed)
}

function asJsonPayload(data: LmsData) {
  // neon tagged templates accept objects as JSON; string + ::jsonb is also fine.
  return JSON.stringify(sanitizeNotifications(data))
}

async function seedIfEmpty(): Promise<LmsData> {
  const seed = createSeedData()
  const { data: hashedSeed } = ensureHashedPasswords(seed)
  const clean = sanitizeNotifications(hashedSeed)
  const db = getSql()
  await db`
    INSERT INTO lms_data (id, payload, updated_at)
    VALUES (${ROW_ID}, ${asJsonPayload(clean)}::jsonb, NOW())
    ON CONFLICT (id) DO NOTHING
  `
  // Re-read in case another instance seeded first.
  const rows = await db`
    SELECT payload FROM lms_data WHERE id = ${ROW_ID} LIMIT 1
  `
  if (rows[0]?.payload) {
    return normalize(
      typeof rows[0].payload === 'string'
        ? (JSON.parse(rows[0].payload) as LmsData)
        : (rows[0].payload as LmsData),
    )
  }
  return clean
}

/** Read the shared LMS document from Neon/Postgres. */
export async function readNeonData(): Promise<LmsData> {
  await ensureSchema()
  const db = getSql()
  const rows = await db`
    SELECT payload FROM lms_data WHERE id = ${ROW_ID} LIMIT 1
  `
  if (!rows[0]?.payload) {
    return seedIfEmpty()
  }

  const parsed = normalize(
    typeof rows[0].payload === 'string'
      ? (JSON.parse(rows[0].payload) as LmsData)
      : (rows[0].payload as LmsData),
  )

  if (!parsed?.roles?.length || !parsed?.users?.length) {
    return seedIfEmpty()
  }

  const { data, changed } = ensureHashedPasswords(parsed)
  if (changed) await writeNeonData(data)
  return data
}

/** Overwrite the shared LMS document in Neon/Postgres. */
export async function writeNeonData(data: LmsData): Promise<LmsData> {
  await ensureSchema()
  const clean = sanitizeNotifications(data)
  const db = getSql()
  await db`
    INSERT INTO lms_data (id, payload, updated_at)
    VALUES (${ROW_ID}, ${asJsonPayload(clean)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload,
          updated_at = NOW()
  `
  return clean
}

/**
 * Optimistic write: only succeeds if the stored revision still matches `expectedRevision`.
 * Returns the saved row, or null if someone else wrote first (caller should retry).
 */
export async function writeNeonDataIfRevision(
  data: LmsData,
  expectedRevision: number,
): Promise<LmsData | null> {
  await ensureSchema()
  const clean = sanitizeNotifications(data)
  const db = getSql()
  const rows = await db`
    UPDATE lms_data
    SET payload = ${asJsonPayload(clean)}::jsonb,
        updated_at = NOW()
    WHERE id = ${ROW_ID}
      AND COALESCE((payload->>'revision')::int, 0) = ${expectedRevision}
    RETURNING payload
  `
  if (!rows[0]?.payload) return null
  return clean
}
