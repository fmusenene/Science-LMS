'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/lms/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLms } from '@/lib/lms-store'
import { durationMinutes, formatDateTime, formatTime } from '@/lib/scheduling'

export default function SessionsPage() {
  const { data, requisitionById, userById, labById, itemById } = useLms()
  const reasons = data.settings?.notDoneReasons ?? []
  const sessions = data.sessions ?? []
  const breakages = data.breakages ?? []
  const movements = data.movements ?? []

  const rows = [...sessions].sort((a, b) => (b.loggedAt ?? '').localeCompare(a.loggedAt ?? ''))

  return (
    <div>
      <PageHeader
        title="Session logs"
        description="Planned vs actual execution, incomplete reasons, consumable reconciliation and breakages."
      />

      <div className="rounded-xl ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Practical</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Logged by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No session logs yet. Attendants record these after a practical is completed.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((session) => {
                const req = requisitionById(session.requisitionId)
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Link
                        href={`/requisitions/${session.requisitionId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {req?.reference ?? session.requisitionId}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(session.loggedAt)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{req?.topic ?? 'Not set'}</p>
                      <p className="text-xs text-muted-foreground">
                        {labById(req?.labId)?.name ?? 'Not set'} · {req?.subject ?? 'Not set'}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>
                        Planned {formatTime(session.plannedStart)} to {formatTime(session.plannedEnd)} (
                        {durationMinutes(session.plannedStart, session.plannedEnd)}m)
                      </p>
                      <p>
                        Actual {formatTime(session.actualStart)} to {formatTime(session.actualEnd)} (
                        {durationMinutes(session.actualStart, session.actualEnd)}m)
                      </p>
                    </TableCell>
                    <TableCell>
                      {session.outcome === 'successful' ? (
                        <Badge className="border-transparent bg-success-muted text-success">
                          Successfully Done
                        </Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="destructive">Not Done</Badge>
                          <p className="text-xs text-muted-foreground">
                            {reasons.find((r) => r.id === session.notDoneReason)?.label ??
                              session.notDoneReason ??
                              'Not set'}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="num">{session.studentsPresent}</TableCell>
                    <TableCell>{userById(session.loggedBy)?.name ?? 'Not set'}</TableCell>
                  </TableRow>
                )
              })
            )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl ring-1 ring-foreground/10">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium">Breakage register</h2>
          </div>
          <div className="divide-y divide-border">
            {breakages.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No breakages recorded.</p>
            ) : (
              breakages.map((b) => (
                <div key={b.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">
                    {itemById(b.itemId)?.name ?? 'Unknown item'} × {b.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">{b.cause}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {userById(b.reportedBy)?.name ?? 'Not set'} · {formatDateTime(b.reportedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium">Recent consumable deductions</h2>
          </div>
          <div className="divide-y divide-border">
            {movements.filter((m) => m.kind === 'consumption').length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No consumable deductions yet.</p>
            ) : (
              movements
                .filter((m) => m.kind === 'consumption')
                .slice(0, 10)
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{itemById(m.itemId)?.name ?? 'Unknown item'}</p>
                      <p className="text-xs text-muted-foreground">{m.reason}</p>
                    </div>
                    <span className="num text-destructive">{m.delta}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
