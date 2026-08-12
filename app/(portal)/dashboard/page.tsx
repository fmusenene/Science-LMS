'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/lms/page-header'
import { StatCard } from '@/components/lms/stat-card'
import { StatusBadge } from '@/components/lms/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLms } from '@/lib/lms-store'
import { isExpiringSoon, isLowStock, formatDate, formatDateTime, formatSlot } from '@/lib/scheduling'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { data, currentUser, currentRole, can, labById, userById } = useLms()
  if (!currentUser) return null

  const seeAll = can('requisitions.view_all')
  const canApprove = can('requisitions.approve')
  /** Approvers/admins always see the staff pending queue, even if they can also create. */
  const staffDashboard = seeAll || canApprove

  const pending = data.requisitions
    .filter((r) => r.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt))

  const live = data.requisitions.filter((r) =>
    ['approved', 'prepared', 'in_progress'].includes(r.status),
  )
  const lowStock = data.items.filter(isLowStock)
  const expiring = data.items.filter((i) => isExpiringSoon(i, 60))
  const myReqs = data.requisitions.filter((r) => r.teacherId === currentUser.id)
  const today = new Date().toISOString().slice(0, 10)
  const todaySessions = data.requisitions.filter(
    (r) =>
      r.slot.date === today &&
      !['draft', 'cancelled', 'rejected'].includes(r.status) &&
      (staffDashboard || r.teacherId === currentUser.id),
  )

  const recent = staffDashboard
    ? [...data.requisitions]
        .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt))
        .slice(0, 6)
    : [...myReqs]
        .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt))
        .slice(0, 6)

  const roleLabel = currentRole?.name ?? 'Staff'

  return (
    <div>
      <PageHeader
        title={`Good day, ${currentUser.name.split(' ')[0]}`}
        description={`${roleLabel} workspace for inventory, bookings and sessions across all labs.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canApprove ? (
              <Button nativeButton={false} render={<Link href="/requisitions?tab=queue" />}>
                Review queue ({pending.length})
              </Button>
            ) : null}
            {can('requisitions.create') ? (
              <Button
                variant={canApprove ? 'outline' : 'default'}
                nativeButton={false}
                render={<Link href="/requisitions/new" />}
              >
                New requisition
              </Button>
            ) : null}
            {!canApprove && !can('requisitions.create') && can('users.manage') ? (
              <Button nativeButton={false} render={<Link href="/users" />} variant="outline">
                Manage users
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!staffDashboard && can('requisitions.view_own') ? (
          <>
            <StatCard label="My requisitions" value={myReqs.length} hint="All statuses" />
            <StatCard
              label="Awaiting approval"
              value={myReqs.filter((r) => r.status === 'submitted').length}
              tone="warning"
              hint="Your submitted requests (same queue admin reviews)"
            />
            <StatCard
              label="Upcoming booked"
              value={myReqs.filter((r) => ['approved', 'prepared'].includes(r.status)).length}
              tone="success"
            />
            <StatCard label="Labs available" value={data.labs.length} hint="Student capacity tracked per room" />
          </>
        ) : (
          <>
            <StatCard
              label="Pending approvals"
              value={pending.length}
              tone={pending.length ? 'warning' : 'default'}
              hint={
                pending.length
                  ? `All teachers · ${pending.length} waiting for approve & reserve`
                  : 'All teachers · none waiting'
              }
              href="/requisitions?tab=queue"
            />
            <StatCard label="Live reservations" value={live.length} tone="success" />
            <StatCard label="Low stock items" value={lowStock.length} tone={lowStock.length ? 'danger' : 'default'} />
            <StatCard label="Expiring ≤60 days" value={expiring.length} tone={expiring.length ? 'warning' : 'default'} />
          </>
        )}
      </div>

      {staffDashboard && canApprove ? (
        <Card className="mb-4 shadow-none border-warning/30 bg-warning-muted/40">
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Awaiting your review</CardTitle>
              <CardDescription>
                Teacher submissions ready to approve and reserve. {pending.length} pending.
              </CardDescription>
            </div>
            <Button nativeButton={false} render={<Link href="/requisitions?tab=queue" />}>
              Open queue
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No requisitions waiting. When a teacher submits, it appears here and in your notification bell.
              </p>
            ) : (
              pending.slice(0, 8).map((req) => (
                <Link
                  key={req.id}
                  href={`/requisitions/${req.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background px-3 py-2.5 transition hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {req.reference} · {req.topic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {userById(req.teacherId)?.name ?? 'Teacher'} · {labById(req.labId)?.name} ·{' '}
                      {formatSlot(req.slot)} · {formatDate(req.slot.date)}
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle>Today&apos;s practicals</CardTitle>
            <CardDescription>
              {todaySessions.length} scheduled session(s) for {today}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practicals booked for today.</p>
            ) : (
              todaySessions
                .sort((a, b) => a.slot.start.localeCompare(b.slot.start))
                .map((req) => (
                  <Link
                    key={req.id}
                    href={`/requisitions/${req.id}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/80 px-3 py-2.5 transition hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{req.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        {labById(req.labId)?.name} · {formatSlot(req.slot)} ·{' '}
                        {userById(req.teacherId)?.name}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle>{staffDashboard ? 'Recent requisitions' : 'My recent requests'}</CardTitle>
            <CardDescription>Jump into the workflow pipeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((req) => (
              <Link
                key={req.id}
                href={`/requisitions/${req.id}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{req.reference}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(req.slot.date)} · {labById(req.labId)?.code}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {can('inventory.view') && lowStock.length > 0 && staffDashboard ? (
        <Card className="mt-4 shadow-none">
          <CardHeader>
            <CardTitle>Reorder alerts</CardTitle>
            <CardDescription>Items at or below reorder level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStock.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
                >
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="num text-xs text-muted-foreground">
                    On hand {item.onHand} {item.unit} · reorder at {item.reorderLevel}
                  </p>
                </div>
              ))}
            </div>
            <Button
              variant="link"
              className="mt-2 px-0"
              nativeButton={false}
              render={<Link href="/inventory" />}
            >
              Open inventory
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {can('inventory.view') ? (
        <Card className="mt-4 shadow-none">
          <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row">
            <div>
              <CardTitle>Recent stock movements</CardTitle>
              <CardDescription>Receipts, consumption, breakages and adjustments</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/inventory" />}
            >
              Open inventory
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock movements recorded yet.</p>
            ) : (
              data.movements.slice(0, 10).map((m) => {
                const item = data.items.find((i) => i.id === m.itemId)
                return (
                  <div
                    key={m.id}
                    className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item?.name ?? m.itemId}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.kind} · {m.reason}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                        {userById(m.actorId) ? ` · ${userById(m.actorId)?.name}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'num shrink-0 text-sm font-medium',
                        m.delta < 0 ? 'text-destructive' : 'text-success',
                      )}
                    >
                      {m.delta > 0 ? '+' : ''}
                      {m.delta} {item?.unit}
                    </span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
