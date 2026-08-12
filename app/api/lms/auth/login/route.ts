import { NextResponse } from 'next/server'
import { readServerData, writeServerData } from '@/lib/server-db'
import { fingerprint, verifyPassword } from '@/lib/security/password'
import { rateLimit } from '@/lib/security/rate-limit'
import { ensureHashedPasswords, stripSecrets } from '@/lib/security/sanitize'
import {
  applySessionCookie,
  createSessionPayload,
} from '@/lib/security/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local'
    const limited = rateLimit(`login:${ip}`, 8, 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
      )
    }

    const body = (await request.json().catch(() => null)) as {
      email?: string
      password?: string
    } | null
    const email = body?.email?.trim().toLowerCase() ?? ''
    const password = body?.password ?? ''
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    // Per-account throttle (slows credential stuffing even behind shared IP).
    const accountLimit = rateLimit(`login-user:${fingerprint(email)}`, 5, 5 * 60_000)
    if (!accountLimit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts for this account. Try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(accountLimit.retryAfterSec) } },
      )
    }

    let data = await readServerData()
    const migrated = ensureHashedPasswords(data)
    if (migrated.changed) {
      data = await writeServerData(migrated.data)
    } else {
      data = migrated.data
    }

    const user = data.users.find((u) => u.email.toLowerCase() === email)
    // Uniform failure message — avoid user enumeration
    if (!user || !user.active || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const payload = createSessionPayload(user.id, user.roleId)
    const res = NextResponse.json({
      ok: true,
      userId: user.id,
      roleId: user.roleId,
      data: stripSecrets(data),
    })
    applySessionCookie(res, payload)
    return res
  } catch (error) {
    console.error('[api/lms/auth/login]', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('DATABASE_URL')) {
      return NextResponse.json(
        {
          error:
            'Database is not configured. In Vercel set DATABASE_URL, then Redeploy.',
        },
        { status: 500 },
      )
    }
    if (/neon|postgres|fetch failed|ECONN|ssl|timeout|password authentication/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Cannot reach the database. Check DATABASE_URL in Vercel (use the pooled Neon URL, sslmode=require) and Redeploy.',
        },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'Sign-in failed.' }, { status: 500 })
  }
}
