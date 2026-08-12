import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { mergeAndSave, readServerData } from '@/lib/server-db'
import { rateLimit } from '@/lib/security/rate-limit'
import { reconcileUserPasswords, stripSecrets } from '@/lib/security/sanitize'
import { sessionFromRequest } from '@/lib/security/session'
import type { LmsData } from '@/lib/types'
import type { PermissionId } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hasPermission(data: LmsData, roleId: string, permission: PermissionId): boolean {
  const role = data.roles.find((r) => r.id === roleId)
  return Boolean(role?.permissions.includes(permission))
}

function unauthorized() {
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  try {
    const session = sessionFromRequest(request)
    if (!session) return unauthorized()

    const data = await readServerData()
    const user = data.users.find((u) => u.id === session.uid)
    if (!user?.active) return unauthorized()

    return NextResponse.json(stripSecrets(data))
  } catch (error) {
    console.error('[api/lms/data GET]', error)
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = sessionFromRequest(request)
    if (!session) return unauthorized()

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local'
    const limited = rateLimit(`put:${session.uid}:${ip}`, 60, 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many writes. Slow down.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
      )
    }

    const current = await readServerData()
    const actor = current.users.find((u) => u.id === session.uid)
    if (!actor?.active) return unauthorized()

    const body = (await request.json()) as LmsData
    if (!body?.roles?.length || !body?.users?.length) {
      return NextResponse.json({ error: 'Invalid LMS payload' }, { status: 400 })
    }

    // Privilege escalation guards — non-admins cannot rewrite roles / all users.
    let incoming = body
    if (!hasPermission(current, actor.roleId, 'roles.manage')) {
      incoming = { ...incoming, roles: current.roles }
    }
    if (!hasPermission(current, actor.roleId, 'users.manage')) {
      // Teachers may update their own profile fields only.
      const self = incoming.users.find((u) => u.id === actor.id)
      incoming = {
        ...incoming,
        users: current.users.map((u) => {
          if (u.id !== actor.id || !self) return u
          return {
            ...u,
            name: self.name || u.name,
            department: self.department,
            avatarUrl: self.avatarUrl,
            // password handled in reconcile — only if they sent a plaintext change for self
            password: self.password?.trim() ? self.password : u.password,
          }
        }),
      }
    }

    incoming = reconcileUserPasswords(incoming, current)
    const saved = await mergeAndSave(incoming)
    return NextResponse.json(stripSecrets(saved))
  } catch (error) {
    console.error('[api/lms/data PUT]', error)
    return NextResponse.json({ error: 'Failed to save database' }, { status: 500 })
  }
}
