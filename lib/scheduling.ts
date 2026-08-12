import type {
  InventoryItem,
  Lab,
  Requisition,
  RequisitionLine,
  RequisitionStatus,
  TimeSlot,
} from './types'

/** Statuses that hold a live claim on a room and on stock. */
export const BLOCKING_STATUSES: RequisitionStatus[] = [
  'submitted',
  'approved',
  'prepared',
  'in_progress',
]

/** Statuses whose approved reservations are actually deducted from availability. */
export const RESERVING_STATUSES: RequisitionStatus[] = [
  'approved',
  'prepared',
  'in_progress',
]

export function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Compare booking dates even if one side stored a full ISO timestamp. */
export function sameBookingDate(a?: string, b?: string) {
  if (!a || !b) return false
  return a.slice(0, 10) === b.slice(0, 10)
}

/**
 * True when two timetable slots clash on the same day.
 * - Same periodId → always a clash (discrete school periods).
 * - Otherwise use clock times (so mismatched/missing period ids still catch overlaps).
 * Adjacent periods that only touch at an endpoint (e.g. 09:20) do not clash.
 */
export function slotsOverlap(a: TimeSlot, b: TimeSlot) {
  if (!sameBookingDate(a.date, b.date)) return false
  if (a.periodId && b.periodId && a.periodId === b.periodId) return true
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)
}

export function formatSlot(slot: TimeSlot) {
  return `${slot.start} to ${slot.end}`
}

export function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatDateTime(iso?: string) {
  if (!iso) return 'Not set'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatTime(iso?: string) {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function durationMinutes(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
}

/** Requisitions that still hold a claim on the timetable. */
export function activeBookings(requisitions: Requisition[]) {
  return requisitions.filter((r) => BLOCKING_STATUSES.includes(r.status))
}

export function findLabConflicts(
  requisitions: Requisition[],
  labId: string,
  slot: TimeSlot,
  excludeId?: string,
  periods?: { id: string; start: string; end: string }[],
) {
  const target = hydrateSlot(slot, periods)
  return activeBookings(requisitions).filter((r) => {
    if (r.id === excludeId || r.labId !== labId) return false
    return slotsOverlap(hydrateSlot(r.slot, periods), target)
  })
}

/** Trim times/dates and fill periodId from the timetable when missing. */
export function hydrateSlot(
  slot: TimeSlot,
  periods?: { id: string; start: string; end: string }[],
): TimeSlot {
  const normalized: TimeSlot = {
    ...slot,
    date: slot.date?.slice(0, 10) ?? slot.date,
    start: slot.start?.slice(0, 5) ?? slot.start,
    end: slot.end?.slice(0, 5) ?? slot.end,
  }
  if (normalized.periodId || !periods?.length) return normalized
  const match = periods.find((p) => p.start === normalized.start && p.end === normalized.end)
  return match ? { ...normalized, periodId: match.id } : normalized
}

function normalizeSlot(slot: TimeSlot): TimeSlot {
  return hydrateSlot(slot)
}

/**
 * Quantity of an item already reserved by approved bookings that overlap `slot`.
 * Used to stop the same apparatus being promised to two concurrent classes.
 */
export function committedQuantity(
  requisitions: Requisition[],
  itemId: string,
  slot: TimeSlot,
  excludeId?: string,
) {
  return requisitions
    .filter(
      (r) =>
        r.id !== excludeId &&
        RESERVING_STATUSES.includes(r.status) &&
        slotsOverlap(r.slot, slot),
    )
    .reduce(
      (sum, r) =>
        sum + r.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0),
      0,
    )
}

/** Total quantity reserved across every live approved booking, regardless of time. */
export function totalReserved(requisitions: Requisition[], itemId: string) {
  return requisitions
    .filter((r) => RESERVING_STATUSES.includes(r.status))
    .reduce(
      (sum, r) =>
        sum + r.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0),
      0,
    )
}

export function availableQuantity(
  item: InventoryItem,
  requisitions: Requisition[],
  slot?: TimeSlot,
  excludeId?: string,
) {
  const committed = slot
    ? committedQuantity(requisitions, item.id, slot, excludeId)
    : totalReserved(requisitions, item.id)
  return item.onHand - committed
}

export function isLowStock(item: InventoryItem) {
  return item.onHand <= item.reorderLevel
}

export function isExpiringSoon(item: InventoryItem, withinDays = 60) {
  if (!item.expiryDate) return false
  const days = (new Date(`${item.expiryDate}T00:00:00`).getTime() - Date.now()) / 86400000
  return days <= withinDays
}

