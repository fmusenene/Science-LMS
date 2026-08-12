import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

export const SESSION_COOKIE = 'lms_session'
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours absolute max
export const IDLE_TTL_MS = 5 * 60 * 1000 // mirrored client idle policy

export type SessionPayload = {
  uid: string
  rid: string
  exp: number
  iat: number
  v: 1
}

function secret(): string {
  const fromEnv = process.env.LMS_SESSION_SECRET?.trim()
  if (fromEnv && fromEnv.length >= 24) return fromEnv
  // Deterministic fallback for local demos — override in production via .env
  return 'lms-local-demo-secret-change-me-now!!'
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body)}`
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (payload?.v !== 1 || !payload.uid || !payload.rid || !payload.exp) return null
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function sessionFromRequest(request: NextRequest | Request): SessionPayload | null {
  const header = request.headers.get('cookie') ?? ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null
  return decodeSession(raw)
}

export async function sessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies()
  return decodeSession(jar.get(SESSION_COOKIE)?.value)
}

export function applySessionCookie(res: NextResponse, payload: SessionPayload): void {
  const token = encodeSession(payload)
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function createSessionPayload(uid: string, rid: string): SessionPayload {
  const now = Date.now()
  return {
    v: 1,
    uid,
    rid,
    iat: now,
    exp: now + SESSION_TTL_MS,
  }
}
