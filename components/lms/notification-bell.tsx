'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BellIcon, CheckCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLms } from '@/lib/lms-store'
import { formatDateTime } from '@/lib/scheduling'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const router = useRouter()
  const {
    data,
    currentUser,
    can,
    dismissNotification,
    clearMyNotifications,
  } = useLms()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const canApprove = can('requisitions.approve')
  const pendingCount = useMemo(
    () => data.requisitions.filter((r) => r.status === 'submitted').length,
    [data.requisitions],
  )

  // Inbox shows unread only — cleared/read items stay out of the list.
  const notifications = useMemo(() => {
    if (!currentUser) return []
    return (data.notifications ?? [])
      .filter((n) => n.userId === currentUser.id && !n.read)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30)
  }, [data.notifications, currentUser])

  const unread = notifications.length

  // Approvers: badge = pending queue size. Teachers: unread inbox count.
  const badgeCount = canApprove ? pendingCount : unread

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative min-h-9 min-w-9"
        aria-label={
          canApprove
            ? `${pendingCount} pending approval${pendingCount === 1 ? '' : 's'}`
            : unread
              ? `${unread} unread notifications`
              : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon className="size-4" />
        {badgeCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          className={cn(
            'absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl',
            'border border-border bg-popover text-popover-foreground shadow-lg',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {canApprove
                  ? `${pendingCount} pending approval${pendingCount === 1 ? '' : 's'}${unread ? ` · ${unread} new` : ''}`
                  : unread
                    ? `${unread} new`
                    : 'You are up to date'}
              </p>
            </div>
            {unread > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => clearMyNotifications()}
              >
                <CheckCheckIcon className="size-3.5" />
                Clear all
              </Button>
            ) : null}
          </div>

          {canApprove && pendingCount > 0 ? (
            <Link
              href="/requisitions?tab=queue"
              className="flex items-center justify-between gap-2 border-b border-border bg-warning-muted/50 px-3 py-2 text-xs hover:bg-warning-muted"
              onClick={() => setOpen(false)}
            >
              <span className="font-medium text-warning-foreground">
                {pendingCount} pending approval{pendingCount === 1 ? '' : 's'} — all teachers
              </span>
              <span className="text-primary">Open queue →</span>
            </Link>
          ) : null}

          <div className="max-h-[min(24rem,60dvh)] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {canApprove && pendingCount > 0
                  ? 'Open the queue above to review submissions.'
                  : 'No new notifications.'}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 bg-primary/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                      onClick={() => {
                        dismissNotification(n.id)
                        setOpen(false)
                        if (n.href) router.push(n.href)
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{n.title}</p>
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      <p className="text-[11px] text-muted-foreground/80">
                        {formatDateTime(n.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <Link
              href={canApprove ? '/requisitions?tab=queue' : '/requisitions'}
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {canApprove ? 'Open pending approvals' : 'Open requisitions'}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