export type ConflictIssue = {
  level: 'error' | 'warning'
  code: 'lab_double_booked' | 'over_capacity' | 'insufficient_stock' | 'low_stock_after' | 'expiring'
  message: string
}

export type ConflictCheckInput = {
  labId: string
  slot: TimeSlot
  studentCount: number
  lines: RequisitionLine[]
  excludeId?: string
}

/**
 * Central conflict-resolution routine. Errors block submission or approval;
 * warnings are advisory and shown to the attendant.
 */
export function checkConflicts(
  input: ConflictCheckInput,
  ctx: {
    labs: Lab[]
    items: InventoryItem[]
    requisitions: Requisition[]
    periods?: { id: string; start: string; end: string }[]
  },
): ConflictIssue[] {
  const issues: ConflictIssue[] = []
  const lab = ctx.labs.find((l) => l.id === input.labId)

  const clashes = findLabConflicts(
    ctx.requisitions,
    input.labId,
    input.slot,
    input.excludeId,
    ctx.periods,
  )
  for (const clash of clashes) {
    issues.push({
      level: 'error',
      code: 'lab_double_booked',
      message: `${lab?.name ?? 'Lab'} is already booked by ${clash.reference} for ${formatSlot(clash.slot)} on ${clash.slot.date.slice(0, 10)}.`,
    })
  }

  if (lab && input.studentCount > lab.capacity) {
    issues.push({
      level: 'error',
      code: 'over_capacity',
      message: `${input.studentCount} students exceeds the ${lab.capacity}-student capacity of ${lab.name}.`,
    })
  }

  for (const line of input.lines) {
    const item = ctx.items.find((i) => i.id === line.itemId)
    if (!item || line.quantity <= 0) continue
    const available = availableQuantity(item, ctx.requisitions, input.slot, input.excludeId)
    if (line.quantity > available) {
      issues.push({
        level: 'error',
        code: 'insufficient_stock',
        message: `${item.name}: ${line.quantity} ${item.unit} requested but only ${Math.max(0, available)} ${item.unit} free in this time slot.`,
      })
      continue
    }
    if (item.consumable && item.onHand - line.quantity <= item.reorderLevel) {
      issues.push({
        level: 'warning',
        code: 'low_stock_after',
        message: `${item.name} will fall to or below its reorder level of ${item.reorderLevel} ${item.unit} after this session.`,
      })
    }
    if (isExpiringSoon(item, 45)) {
      issues.push({
        level: 'warning',
        code: 'expiring',
        message: `${item.name} expires on ${item.expiryDate}. Check quality before issuing.`,
      })
    }
  }

  return issues
}

export function hasBlockingIssue(issues: ConflictIssue[]) {
  return issues.some((i) => i.level === 'error')
}

/** Pick the next free lab + period within the coming days (lab booking only). */
export function suggestOpenSlot(input: {
  labs: Lab[]
  periods: { id: string; start: string; end: string }[]
  requisitions: Requisition[]
  studentCount: number
  dayCount?: number
}): { labId: string; date: string; periodId: string; start: string; end: string } | null {
  const dayCount = input.dayCount ?? 21
  if (!input.labs.length || !input.periods.length) return null

  const start = new Date()
  start.setHours(12, 0, 0, 0)

    for (let d = 1; d <= dayCount; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + d)
      // Skip Sundays
      if (day.getDay() === 0) continue
      const y = day.getFullYear()
      const m = String(day.getMonth() + 1).padStart(2, '0')
      const dd = String(day.getDate()).padStart(2, '0')
      const date = `${y}-${m}-${dd}`

      for (const lab of input.labs) {
        if (input.studentCount > lab.capacity) continue
        for (const period of input.periods) {
          const slot = { date, start: period.start, end: period.end, periodId: period.id }
          const issues = checkConflicts(
            { labId: lab.id, slot, studentCount: input.studentCount, lines: [] },
            { labs: input.labs, items: [], requisitions: input.requisitions },
          )
          if (!hasBlockingIssue(issues)) {
            return { labId: lab.id, date, periodId: period.id, start: period.start, end: period.end }
          }
        }
      }
    }
  return null
}

/** Legal forward transitions for the session pipeline. */
export const NEXT_STATUS: Partial<Record<RequisitionStatus, RequisitionStatus[]>> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['prepared', 'cancelled'],
  prepared: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'not_done'],
}
