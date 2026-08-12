import { NextResponse } from 'next/server'
import { readServerData } from '@/lib/server-db'
import { stripSecrets } from '@/lib/security/sanitize'
import { sessionFromCookies } from '@/lib/security/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await sessionFromCookies()
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  const data = await readServerData()
  const user = data.users.find((u) => u.id === session.uid)
  if (!user || !user.active) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    roleId: user.roleId,
    data: stripSecrets(data),
  })
}
