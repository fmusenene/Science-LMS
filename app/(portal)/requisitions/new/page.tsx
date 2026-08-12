'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConflictAlert } from '@/components/lms/conflict-alert'
import { PageHeader } from '@/components/lms/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toISODate } from '@/lib/seed-data'
import { useLms } from '@/lib/lms-store'
import {
  availableQuantity,
  activeBookings,
  checkConflicts,
  formatSlot,
  hasBlockingIssue,
  sameBookingDate,
  suggestOpenSlot,
  type ConflictIssue,
} from '@/lib/scheduling'
import { CATEGORY_LABEL, type ItemCategory, type RequisitionLine } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORIES: ItemCategory[] = ['apparatus', 'chemical', 'reagent']

export default function NewRequisitionPage() {
  const { data, currentUser, can, createRequisition } = useLms()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { periods, subjects, forms } = data.settings
  const canCreate = can('requisitions.create')

  const teachers = data.users.filter((u) => {
    if (!u.active) return false
    if (u.roleId === 'role-teacher') return true
    const role = data.roles.find((r) => r.id === u.roleId)
    return role?.permissions.includes('requisitions.create') ?? false
  })
  /** Teachers with only own-view lock the request to themselves. */
  const lockToSelf = Boolean(currentUser) && canCreate && !can('requisitions.view_all')
  const defaultTeacher = lockToSelf
    ? currentUser!.id
    : teachers[0]?.id ?? currentUser?.id ?? ''

  const [defaults] = useState(() => {
    const open = suggestOpenSlot({
      labs: data.labs,
      periods,
      requisitions: data.requisitions,
      studentCount: 30,
    })
    return {
      labId: open?.labId ?? data.labs[0]?.id ?? '',
      date: open?.date ?? toISODate(new Date(Date.now() + 86400000 * 3)),
      periodId: open?.periodId ?? periods[1]?.id ?? periods[0]?.id ?? '',
    }
  })

  const [teacherId, setTeacherId] = useState(defaultTeacher)
  const [labId, setLabId] = useState(defaults.labId)
  const [subject, setSubject] = useState<string>(subjects[0] ?? '')
  const [topic, setTopic] = useState('')
  const [form, setForm] = useState<string>(forms[Math.min(2, Math.max(forms.length - 1, 0))] ?? forms[0] ?? '')
  const [studentCount, setStudentCount] = useState(30)
  const [date, setDate] = useState(defaults.date)
  const [periodId, setPeriodId] = useState<string>(defaults.periodId)
  const [objectives, setObjectives] = useState('')
  const [safetyNotes, setSafetyNotes] = useState('')
  const [lines, setLines] = useState<RequisitionLine[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [categoryTab, setCategoryTab] = useState<ItemCategory | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const savingRef = useRef(false)

  // Keep periodId aligned with configured timetable (no silent fallback to Period 1).
  useEffect(() => {
    if (!periods.length) return
    if (!periods.some((p) => p.id === periodId)) {
      setPeriodId(periods[0]?.id ?? '')
    }
  }, [periods, periodId])

  const period = periods.find((p) => p.id === periodId)
  const slotValid = Boolean(period && date && periodId)
  const slot = {
    date,
    start: period?.start ?? '',
    end: period?.end ?? '',
    periodId: period?.id,
  }
  const lab = data.labs.find((l) => l.id === labId)

  const selectedLines = useMemo(() => lines.filter((l) => l.quantity > 0), [lines])

  const issues: ConflictIssue[] = useMemo(() => {
    // After a successful submit, hide clashes — the new booking is YOUR request, not an error.
    if (submitDone || !slotValid || !labId) return []
    return checkConflicts(
      {
        labId,
        slot,
        studentCount,
        lines: selectedLines,
        excludeId: submittedId ?? undefined,
      },
      {
        labs: data.labs,
        items: data.items,
        requisitions: data.requisitions,
        periods,
      },
    )
  }, [
    submitDone,
    submittedId,
    labId,
    slot.date,
    slot.start,
    slot.end,
    slot.periodId,
    slotValid,
    studentCount,
    selectedLines,
    data.labs,
    data.items,
    data.requisitions,
    periods,
  ])

  const labBlocked = useMemo(
    () => issues.some((i) => i.level === 'error' && i.code === 'lab_double_booked'),
    [issues],
  )
  const submitBlocked = hasBlockingIssue(issues)

  const takenSlots = useMemo(() => {
    if (submitDone) return []
    return activeBookings(data.requisitions)
      .filter(
        (r) =>
          r.id !== submittedId &&
          r.labId === labId &&
          sameBookingDate(r.slot.date, date),
      )
      .map((r) => {
        const label =
          periods.find((p) => p.id === r.slot.periodId)?.label ??
          `Slot ${formatSlot(r.slot)}`
        return { id: r.id, reference: r.reference, label, slot: r.slot }
      })
      .sort((a, b) => a.slot.start.localeCompare(b.slot.start))
  }, [submitDone, submittedId, data.requisitions, labId, date, periods])

  const catalogue = useMemo(() => {
    let items = data.items
    if (categoryTab !== 'all') items = items.filter((i) => i.category === categoryTab)
    if (itemSearch.trim()) {
      const n = itemSearch.toLowerCase()
      items = items.filter(
        (i) => i.name.toLowerCase().includes(n) || i.code.toLowerCase().includes(n),
      )
    }
    return items
  }, [data.items, categoryTab, itemSearch])

  // Free qty only for visible catalogue rows — avoid scanning every item on each keystroke.
  const freeByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of catalogue) {
      map.set(item.id, availableQuantity(item, data.requisitions, slot))
    }
    return map
  }, [catalogue, data.requisitions, slot.date, slot.start, slot.end, slot.periodId])

  const setQty = (itemId: string, quantity: number) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.itemId !== itemId)
      if (quantity > 0) next.push({ itemId, quantity })
      return next
    })
  }

  const qtyOf = (itemId: string) => lines.find((l) => l.itemId === itemId)?.quantity ?? 0

  const save = async (submit: boolean) => {
    if (savingRef.current || busy || submitDone) return
    savingRef.current = true
    setBusy(true)
    toast.dismiss('req-save')
    toast.dismiss('req-conflict')
    let navigatingAway = false

    try {
      if (!canCreate) {
        toast.error('You do not have permission to create requisitions', {
          duration: 8_000,
          id: 'req-save',
        })
        return
      }
      if (!periods.length || !subjects.length || !forms.length) {
        toast.error('Periods, subjects or forms are not configured', {
          duration: 8_000,
          id: 'req-save',
        })
        return
      }
      if (!teacherId || !labId || !topic.trim()) {
        toast.error('Teacher, laboratory and topic are required', {
          duration: 8_000,
          id: 'req-save',
        })
        return
      }
      if (!slotValid || !period) {
        toast.error('Choose a valid timetable period before submitting', {
          duration: 8_000,
          id: 'req-save',
        })
        return
      }
      if (submit && selectedLines.length === 0) {
        toast.error('Add at least one apparatus, chemical or reagent line', {
          duration: 8_000,
          id: 'req-save',
        })
        return
      }

      const submitSlot = {
        date,
        start: period.start,
        end: period.end,
        periodId: period.id,
      }

      if (submit) {
        const liveIssues = checkConflicts(
          {
            labId,
            slot: submitSlot,
            studentCount,
            lines: selectedLines,
          },
          {
            labs: data.labs,
            items: data.items,
            requisitions: data.requisitions,
            periods,
          },
        )
        if (hasBlockingIssue(liveIssues)) {
          const labIssue = liveIssues.find((i) => i.level === 'error' && i.code === 'lab_double_booked')
          const stockIssue = liveIssues.find(
            (i) => i.level === 'error' && i.code === 'insufficient_stock',
          )
          const capIssue = liveIssues.find((i) => i.level === 'error' && i.code === 'over_capacity')
          const first =
            labIssue ?? stockIssue ?? capIssue ?? liveIssues.find((i) => i.level === 'error')
          toast.error(first?.message ?? 'Cannot submit. Please fix the errors on the form first.', {
            duration: 12_000,
            id: 'req-conflict',
          })
          return
        }
      }

      const result = await createRequisition(
        {
          teacherId,
          labId,
          subject,
          topic: topic.trim(),
          form,
          studentCount,
          slot: submitSlot,
          lines: selectedLines,
          objectives: objectives.trim(),
          safetyNotes: safetyNotes.trim(),
        },
        submit,
      )

      if (!result.ok) {
        const isLab = /already booked|laboratory|lab\/date|period or date/i.test(result.error)
        toast.error(result.error, {
          duration: 12_000,
          id: isLab ? 'req-conflict' : 'req-save',
        })
        return
      }

      if (submit && !result.submitted) {
        toast.error('Submit did not complete. Please try again.', {
          duration: 8_000,
          id: 'req-save',
        })
        return
      }

      // Success: hide conflict UI before store refresh can paint "own booking" as an error.
      navigatingAway = true
      setSubmittedId(result.id)
      setSubmitDone(true)
      toast.dismiss('req-conflict')
      toast.success(
        result.submitted
          ? 'Submitted. Admin and attendants can now review this request.'
          : 'Draft saved',
        { duration: 5_500, id: 'req-save' },
      )
      startTransition(() => {
        router.replace(result.submitted ? '/requisitions?tab=queue' : '/requisitions?tab=draft')
      })
    } finally {
      if (!navigatingAway) {
        savingRef.current = false
        setBusy(false)
      }
    }
  }

  if (!canCreate) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">You do not have permission to create requisitions.</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push('/requisitions')}>
          Back to list
        </Button>
      </div>
    )
  }

  if (!periods.length || !subjects.length || !forms.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          Periods, subjects or forms are not configured. Ask an administrator to update Settings.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/requisitions"
        className={cn(
          'mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground',
          'transition-all duration-200 hover:gap-2.5 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
      >
        <ArrowLeftIcon className="size-4 shrink-0" />
        Back to requisitions
      </Link>

      <PageHeader
        title="New practical requisition"
        description="Choose the lab, timetable slot, class size, and the apparatus, chemical or reagent checklist."
      />

      <div className="grid gap-4 pb-24 lg:grid-cols-3 lg:pb-0">
        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Lesson details</CardTitle>
              <CardDescription>Core booking fields used for conflict checks</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {!lockToSelf ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="teacher">Teacher</Label>
                  <select
                    id="teacher"
                    className={selectClass}
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.department}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="lab">Target laboratory</Label>
                <select
                  id="lab"
                  className={selectClass}
                  value={labId}
                  onChange={(e) => setLabId(e.target.value)}
                >
                  {data.labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (cap. {l.capacity}) · {l.specialisation}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <select
                  id="subject"
                  className={selectClass}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="topic">Topic / practical title</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Acid-base titration of HCl against NaOH"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form">Form / class</Label>
                <select
                  id="form"
                  className={selectClass}
                  value={form}
                  onChange={(e) => setForm(e.target.value)}
                >
                  {forms.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="students">Number of students</Label>
                <Input
                  id="students"
                  type="number"
                  min={1}
                  max={lab?.capacity ?? 60}
                  value={studentCount}
                  onChange={(e) => setStudentCount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period">Time slot</Label>
                <select
                  id="period"
                  className={selectClass}
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="objectives">Lesson objectives</Label>
                <Textarea
                  id="objectives"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="safety">Safety notes</Label>
                <Textarea
                  id="safety"
                  value={safetyNotes}
                  onChange={(e) => setSafetyNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Apparatus & chemical checklist</CardTitle>
              <CardDescription>
                Quantities are checked against overlapping reservations for the selected slot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search catalogue…"
                  className="max-w-sm"
                />
                <div className="flex flex-wrap gap-1">
                  <Chip active={categoryTab === 'all'} onClick={() => setCategoryTab('all')}>
                    All
                  </Chip>
                  {CATEGORIES.map((c) => (
                    <Chip key={c} active={categoryTab === c} onClick={() => setCategoryTab(c)}>
                      {CATEGORY_LABEL[c]}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {catalogue.map((item) => {
                  const available = freeByItem.get(item.id) ?? 0
                  const qty = qtyOf(item.id)
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 sm:grid-cols-[1fr_7rem_5.5rem]',
                        qty > 0 && 'bg-accent/40',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {CATEGORY_LABEL[item.category]} · {item.code} · free{' '}
                          <span className="num">{Math.max(0, available)}</span> {item.unit}
                        </p>
                      </div>
                      <Badge variant="outline" className="hidden justify-self-end sm:inline-flex">
                        on hand {item.onHand}
                      </Badge>
                      <Input
                        type="number"
                        min={0}
                        className="w-[5.5rem] justify-self-end"
                        value={qty || ''}
                        placeholder="0"
                        onChange={(e) => setQty(item.id, Number(e.target.value) || 0)}
                      />
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected lines: {lines.filter((l) => l.quantity > 0).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="order-first space-y-4 lg:order-none">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Conflict check</CardTitle>
              <CardDescription>Rooms and overlapping apparatus commitments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {submitDone ? (
                <p className="text-sm font-medium text-success">
                  Submitted successfully. Opening your requisitions list…
                </p>
              ) : (
                <>
                  <ConflictAlert issues={issues} />
                  {!issues.length ? (
                    <p className="text-sm text-success">
                      No blocking conflicts detected for this booking.
                    </p>
                  ) : null}
                </>
              )}
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <p>
                  Lab capacity: <span className="num font-medium text-foreground">{lab?.capacity ?? 'Not set'}</span>
                </p>
                <p className="font-medium text-foreground">
                  Your selection: {lab?.name ?? 'Lab'} · {date} · {period?.label ?? 'Period'} (
                  {slot.start} to {slot.end})
                </p>
                {labBlocked && !submitDone ? (
                  <p className="mt-1 font-medium text-destructive">
                    Submission blocked. This lab is taken for that period. Pick another lab, period or
                    date.
                  </p>
                ) : null}
                {!submitDone && takenSlots.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="font-medium text-foreground">Already booked on this lab / day:</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {takenSlots.map((t) => (
                        <li key={t.id}>
                          {t.label} ({formatSlot(t.slot)}): {t.reference}
                          {t.slot.periodId && periodId === t.slot.periodId
                            ? ' ← conflicts with your selection'
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : !submitDone ? (
                  <p className="mt-1">No other bookings for this lab on this date. The slot is free.</p>
                ) : null}
              </div>
              <div className="hidden flex-col gap-2 lg:flex">
                <Button
                  onClick={() => save(true)}
                  disabled={busy || !slotValid || submitBlocked}
                >
                  {busy ? 'Submitting…' : 'Submit for verification'}
                </Button>
                <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                  Save as draft
                </Button>
                <Button variant="ghost" onClick={() => router.push('/requisitions')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky mobile submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">
          <Button variant="outline" className="min-h-11 flex-1" onClick={() => save(false)} disabled={busy}>
            Save draft
          </Button>
          <Button
            className="min-h-11 flex-[1.4]"
            onClick={() => save(true)}
            disabled={busy || !slotValid || submitBlocked}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full px-3 py-1.5 text-xs font-medium',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
