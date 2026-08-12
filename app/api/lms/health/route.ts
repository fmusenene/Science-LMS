import { NextResponse } from 'next/server'
import { usesCloudDatabase } from '@/lib/server-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Lightweight check so deploy issues are easier to spot. Does not expose secrets. */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())
  const hasSessionSecret = Boolean(process.env.LMS_SESSION_SECRET?.trim())

  let database: 'neon' | 'file' | 'error' = usesCloudDatabase() ? 'neon' : 'file'
  let databaseOk = false
  let detail: string | undefined

  try {
    if (usesCloudDatabase()) {
      const { readNeonData } = await import('@/lib/db/neon-store')
      const data = await readNeonData()
      databaseOk = Boolean(data?.users?.length)
      database = 'neon'
    } else {
      const { readServerData } = await import('@/lib/server-db')
      const data = await readServerData()
      databaseOk = Boolean(data?.users?.length)
      database = 'file'
    }
  } catch (error) {
    database = 'error'
    databaseOk = false
    detail = error instanceof Error ? error.message : 'Database check failed'
  }

  const ok = hasDatabaseUrl && hasSessionSecret && databaseOk
  return NextResponse.json(
    {
      ok,
      hasDatabaseUrl,
      hasSessionSecret,
      database,
      databaseOk,
      detail: detail ? detail.replace(/postgresql:\/\/[^@]+@/i, 'postgresql://***@') : undefined,
    },
    { status: ok ? 200 : 503 },
  )
}
