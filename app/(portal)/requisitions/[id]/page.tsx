'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConflictAlert } from '@/components/lms/conflict-alert'
import { PageHeader } from '@/components/lms/page-header'
import { StatusBadge } from '@/components/lms/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { useLms } from '@/lib/lms-store'
import {
  checkConflicts,
  durationMinutes,
  formatDate,
  formatDateTime,
  formatSlot,
  formatTime,
  hasBlockingIssue,
} from '@/lib/scheduling'
import {
  CATEGORY_LABEL,
  REQUISITION_FLOW,
  type NotDoneReason,
  type RequisitionLine,
  type SessionOutcome,
} from '@/lib/types'
import { cn } from '@/lib/utils'

export default function RequisitionDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const {
    data,
    currentUser,
    can,
    requisitionById,
    labById,
    userById,
    itemById,
    sessionForRequisition,
    approveRequisition,
    rejectRequisition,
    markPrepared,
    startSession,
    completeSession,
    submitRequisition,
    cancelRequisition,
    deleteRequisition,
    updateRequisition,
  } = useLms()

  const requisitionId = Array.isArray(params.id) ? params.id[0] : params.id
  const req = requisitionId ? requisitionById(requisitionId) : undefined
  const session = req ? sessionForRequisition(req.id) : undefined
  const [note, setNote] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    subject: '',
    topic: '',
    form: '',
    studentCount: 0,
    objectives: '',
    safetyNotes: '',
  })

  const issues = useMemo(() => {
    if (!req) return []
    return checkConflicts(
      {
        labId: req.labId,
        slot: req.slot,
        studentCount: req.studentCount,
        lines: req.lines,
        excludeId: req.id,
      },
      { labs: data.labs, items: data.items, requisitions: data.requisitions },
    )
  }, [req, data])

  useEffect(() => {
    if (!req || !currentUser) return
    const mayViewAll = can('requisitions.view_all')
    const mayViewOwn = can('requisitions.view_own') || can('requisitions.create')
    if (!mayViewAll && mayViewOwn && req.teacherId !== currentUser.id) {
      startTransition(() => {
        router.replace('/requisitions')
      })
    }
  }, [req, currentUser, can, router, startTransition])

  if (!req || !currentUser) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Requisition not found.</p>
        <Button
          className="mt-4"
          variant="outline"
          nativeButton={false}
          render={<Link href="/requisitions" />}
        >
          Back to list
        </Button>
      </div>
    )
  }

  const mayViewAll = can('requisitions.view_all')
  const mayViewOwn = can('requisitions.view_own') || can('requisitions.create')
  if (!mayViewAll && mayViewOwn && req.teacherId !== currentUser.id) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">You do not have access to this requisition.</p>
      </div>
    )
  }

  const lab = labById(req.labId)
  const teacher = userById(req.teacherId)
  const canApprove = can('requisitions.approve')
  const canPrepare = can('requisitions.prepare')
  const canComplete = can('requisitions.complete')
  const isOwner =
    currentUser.id === req.teacherId &&
    (can('requisitions.create') || can('requisitions.view_own'))

  const flowIndex = REQUISITION_FLOW.indexOf(
    req.status === 'not_done' ? 'completed' : (req.status as (typeof REQUISITION_FLOW)[number]),
  )

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
        <ArrowLeftIcon className="size-4 shrink-0 transition-transform duration-200" />
        Back to requisitions
      </Link>

      <PageHeader
        title={req.reference}
        description={`${req.subject} · ${req.topic}`}
        actions={<StatusBadge status={req.status} className="h-7 px-3 text-sm" />}
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {REQUISITION_FLOW.map((step, idx) => {
          const done =
            req.status === 'completed' ||
            req.status === 'not_done' ||
            (flowIndex >= 0 && idx <= flowIndex)
          const current = REQUISITION_FLOW[flowIndex] === step && req.status !== 'completed' && req.status !== 'not_done'
          return (
            <span
              key={step}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium',
                current && 'bg-primary text-primary-foreground',
                done && !current && 'bg-success-muted text-success',
                !done && !current && 'bg-muted text-muted-foreground',
              )}
            >
              {step.replace('_', ' ')}
            </span>
          )
        })}
        {req.status === 'not_done' ? (
          <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
            not done
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Booking</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field label="Laboratory" value={`${lab?.name ?? 'Not set'} (${lab?.code})`} />
              <Field label="Slot" value={`${formatDate(req.slot.date)} · ${formatSlot(req.slot)}`} />
              <Field label="Teacher" value={teacher?.name ?? 'Not set'} />
              <Field label="Class" value={`${req.form} · ${req.studentCount} students`} />
              <Field label="Capacity check" value={lab ? `${lab.capacity} seats` : 'Not set'} />
              <Field label="Submitted" value={formatDateTime(req.submittedAt)} />
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Objectives</p>
                <p className="mt-0.5">{req.objectives || 'Not set'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Safety notes</p>
                <p className="mt-0.5">{req.safetyNotes || 'Not set'}</p>
              </div>
              {req.reviewNote ? (
                <div className="sm:col-span-2 rounded-lg bg-muted/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Attendant note</p>
                  <p className="mt-0.5">{req.reviewNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Requested items</CardTitle>
              <CardDescription>Apparatus, chemicals and reagents for this practical</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {req.lines.map((line) => {
                const item = itemById(line.itemId)
                if (!item) return null
                return (
                  <div
                    key={line.itemId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[item.category]} · {item.code}
                        {item.consumable ? ' · consumable' : ' · returnable'}
                      </p>
                    </div>
                    <p className="num text-sm font-medium">
                      {line.quantity} {item.unit}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {session ? (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Session log</CardTitle>
                <CardDescription>
                  Outcome: {session.outcome === 'successful' ? 'Successfully Done' : 'Not Done'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <Field
                  label="Planned"
                  value={`${formatTime(session.plannedStart)} to ${formatTime(session.plannedEnd)} (${durationMinutes(session.plannedStart, session.plannedEnd)} min)`}
                />
                <Field
                  label="Actual"
                  value={`${formatTime(session.actualStart)} to ${formatTime(session.actualEnd)} (${durationMinutes(session.actualStart, session.actualEnd)} min)`}
                />
                <Field label="Students present" value={String(session.studentsPresent)} />
                <Field label="Logged by" value={userById(session.loggedBy)?.name ?? 'Not set'} />
                {session.notDoneReason ? (
                  <Field
                    label="Not-done reason"
                    value={
                      data.settings.notDoneReasons.find((r) => r.id === session.notDoneReason)?.label ??
                      session.notDoneReason
                    }
                  />
                ) : null}
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Remarks</p>
                  <p className="mt-0.5">{session.remarks || 'Not set'}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {(req.status === 'submitted' || req.status === 'draft') && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Conflict scan</CardTitle>
              </CardHeader>
              <CardContent>
                <ConflictAlert issues={issues} />
                {!issues.length ? (
                  <p className="text-sm text-success">Clear to approve / submit.</p>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Advance or close this requisition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isOwner && req.status === 'draft' ? (
                <>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      if (req.lines.filter((l) => l.quantity > 0).length === 0) {
                        toast.error('Add at least one apparatus, chemical or reagent line', {
                          duration: 8_000,
                          id: 'req-conflict',
                        })
                        return
                      }
                      if (hasBlockingIssue(issues)) {
                        const first = issues.find((i) => i.level === 'error')
                        toast.error(
                          first?.message ?? 'Resolve conflicts before submitting',
                          { duration: 12_000, id: 'req-conflict' },
                        )
                        return
                      }
                      const result = await submitRequisition(req.id)
                      if (!result.ok) {
                        toast.error(result.error, {
                          duration: 12_000,
                          id: result.error.toLowerCase().includes('booked')
                            ? 'req-conflict'
                            : 'req-save',
                        })
                        return
                      }
                      toast.success('Submitted. Admin and lab attendants have been notified.', {
                        duration: 5_500,
                        id: 'req-save',
                      })
                      startTransition(() => {
                        router.push('/requisitions?tab=queue')
                      })
                    }}
                  >
                    Submit for verification
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setEditForm({
                        subject: req.subject,
                        topic: req.topic,
                        form: req.form,
                        studentCount: req.studentCount,
                        objectives: req.objectives,
                        safetyNotes: req.safetyNotes,
                      })
                      setEditOpen(true)
                    }}
                  >
                    Edit draft details
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      deleteRequisition(req.id)
                      toast.success('Draft deleted')
                      startTransition(() => {
                        router.push('/requisitions')
                      })
                    }}
                  >
                    Delete draft
                  </Button>
                </>
              ) : null}

              {isOwner && req.status === 'submitted' ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    cancelRequisition(req.id, 'Withdrawn by requester')
                    toast.message('Request withdrawn')
                  }}
                >
                  Withdraw request
                </Button>
              ) : null}

              {canApprove && req.status === 'submitted' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="note">Approval / rejection note</Label>
                    <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (hasBlockingIssue(issues)) {
                        toast.error('Cannot approve while conflicts remain')
                        return
                      }
                      approveRequisition(req.id, note || undefined)
                      toast.success('Approved and reserved')
                    }}
                  >
                    Approve & reserve stock
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              ) : null}

              {canPrepare && req.status === 'approved' ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    markPrepared(req.id)
                    toast.success('Lab marked as prepared')
                  }}
                >
                  Mark lab prepared
                </Button>
              ) : null}

              {canPrepare && req.status === 'prepared' ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    startSession(req.id)
                    toast.success('Session started')
                  }}
                >
                  Start session
                </Button>
              ) : null}

              {canComplete && req.status === 'in_progress' ? (
                <Button className="w-full" onClick={() => setCompleteOpen(true)}>
                  Log completion / not done
                </Button>
              ) : null}

              {(canApprove || canPrepare) && ['approved', 'prepared'].includes(req.status) ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    cancelRequisition(req.id, 'Cancelled by attendant')
                    toast.message('Requisition cancelled')
                  }}
                >
                  Cancel booking
                </Button>
              ) : null}

              <Button
                variant="ghost"
                className="w-full justify-start"
                nativeButton={false}
                render={<Link href="/requisitions" />}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back to requisitions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject requisition</DialogTitle>
            <DialogDescription>Provide a clear reason for the teacher.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Reason…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!note.trim()) {
                  toast.error('A rejection note is required')
                  return
                }
                rejectRequisition(req.id, note.trim())
                setRejectOpen(false)
                toast.message('Requisition rejected')
              }}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit draft details</DialogTitle>
            <DialogDescription>
              Update class and lesson details. To change lab, period or items, delete this draft and create a
              new request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Subject</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
              >
                {data.settings.subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Form / class</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={editForm.form}
                onChange={(e) => setEditForm({ ...editForm, form: e.target.value })}
              >
                {data.settings.forms.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Topic</Label>
              <Input
                value={editForm.topic}
                onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Students</Label>
              <Input
                type="number"
                min={1}
                value={editForm.studentCount}
                onChange={(e) =>
                  setEditForm({ ...editForm, studentCount: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Objectives</Label>
              <Textarea
                rows={2}
                value={editForm.objectives}
                onChange={(e) => setEditForm({ ...editForm, objectives: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Safety notes</Label>
              <Textarea
                rows={2}
                value={editForm.safetyNotes}
                onChange={(e) => setEditForm({ ...editForm, safetyNotes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editForm.topic.trim()) {
                  toast.error('Topic is required')
                  return
                }
                if (editForm.studentCount < 1) {
                  toast.error('Student count must be at least 1')
                  return
                }
                updateRequisition(req.id, {
                  subject: editForm.subject,
                  topic: editForm.topic.trim(),
                  form: editForm.form,
                  studentCount: editForm.studentCount,
                  objectives: editForm.objectives.trim(),
                  safetyNotes: editForm.safetyNotes.trim(),
                })
                setEditOpen(false)
                toast.success('Draft updated')
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompleteSessionDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        lines={req.lines}
        defaultStudents={req.studentCount}
        defaultStart={req.slot.start}
        defaultEnd={req.slot.end}
        itemById={itemById}
        onSubmit={(input) => {
          completeSession(req.id, input)
          setCompleteOpen(false)
          toast.success(
            input.outcome === 'successful'
              ? 'Session logged and stock reconciled'
              : 'Session logged as Not Done',
          )
        }}
      />
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

function CompleteSessionDialog({
  open,
  onOpenChange,
  lines,
  defaultStudents,
  defaultStart,
  defaultEnd,
  itemById,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lines: RequisitionLine[]
  defaultStudents: number
  defaultStart: string
  defaultEnd: string
  itemById: ReturnType<typeof useLms>['itemById']
  onSubmit: (input: {
    outcome: SessionOutcome
    actualStart: string
    actualEnd: string
    studentsPresent: number
    notDoneReason?: NotDoneReason
    remarks: string
    consumablesUsed: RequisitionLine[]
    breakages: { itemId: string; quantity: number; cause: string }[]
  }) => void
}) {
  const { data } = useLms()
  const reasons = data.settings.notDoneReasons
  const consumableLines = lines.filter((l) => itemById(l.itemId)?.consumable)
  /** Prefer apparatus on this requisition; fall back to all returnable store items. */
  const breakableItems = (() => {
    const fromReq = lines
      .map((l) => itemById(l.itemId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item && !item.consumable))
    if (fromReq.length) return fromReq
    return data.items.filter((item) => !item.consumable)
  })()
  const [outcome, setOutcome] = useState<SessionOutcome>('successful')
  const [actualStart, setActualStart] = useState(defaultStart)
  const [actualEnd, setActualEnd] = useState(defaultEnd)
  const [studentsPresent, setStudentsPresent] = useState(defaultStudents)
  const [notDoneReason, setNotDoneReason] = useState<NotDoneReason>(reasons[0]?.id ?? 'other')
  const [remarks, setRemarks] = useState('')
  const [usage, setUsage] = useState<Record<string, number>>(() =>
    Object.fromEntries(consumableLines.map((l) => [l.itemId, l.quantity])),
  )
  const [brkItem, setBrkItem] = useState('')
  const [brkQty, setBrkQty] = useState(1)
  const [brkCause, setBrkCause] = useState('')
  const [breakages, setBreakages] = useState<{ itemId: string; quantity: number; cause: string }[]>([])

  useEffect(() => {
    if (!open) return
    setOutcome('successful')
    setActualStart(defaultStart)
    setActualEnd(defaultEnd)
    setStudentsPresent(defaultStudents)
    setNotDoneReason(reasons[0]?.id ?? 'other')
    setRemarks('')
    setUsage(Object.fromEntries(consumableLines.map((l) => [l.itemId, l.quantity])))
    setBrkItem('')
    setBrkQty(1)
    setBrkCause('')
    setBreakages([])
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-triggered reset
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close practical session</DialogTitle>
          <DialogDescription>
            Record planned vs actual time, outcome, consumable usage and any breakages.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={cn(
                'min-h-11 rounded-lg border px-3 py-2 text-sm',
                outcome === 'successful' ? 'border-success bg-success-muted text-success' : 'border-border',
              )}
              onClick={() => setOutcome('successful')}
            >
              Successfully Done
            </button>
            <button
              type="button"
              className={cn(
                'min-h-11 rounded-lg border px-3 py-2 text-sm',
                outcome === 'not_done' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border',
              )}
              onClick={() => setOutcome('not_done')}
            >
              Not Done
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Actual start</Label>
              <Input type="time" value={actualStart} onChange={(e) => setActualStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Actual end</Label>
              <Input type="time" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Students present</Label>
            <Input
              type="number"
              min={0}
              value={studentsPresent}
              onChange={(e) => setStudentsPresent(Number(e.target.value) || 0)}
            />
          </div>

          {outcome === 'not_done' ? (
            <div className="space-y-1">
              <Label>Reason</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={notDoneReason}
                onChange={(e) => setNotDoneReason(e.target.value as NotDoneReason)}
              >
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {outcome === 'successful' && consumableLines.length > 0 ? (
            <div className="space-y-2">
              <Label>Consumables used (stock reconciliation)</Label>
              {consumableLines.map((line) => {
                const item = itemById(line.itemId)
                if (!item) return null
                return (
                  <div key={line.itemId} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{item.name}</span>
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={usage[line.itemId] ?? 0}
                      onChange={(e) =>
                        setUsage((prev) => ({ ...prev, [line.itemId]: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label>Breakages</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose the item, enter quantity and cause, then click Add breakage.
              </p>
            </div>

            {breakableItems.length === 0 ? (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                No returnable apparatus on this requisition or in the store to record as broken.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="brk-item">Item</Label>
                  <select
                    id="brk-item"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                    value={brkItem}
                    onChange={(e) => setBrkItem(e.target.value)}
                  >
                    <option value="">Select broken item…</option>
                    {breakableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[6rem_1fr]">
                  <div className="space-y-1">
                    <Label htmlFor="brk-qty">Quantity</Label>
                    <Input
                      id="brk-qty"
                      type="number"
                      min={1}
                      value={brkQty}
                      onChange={(e) => setBrkQty(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="brk-cause">Cause</Label>
                    <Input
                      id="brk-cause"
                      placeholder="e.g. Cracked during heating"
                      value={brkCause}
                      onChange={(e) => setBrkCause(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (!brkItem) {
                      toast.error('Select the broken item first')
                      return
                    }
                    if (brkQty < 1) {
                      toast.error('Quantity must be at least 1')
                      return
                    }
                    if (!brkCause.trim()) {
                      toast.error('Enter the cause of the breakage')
                      return
                    }
                    setBreakages((prev) => [
                      ...prev,
                      { itemId: brkItem, quantity: brkQty, cause: brkCause.trim() },
                    ])
                    setBrkItem('')
                    setBrkQty(1)
                    setBrkCause('')
                    toast.success('Breakage added to this session log')
                  }}
                >
                  Add breakage
                </Button>
              </div>
            )}

            {breakages.length > 0 ? (
              <ul className="space-y-2 border-t border-border pt-2">
                {breakages.map((b, idx) => (
                  <li
                    key={`${b.itemId}-${idx}`}
                    className="flex items-start justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {itemById(b.itemId)?.name ?? 'Item'} × {b.quantity}
                      </p>
                      <p className="text-xs text-muted-foreground">{b.cause}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setBreakages((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                outcome,
                actualStart,
                actualEnd,
                studentsPresent,
                notDoneReason: outcome === 'not_done' ? notDoneReason : undefined,
                remarks,
                consumablesUsed:
                  outcome === 'successful'
                    ? consumableLines.map((l) => ({
                        itemId: l.itemId,
                        quantity: usage[l.itemId] ?? 0,
                      }))
                    : [],
                breakages,
              })
            }
          >
            Save session log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
