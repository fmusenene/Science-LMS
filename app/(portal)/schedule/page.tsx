'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PageHeader } from '@/components/lms/page-header'
import { StatusBadge } from '@/components/lms/status-badge'
import { ConflictAlert } from '@/components/lms/conflict-alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLms } from '@/lib/lms-store'
import { addDays, startOfWeek, toISODate } from '@/lib/seed-data'
import {
  activeBookings,
  checkConflicts,
  formatDate,
  formatSlot,
  hasBlockingIssue,
} from '@/lib/scheduling'
import type { Requisition } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function SchedulePage() {
  const { data, can, userById, labById, updateRequisition } = useLms()
  const periods = data.settings.periods
  const canReschedule = can('schedule.manage')
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [labId, setLabId] = useState('')
  const [date, setDate] = useState('')
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '')

  useEffect(() => {
    setWeekStart(toISODate(startOfWeek(new Date())))
  }, [])

  useEffect(() => {
    if (periods.length && !periods.some((p) => p.id === periodId)) {
      setPeriodId(periods[0].id)
    }
  }, [periods, periodId])

  const days = useMemo(() => {
    if (!weekStart) return []
    const start = new Date(`${weekStart}T00:00:00`)
    return Array.from({ length: 5 }, (_, i) => toISODate(addDays(start, i)))
  }, [weekStart])

  const bookings = activeBookings(data.requisitions)
  const selected = selectedId
    ? data.requisitions.find((r) => r.id === selectedId) ?? null
    : null

  const period = periods.find((p) => p.id === periodId) ?? periods[0]
  const editSlot = {
    date,
    start: period?.start ?? '08:00',
    end: period?.end ?? '09:00',
    periodId: period?.id,
  }

  const issues = useMemo(() => {
    if (!selected || !editing || !period) return []
    return checkConflicts(
      {
        labId,
        slot: editSlot,
        studentCount: selected.studentCount,
        lines: selected.lines,
        excludeId: selected.id,
      },
      { labs: data.labs, items: data.items, requisitions: data.requisitions },
    )
  }, [selected, editing, labId, date, periodId, data, period])

  if (!periods.length) {
    return (
      <div>
        <PageHeader
          title="Lab schedule"
          description="Week view of laboratories across standard double periods."
        />
        <p className="rounded-xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
          No timetable periods configured. An administrator must add periods under Settings before the
          schedule can be used.
        </p>
      </div>
    )
  }

  const cell = (labKey: string, day: string, pId: string) => {
    const p = periods.find((x) => x.id === pId)
    if (!p) return undefined
    return bookings.find((r) => {
      if (r.labId !== labKey || r.slot.date !== day) return false
      if (r.slot.periodId) return r.slot.periodId === p.id
      return r.slot.start === p.start && r.slot.end === p.end
    })
  }

  const openBooking = (booking: Requisition) => {
    setSelectedId(booking.id)
    setEditing(false)
    setLabId(booking.labId)
    setDate(booking.slot.date)
    const match =
      (booking.slot.periodId
        ? periods.find((p) => p.id === booking.slot.periodId)
        : undefined) ??
      periods.find((p) => p.start === booking.slot.start && p.end === booking.slot.end)
    setPeriodId(match?.id ?? periods[0].id)
  }

  const closeModal = () => {
    setSelectedId(null)
    setEditing(false)
  }

  return (
    <div>
      <PageHeader
        title="Lab availability schedule"
        description="Week view of laboratories across standard double periods. Click a booking to view details without leaving the schedule."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:flex-none"
              disabled={!weekStart}
              onClick={() =>
                weekStart &&
                setWeekStart(toISODate(addDays(new Date(`${weekStart}T00:00:00`), -7)))
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:flex-none"
              onClick={() => setWeekStart(toISODate(startOfWeek(new Date())))}
            >
              This week
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:flex-none"
              disabled={!weekStart}
              onClick={() =>
                weekStart &&
                setWeekStart(toISODate(addDays(new Date(`${weekStart}T00:00:00`), 7)))
              }
            >
              Next
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Input
          type="date"
          value={weekStart ?? ''}
          disabled={!weekStart}
          onChange={(e) =>
            setWeekStart(toISODate(startOfWeek(new Date(`${e.target.value}T00:00:00`))))
          }
          className="w-full sm:w-auto"
        />
        <p className="text-sm text-muted-foreground">
          {weekStart ? `Week of ${weekStart}, Mon to Fri` : 'Loading week…'}
        </p>
      </div>

      {!weekStart ? (
        <p className="text-sm text-muted-foreground">Preparing timetable…</p>
      ) : (
        <div className="space-y-6">
        {data.labs.map((lab) => (
          <div key={lab.id} className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{lab.name}</p>
                <p className="text-xs text-muted-foreground">
                  Cap. {lab.capacity} · {lab.specialisation}
                </p>
              </div>
            </div>

            {/* Mobile: day cards */}
            <div className="space-y-3 p-3 md:hidden">
              {days.map((day) => {
                const dayBookings = periods
                  .map((p) => ({ period: p, booking: cell(lab.id, day, p.id) }))
                  .filter((x) => x.booking)
                return (
                  <div key={day} className="rounded-lg border border-border/80 p-3">
                    <p className="mb-2 text-sm font-medium">{formatDate(day)}</p>
                    {dayBookings.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No bookings this day</p>
                    ) : (
                      <div className="space-y-2">
                        {dayBookings.map(({ period: p, booking }) =>
                          booking ? (
                            <button
                              key={booking.id}
                              type="button"
                              onClick={() => openBooking(booking)}
                              className={cn(
                                'block w-full rounded-md px-3 py-2.5 text-left transition hover:opacity-90',
                                booking.status === 'in_progress'
                                  ? 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100'
                                  : booking.status === 'prepared'
                                    ? 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'
                                    : 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium">{booking.reference}</p>
                                  <p className="truncate text-xs opacity-80">{booking.topic}</p>
                                  <p className="text-xs opacity-70">
                                    {p.label} · {formatSlot({ date: '', start: p.start, end: p.end })}
                                  </p>
                                </div>
                                <StatusBadge status={booking.status} className="shrink-0 text-[10px]" />
                              </div>
                            </button>
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop week grid */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-muted-foreground shadow-[1px_0_0_0_var(--border)]">
                      Period
                    </th>
                      {days.map((d) => (
                      <th key={d} className="px-2 py-2 font-medium">
                        {formatDate(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b border-border/70 last:border-0">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 text-muted-foreground shadow-[1px_0_0_0_var(--border)]">
                        {p.label}
                        <br />
                        <span className="num">
                          {formatSlot({ date: '', start: p.start, end: p.end })}
                        </span>
                      </td>
                      {days.map((day) => {
                        const booking = cell(lab.id, day, p.id)
                        return (
                          <td key={day} className="p-1.5 align-top">
                            {booking ? (
                              <button
                                type="button"
                                onClick={() => openBooking(booking)}
                                className={cn(
                                  'block w-full rounded-md px-2 py-1.5 text-left transition hover:opacity-90',
                                  booking.status === 'in_progress'
                                    ? 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100'
                                    : booking.status === 'prepared'
                                      ? 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'
                                      : 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100',
                                )}
                              >
                                <p className="font-medium">{booking.reference}</p>
                                <p className="truncate opacity-80">{booking.subject}</p>
                                <p className="truncate opacity-70">
                                  {userById(booking.teacherId)?.name}
                                </p>
                                <div className="mt-1">
                                  <StatusBadge status={booking.status} className="text-[10px]" />
                                </div>
                              </button>
                            ) : (
                              <div className="rounded-md border border-dashed border-border/80 px-2 py-3 text-center text-muted-foreground">
                                Free
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.reference}
                  <StatusBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription>{selected.topic}</DialogDescription>
              </DialogHeader>

              {!editing ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Laboratory" value={labById(selected.labId)?.name ?? 'Not set'} />
                  <Field
                    label="Slot"
                    value={`${formatDate(selected.slot.date)} · ${formatSlot(selected.slot)}`}
                  />
                  <Field label="Teacher" value={userById(selected.teacherId)?.name ?? 'Not set'} />
                  <Field
                    label="Class"
                    value={`${selected.form} · ${selected.studentCount} students`}
                  />
                  <Field label="Subject" value={selected.subject} />
                  <Field label="Items requested" value={`${selected.lines.length} line(s)`} />
                  {selected.objectives ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Objectives</p>
                      <p className="mt-0.5">{selected.objectives}</p>
                    </div>
                  ) : null}
                  {selected.safetyNotes ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Safety notes</p>
                      <p className="mt-0.5">{selected.safetyNotes}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label>Laboratory</Label>
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={labId}
                      onChange={(e) => setLabId(e.target.value)}
                    >
                      {data.labs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} (cap. {l.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Date</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Period</Label>
                      <select
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={periodId}
                        onChange={(e) => setPeriodId(e.target.value)}
                      >
                        {periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} ({p.start} to {p.end})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <ConflictAlert issues={issues} />
                </div>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/requisitions/${selected.id}`} />}
                >
                  Open full requisition
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={closeModal}>
                    Close
                  </Button>
                  {canReschedule &&
                  ['submitted', 'approved', 'prepared'].includes(selected.status) ? (
                    editing ? (
                      <Button
                        disabled={hasBlockingIssue(issues)}
                        onClick={() => {
                          if (hasBlockingIssue(issues)) {
                            toast.error('Resolve conflicts before saving')
                            return
                          }
                          updateRequisition(selected.id, {
                            labId,
                            slot: editSlot,
                          })
                          toast.success('Schedule updated')
                          setEditing(false)
                        }}
                      >
                        Save schedule
                      </Button>
                    ) : (
                      <Button onClick={() => setEditing(true)}>Reschedule</Button>
                    )
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  )
}
