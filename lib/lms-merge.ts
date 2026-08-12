import type { AppNotification, LmsData, Requisition, RequisitionStatus } from './types'

function revisionOf(data: { revision?: number } | null | undefined) {
  return data?.revision ?? 0
}

function reqRecency(r: Requisition) {
  return r.submittedAt ?? r.createdAt ?? ''
}

/** Higher = more advanced in the workflow (prefer when merging the same id). */
const STATUS_RANK: Record<RequisitionStatus, number> = {
  draft: 0,
  submitted: 1,
  approved: 2,
  prepared: 3,
  in_progress: 4,
  completed: 5,
  not_done: 5,
  rejected: 6,
  cancelled: 6,
}

function preferRequisition(a: Requisition, b: Requisition): Requisition {
  const rankA = STATUS_RANK[a.status] ?? 0
  const rankB = STATUS_RANK[b.status] ?? 0
  if (rankA !== rankB) return rankA >= rankB ? a : b
  return reqRecency(a) >= reqRecency(b) ? a : b
}

export function mergeRequisitions(a: Requisition[], b: Requisition[]): Requisition[] {
  const map = new Map<string, Requisition>()
  for (const r of a) map.set(r.id, r)
  for (const r of b) {
    const prev = map.get(r.id)
    map.set(r.id, prev ? preferRequisition(prev, r) : r)
  }
  return [...map.values()].sort((x, y) => reqRecency(y).localeCompare(reqRecency(x)))
}

function preferNotification(a: AppNotification, b: AppNotification): AppNotification {
  // Newer content wins for title/body; read:true always wins so "mark read" survives sync.
  const newer = a.createdAt >= b.createdAt ? a : b
  const older = a.createdAt >= b.createdAt ? b : a
  return {
    ...older,
    ...newer,
    read: Boolean(a.read || b.read),
  }
}

export function mergeNotifications(
  a: AppNotification[],
  b: AppNotification[],
): AppNotification[] {
  const map = new Map<string, AppNotification>()
  for (const n of a) map.set(n.id, n)
  for (const n of b) {
    const prev = map.get(n.id)
    map.set(n.id, prev ? preferNotification(prev, n) : n)
  }
  return [...map.values()].sort((x, y) => y.createdAt.localeCompare(x.createdAt))
}

/** Prefer higher revision core fields; always union requisitions & notifications. */
export function mergeLmsData(primary: LmsData, secondary: LmsData | null | undefined): LmsData {
  if (!secondary) return primary
  const usePrimaryCore = revisionOf(primary) >= revisionOf(secondary)
  const coreSrc = usePrimaryCore ? primary : secondary
  const other = usePrimaryCore ? secondary : primary
  const merged: LmsData = JSON.parse(JSON.stringify(coreSrc))
  merged.requisitions = mergeRequisitions(primary.requisitions ?? [], secondary.requisitions ?? [])
  merged.notifications = mergeNotifications(
    primary.notifications ?? [],
    secondary.notifications ?? [],
  )
  if ((!merged.items || merged.items.length === 0) && other.items?.length) {
    merged.items = JSON.parse(JSON.stringify(other.items))
  }
  merged.revision = Math.max(revisionOf(primary), revisionOf(secondary))
  return merged
}

export function pruneOrphanNotifications(data: LmsData): LmsData {
  const ids = new Set(data.requisitions.map((r) => r.id))
  const next = data.notifications.filter((n) => !n.requisitionId || ids.has(n.requisitionId))
  if (next.length === data.notifications.length) return data
  return { ...data, notifications: next }
}

export function dedupeWorkflowNotifications(data: LmsData): LmsData {
  const byKey = new Map<string, AppNotification>()
  const passthrough: AppNotification[] = []

  for (const n of [...data.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (n.kind === 'requisition.submitted' && n.requisitionId) {
      const key = `${n.userId}|${n.kind}|${n.requisitionId}|${n.title}`
      const prev = byKey.get(key)
      byKey.set(key, prev ? preferNotification(prev, n) : n)
      continue
    }
    passthrough.push(n)
  }

  const kept = [...byKey.values(), ...passthrough].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return { ...data, notifications: kept }
}

export function sanitizeNotifications(data: LmsData): LmsData {
  return dedupeWorkflowNotifications(pruneOrphanNotifications(data))
}

export function revisionOfData(data: LmsData | null | undefined) {
  return revisionOf(data)
}
