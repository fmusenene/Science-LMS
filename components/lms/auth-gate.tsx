'use client'

import { useEffect, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLms } from '@/lib/lms-store'
import { AppShell } from '@/components/lms/app-shell'
import { APP_ROUTE_GATES, firstAccessiblePath, type PermissionId } from '@/lib/permissions'

type Gate = {
  path: string
  anyOf: PermissionId[]
}

const PERMISSION_GATES: Gate[] = [
  ...APP_ROUTE_GATES,
  { path: '/requisitions/new', anyOf: ['requisitions.create'] },
]

function matchGate(pathname: string): Gate | undefined {
  const gates = [...PERMISSION_GATES].sort((a, b) => b.path.length - a.path.length)
  return gates.find((g) => pathname === g.path || pathname.startsWith(`${g.path}/`))
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { currentUser, can } = useLms()
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const gate = currentUser ? matchGate(pathname) : undefined
  const denied = Boolean(gate && !gate.anyOf.some((p) => can(p)))

  useEffect(() => {
    if (!currentUser) {
      startTransition(() => {
        router.replace('/')
      })
      return
    }
    if (denied) {
      startTransition(() => {
        router.replace(firstAccessiblePath(can))
      })
    }
    // Intentionally omit `can` — it is recreated on every data tick and was causing redirect flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, denied, router, pathname])

  // Keep the shell chrome mounted whenever possible so CSS/layout never flash away.
  if (!currentUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    )
  }

  if (denied) {
    return (
      <AppShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Opening…</p>
        </div>
      </AppShell>
    )
  }

  return <AppShell>{children}</AppShell>
}
