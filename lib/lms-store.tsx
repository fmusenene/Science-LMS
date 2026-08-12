'use client'

import * as React from 'react'
import { toast } from 'sonner'
import type {
  AppNotification,
  AppRole,
  AuditEntry,
  BreakageEntry,
  InventoryItem,
  Lab,
  LmsData,
  MovementKind,
  NotDoneReason,
  Requisition,
  RequisitionLine,
  SessionLog,
  SessionOutcome,
  StockMovement,
  SystemSettings,
  TimeSlot,
  User,
} from './types'
import { DEMO_PASSWORD } from './types'
import type { PermissionId } from './permissions'
import { createSeedData } from './seed-data'
import {
  clearLegacyStorage,
  fetchServerData,
  fetchServerSession,
  loadPersistedData,
  loginOnServer,
  logoutOnServer,
  mergeLmsData,
  persistData,
  persistSession,
  pushServerData,
  revisionOfData,
  sanitizeNotifications,
  subscribeDataSync,
} from './lms-persistence'
import { checkConflicts, hasBlockingIssue } from './scheduling'

/** Always holds the newest in-memory store so sign-out/login cannot reload a stale disk copy. */
let liveSnapshot: LmsData | null = null

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function nowISO() {
  return new Date().toISOString()
}

function revisionOf(data: LmsData | null | undefined) {
  return revisionOfData(data)
}

function readSharedData(): LmsData {
  const fromDisk = loadPersistedData()
  if (liveSnapshot) return mergeLmsData(liveSnapshot, fromDisk)
  return fromDisk
}

function requisitionFingerprint(reqs: Requisition[]) {
  return reqs
    .map((r) => `${r.id}:${r.status}:${r.submittedAt ?? r.createdAt}:${r.slot?.periodId ?? ''}`)
    .sort()
    .join('|')
}

function notificationFingerprint(notifications: AppNotification[] | undefined) {
  return (notifications ?? [])
    .map((n) => `${n.id}:${n.userId}:${n.read ? 1 : 0}:${n.kind}:${n.requisitionId ?? ''}`)
    .sort()
    .join('|')
}

/** True when operational content matches — ignore revision-only bumps (those caused UI flicker). */
function sameOperationalContent(a: LmsData, b: LmsData) {
  return (
    requisitionFingerprint(a.requisitions) === requisitionFingerprint(b.requisitions) &&
    notificationFingerprint(a.notifications) === notificationFingerprint(b.notifications) &&
    (a.items?.length ?? 0) === (b.items?.length ?? 0) &&
    (a.labs?.length ?? 0) === (b.labs?.length ?? 0)
  )
}

function persistLmsData(payload: LmsData, options?: { push?: boolean }) {
  const clean = sanitizeNotifications(payload)
  liveSnapshot = clean
  const local = persistData(clean)
  if (options?.push) {
    const pushedFromRevision = revisionOf(clean)
    const pushedReqCount = clean.requisitions.length
    void pushServerData(clean).then((saved) => {
      if (!saved) return
      // Never clobber a newer in-memory submit with an older server echo.
      if (
        liveSnapshot &&
        (revisionOf(liveSnapshot) > pushedFromRevision ||
          liveSnapshot.requisitions.length > pushedReqCount)
      ) {
        return
      }
      if (liveSnapshot && sameOperationalContent(liveSnapshot, saved)) {
        liveSnapshot = { ...liveSnapshot, revision: saved.revision }
        persistData(liveSnapshot)
        return
      }
      liveSnapshot = saved
      persistData(saved)
    })
  }
  return local
}

async function persistAndPush(payload: LmsData): Promise<LmsData | null> {
  const clean = sanitizeNotifications(payload)
  liveSnapshot = clean
  persistData(clean)
  const saved = await pushServerData(clean)
  if (saved) {
    liveSnapshot = saved
    persistData(saved)
  }
  return saved
}

function adoptData(
  setData: React.Dispatch<React.SetStateAction<LmsData | null>>,
  next: LmsData,
) {
  setData((prev) => {
    if (prev && sameOperationalContent(prev, next)) {
      if (revisionOf(next) > revisionOf(prev)) {
        liveSnapshot = { ...prev, revision: next.revision }
      }
      return prev
    }
    liveSnapshot = next
    persistData(next)
    return next
  })
}

/** Users who should see the attendant/admin work queue (new submissions, withdrawals). */
function resolveStaffRecipients(draft: LmsData): string[] {
  const ids = new Set<string>()

  for (const user of draft.users) {
    if (!user.active) continue
    const role = draft.roles.find((r) => r.id === user.roleId)
    if (!role) continue

    const isBuiltInStaff =
      role.id === 'role-admin' ||
      role.id === 'role-attendant' ||
      role.name === 'System Administrator' ||
      role.name === 'Lab Attendant' ||
      /admin|attendant/i.test(role.name)

    const canReview =
      role.permissions.includes('requisitions.approve') ||
      role.permissions.includes('requisitions.view_all') ||
      role.permissions.includes('requisitions.prepare')

    if (isBuiltInStaff || canReview) ids.add(user.id)
  }

  for (const user of draft.users) {
    if (!user.active) continue
    if (user.roleId === 'role-admin' || user.roleId === 'role-attendant') {
      ids.add(user.id)
    }
  }

  return [...ids]
}

/** Create missing "Pending approval" alerts for a staff user (covers seed + older submits). */
function backfillPendingNotificationsForStaff(draft: LmsData, staffUserId: string): boolean {
  const role = draft.roles.find((r) => r.id === draft.users.find((u) => u.id === staffUserId)?.roleId)
  if (!role) return false
  const isStaff =
    role.permissions.includes('requisitions.approve') ||
    role.id === 'role-admin' ||
    role.id === 'role-attendant'
  if (!isStaff) return false

  if (!Array.isArray(draft.notifications)) draft.notifications = []

  const pending = draft.requisitions.filter((r) => r.status === 'submitted')
  let changed = false
  const pendingCount = pending.length

  for (const req of pending) {
    const already = draft.notifications.some(
      (n) =>
        n.userId === staffUserId &&
        n.requisitionId === req.id &&
        n.kind === 'requisition.submitted',
    )
    if (already) continue

    const teacher = draft.users.find((u) => u.id === req.teacherId)
    draft.notifications.unshift({
      id: uid('ntf'),
      userId: staffUserId,
      title: 'Pending approval',
      body: `${teacher?.name ?? 'A teacher'} submitted ${req.reference} — ${req.topic}. ${pendingCount} requisition${pendingCount === 1 ? '' : 's'} awaiting approval.`,
      kind: 'requisition.submitted',
      href: `/requisitions/${req.id}`,
      requisitionId: req.id,
      read: false,
      createdAt: nowISO(),
    })
    changed = true
  }

  if (draft.notifications.length > 200) {
    draft.notifications = draft.notifications.slice(0, 200)
  }
  return changed
}

export type NewRequisitionInput = {
  teacherId: string
  labId: string
  subject: string
  topic: string
  form: string
  studentCount: number
  slot: TimeSlot
  lines: RequisitionLine[]
  objectives: string
  safetyNotes: string
}

export type CompleteSessionInput = {
  outcome: SessionOutcome
  actualStart: string
  actualEnd: string
  studentsPresent: number
  notDoneReason?: NotDoneReason
  remarks: string
  consumablesUsed: RequisitionLine[]
  breakages: { itemId: string; quantity: number; cause: string }[]
}

export type RoleInput = {
  id?: string
  name: string
  description: string
  permissions: PermissionId[]
}

type LmsContextValue = {
  data: LmsData
  currentUser: User | null
  currentRole: AppRole | null
  can: (permission: PermissionId) => boolean
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => void
  resetDemoData: () => void

  // lookups
  userById: (id?: string) => User | undefined
  roleById: (id?: string) => AppRole | undefined
  labById: (id?: string) => Lab | undefined
  itemById: (id?: string) => InventoryItem | undefined
  requisitionById: (id?: string) => Requisition | undefined
  sessionForRequisition: (requisitionId: string) => SessionLog | undefined

  // requisitions
  createRequisition: (
    input: NewRequisitionInput,
    submit: boolean,
  ) => Promise<{ ok: true; id: string; submitted: boolean } | { ok: false; error: string }>
  updateRequisition: (id: string, patch: Partial<NewRequisitionInput>) => void
  submitRequisition: (
    id: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  approveRequisition: (id: string, note?: string) => void
  rejectRequisition: (id: string, note: string) => void
  markPrepared: (id: string) => void
  startSession: (id: string) => void
  completeSession: (id: string, input: CompleteSessionInput) => void
  cancelRequisition: (id: string, reason: string) => void
  deleteRequisition: (id: string) => void

  // inventory
  adjustStock: (itemId: string, delta: number, kind: MovementKind, reason: string) => void
  saveItem: (item: Omit<InventoryItem, 'id'> & { id?: string }) => void

  // admin
  saveUser: (
    user: Omit<User, 'id' | 'createdAt' | 'password'> & {
      id?: string
      password?: string
    },
  ) => void
  toggleUserActive: (id: string) => void
  saveLab: (lab: Omit<Lab, 'id'> & { id?: string }) => string
  deleteLab: (id: string) => { ok: true } | { ok: false; error: string }
  saveRole: (input: RoleInput) => string
  deleteRole: (id: string) => { ok: true } | { ok: false; error: string }
  saveSettings: (settings: SystemSettings) => void
  updateMyProfile: (input: {
    name?: string
    password?: string
    avatarUrl?: string | null
  }) => { ok: true } | { ok: false; error: string }

  myNotifications: () => AppNotification[]
  unreadNotificationCount: () => number
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  /** Remove a notification from this user's inbox (cleared / dismissed). */
  dismissNotification: (id: string) => void
  /** Clear this user's inbox entirely so only future alerts appear. */
  clearMyNotifications: () => void
}

const LmsContext = React.createContext<LmsContextValue | null>(null)

export function LmsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<LmsData | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      clearLegacyStorage()
      const session = await fetchServerSession()
      if (cancelled) return

      if (session.authenticated) {
        liveSnapshot = session.data
        setData(session.data)
        setCurrentUserId(session.userId)
        persistSession(session.userId)
        setReady(true)
        return
      }

      // Signed out — local branding data only; never push without a session.
      persistSession(null)
      let initial = sanitizeNotifications(readSharedData())
      initial = {
        ...initial,
        users: initial.users.map((u) => ({ ...u, password: '' })),
      }
      liveSnapshot = initial
      setData(initial)
      setCurrentUserId(null)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (data) liveSnapshot = data
  }, [data])

  // Cross-tab / BroadcastChannel sync — always merge, never replace.
  React.useEffect(() => {
    return subscribeDataSync((incoming) => {
      React.startTransition(() => {
        setData((prev) => {
          const next = sanitizeNotifications(prev ? mergeLmsData(prev, incoming) : incoming)
          if (prev && sameOperationalContent(prev, next)) return prev
          liveSnapshot = next
          return next
        })
      })
    })
  }, [])

  React.useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    let inFlight = false

    const syncFromServer = () => {
      if (inFlight || cancelled) return
      inFlight = true
      void (async () => {
        try {
          const server = await fetchServerData()
          if (cancelled) return
          if (!server) {
            // Session expired / revoked
            if (!cancelled) {
              setCurrentUserId(null)
              persistSession(null)
            }
            return
          }
          const disk = loadPersistedData()
          const local = liveSnapshot ? mergeLmsData(liveSnapshot, disk) : disk

          // Only push when this browser has requisitions the server is missing.
          // Never push on every poll — that bumped revision and flickered the whole UI.
          const localOnly = (local.requisitions ?? []).filter(
            (r) => !(server?.requisitions ?? []).some((s) => s.id === r.id),
          )

          let next = mergeLmsData(server, local)
          next = sanitizeNotifications(next)

          if (localOnly.length > 0) {
            const pushed = await pushServerData(next)
            if (pushed) next = pushed
          }

          if (cancelled) return

          // Defer UI update so navigation stays snappy while background sync lands.
          React.startTransition(() => {
            setData((prev) => {
              if (prev && sameOperationalContent(prev, next)) {
                // Keep revision in sync quietly without re-rendering the tree.
                if (revisionOf(next) > revisionOf(prev)) {
                  const quiet = { ...prev, revision: next.revision }
                  liveSnapshot = quiet
                  return prev
                }
                return prev
              }
              liveSnapshot = next
              persistData(next)
              return next
            })
          })
        } finally {
          inFlight = false
        }
      })()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncFromServer()
    }
    window.addEventListener('focus', syncFromServer)
    document.addEventListener('visibilitychange', onVisibility)
    // Pull-only poll — long enough that the UI stays calm.
    const timer = window.setInterval(syncFromServer, 12_000)
    // One initial pull after mount (boot already loaded once).
    const boot = window.setTimeout(syncFromServer, 2500)
    return () => {
      cancelled = true
      window.removeEventListener('focus', syncFromServer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
      window.clearTimeout(boot)
    }
  }, [currentUserId])

  React.useEffect(() => {
    if (!data || !ready) return
    liveSnapshot = data
    const result = persistData(data)
    if (result === 'fail') {
      toast.warning(
        'Could not fully save. Requisitions are stored separately — if problems continue, free browser storage.',
        { duration: 8_000, id: 'lms-storage-fail' },
      )
    }
  }, [data, ready])

  React.useEffect(() => {
    if (!ready) return
    persistSession(currentUserId)
  }, [currentUserId, ready])

  // Staff login: ensure Pending approval alerts exist for every submitted requisition.
  React.useEffect(() => {
    if (!ready || !currentUserId) return
    setData((prev) => {
      if (!prev) return prev
      const draft: LmsData = JSON.parse(JSON.stringify(prev))
      if (!backfillPendingNotificationsForStaff(draft, currentUserId)) return prev
      draft.revision = revisionOf(prev) + 1
      const clean = sanitizeNotifications(draft)
      liveSnapshot = clean
      persistLmsData(clean, { push: true })
      return clean
    })
  }, [ready, currentUserId])

  const currentUser = React.useMemo(
    () => data?.users.find((u) => u.id === currentUserId) ?? null,
    [data, currentUserId],
  )

  const currentRole = React.useMemo(
    () => (currentUser ? data?.roles.find((r) => r.id === currentUser.roleId) ?? null : null),
    [data, currentUser],
  )

  const value = React.useMemo<LmsContextValue | null>(() => {
    if (!data) return null

    const actorId = currentUserId ?? 'system'

    const can = (permission: PermissionId) =>
      Boolean(currentRole?.permissions.includes(permission))

    const assertCan = (permission: PermissionId, label?: string) => {
      if (can(permission)) return true
      toast.error(label ?? 'You do not have permission for that action.')
      return false
    }

    const audit = (action: string, target: string, detail: string): AuditEntry => ({
      id: uid('aud'),
      actorId,
      action,
      target,
      detail,
      createdAt: nowISO(),
    })

    const mutate = (fn: (draft: LmsData) => void, options?: { push?: boolean }) => {
      // Avoid flushSync — it forced a full paint mid-navigation and made styles flash.
      // useState updaters still run synchronously, so liveSnapshot stays correct for callers.
      setData((prev) => {
        if (!prev) return prev
        // Always merge disk partitions in — never replace memory with a thinner disk copy.
        const disk = loadPersistedData()
        const base = mergeLmsData(prev, disk)
        const draft: LmsData = JSON.parse(JSON.stringify(base))
        if (!Array.isArray(draft.notifications)) draft.notifications = []
        if (!Array.isArray(draft.requisitions)) draft.requisitions = []
        fn(draft)
        draft.revision = revisionOf(base) + 1
        const clean = sanitizeNotifications(draft)
        liveSnapshot = clean
        const saved = persistLmsData(clean, { push: options?.push ?? true })
        if (saved === 'fail') {
          toast.error(
            'Could not save requisitions to this browser. Free storage space and try again.',
            { duration: 8_000, id: 'lms-storage-fail' },
          )
        }
        return clean
      })
    }

    const findReq = (draft: LmsData, id: string) =>
      draft.requisitions.find((r) => r.id === id)

    const applyMovement = (
      draft: LmsData,
      itemId: string,
      delta: number,
      kind: MovementKind,
      reason: string,
      requisitionId?: string,
    ) => {
      const item = draft.items.find((i) => i.id === itemId)
      if (!item) return
      item.onHand = Math.max(0, item.onHand + delta)
      const movement: StockMovement = {
        id: uid('mv'),
        itemId,
        kind,
        delta,
        reason,
        actorId,
        createdAt: nowISO(),
        requisitionId,
      }
      draft.movements.unshift(movement)
    }

    const nextReference = (draft: LmsData) => {
      const numbers = draft.requisitions
        .map((r) => Number(r.reference.replace(/\D/g, '')))
        .filter((n) => !Number.isNaN(n))
      const next = (numbers.length ? Math.max(...numbers) : 1000) + 1
      return `REQ-${next}`
    }

    const usersWithPermission = (draft: LmsData, permission: PermissionId) => {
      const roleIds = new Set(
        draft.roles.filter((r) => r.permissions.includes(permission)).map((r) => r.id),
      )
      return draft.users.filter((u) => u.active && roleIds.has(u.roleId)).map((u) => u.id)
    }

    const pushNotifications = (
      draft: LmsData,
      userIds: string[],
      input: {
        title: string
        body: string
        kind: AppNotification['kind']
        href?: string
        requisitionId?: string
      },
      excludeUserId?: string,
    ) => {
      if (!draft.notifications) draft.notifications = []
      const unique = [...new Set(userIds)].filter((id) => id && id !== excludeUserId)
      for (const userId of unique) {
        // One alert per user + requisition + kind + title (stops duplicate teacher confirms).
        if (
          input.requisitionId &&
          draft.notifications.some(
            (n) =>
              n.userId === userId &&
              n.requisitionId === input.requisitionId &&
              n.kind === input.kind &&
              n.title === input.title,
          )
        ) {
          continue
        }
        draft.notifications.unshift({
          id: uid('ntf'),
          userId,
          title: input.title,
          body: input.body,
          kind: input.kind,
          href: input.href,
          requisitionId: input.requisitionId,
          read: false,
          createdAt: nowISO(),
        })
      }
      if (draft.notifications.length > 200) {
        draft.notifications = draft.notifications.slice(0, 200)
      }
    }

    const notifyApproversOfSubmission = (draft: LmsData, req: Requisition) => {
      const teacher = draft.users.find((u) => u.id === req.teacherId)
      // Always target every active admin + attendant (and anyone with approve rights).
      let staffIds = resolveStaffRecipients(draft).filter((id) => id !== actorId)

      // Solo-account edge case: still alert every other active user.
      if (staffIds.length === 0) {
        staffIds = draft.users
          .filter((u) => u.active && u.id !== actorId)
          .map((u) => u.id)
      }

      const pendingCount = draft.requisitions.filter((r) => r.status === 'submitted').length

      pushNotifications(draft, staffIds, {
        title: 'Pending approval',
        body: `${teacher?.name ?? 'A teacher'} submitted ${req.reference} — ${req.topic}. ${pendingCount} requisition${pendingCount === 1 ? '' : 's'} awaiting approval.`,
        kind: 'requisition.submitted',
        href: `/requisitions/${req.id}`,
        requisitionId: req.id,
      })

      // Confirm to the lesson teacher (separate from the staff work alert).
      if (req.teacherId) {
        pushNotifications(draft, [req.teacherId], {
          title: 'Requisition submitted',
          body: `${req.reference} was sent for approval. Admin and lab attendants have been notified.`,
          kind: 'requisition.submitted',
          href: `/requisitions/${req.id}`,
          requisitionId: req.id,
        })
      }
    }

    const notifyTeacher = (
      draft: LmsData,
      req: Requisition,
      title: string,
      body: string,
      kind: AppNotification['kind'],
    ) => {
      // Always deliver to the teacher — do not exclude the actor (admins may act on own bookings).
      pushNotifications(draft, [req.teacherId], {
        title,
        body,
        kind,
        href: `/requisitions/${req.id}`,
        requisitionId: req.id,
      })
    }

    return {
      data,
      currentUser,
      currentRole,
      can,

      login: async (email, password) => {
        const result = await loginOnServer(email, password)
        if (!result.ok) return { ok: false, error: result.error }

        let clean = result.data
        if (backfillPendingNotificationsForStaff(clean, result.userId)) {
          clean = { ...clean, revision: revisionOf(clean) + 1 }
          const pushed = (await pushServerData(clean)) ?? clean
          clean = pushed
        }
        liveSnapshot = clean
        persistData(clean)
        setData(clean)
        setCurrentUserId(result.userId)
        persistSession(result.userId)
        return { ok: true }
      },
      signOut: () => {
        const snap = liveSnapshot
        if (snap) {
          const result = persistLmsData(snap)
          if (result === 'fail') {
            toast.error(
              'Could not save before sign-out. Free browser storage or your latest submissions may not appear for admin.',
              { duration: 10_000, id: 'lms-signout-save-fail' },
            )
          }
        }
        void logoutOnServer()
        setCurrentUserId(null)
        persistSession(null)
      },
      resetDemoData: () => {
        if (!assertCan('settings.manage', 'Only administrators can reset the system.')) return
        const fresh = JSON.parse(JSON.stringify(createSeedData())) as LmsData
        fresh.revision = revisionOf(liveSnapshot ?? data) + 1
        liveSnapshot = fresh
        setData({
          ...fresh,
          users: fresh.users.map((u) => ({ ...u, password: '' })),
        })
        persistLmsData(fresh, { push: true })
      },

      userById: (id) => data.users.find((u) => u.id === id),
      roleById: (id) => data.roles.find((r) => r.id === id),
      labById: (id) => data.labs.find((l) => l.id === id),
      itemById: (id) => data.items.find((i) => i.id === id),
      requisitionById: (id) => data.requisitions.find((r) => r.id === id),
      sessionForRequisition: (requisitionId) =>
        data.sessions.find((s) => s.requisitionId === requisitionId),

      createRequisition: async (input, submit) => {
        if (!assertCan('requisitions.create')) {
          return { ok: false, error: 'You do not have permission to create requisitions.' }
        }
        if (submit && !input.lines.some((l) => l.quantity > 0)) {
          return { ok: false, error: 'Add at least one apparatus, chemical or reagent line' }
        }
        if (!input.topic.trim()) {
          return { ok: false, error: 'Topic is required' }
        }
        if (!input.teacherId || !input.labId) {
          return { ok: false, error: 'Teacher and laboratory are required' }
        }
        if (!input.slot?.periodId || !input.slot?.date || !input.slot?.start || !input.slot?.end) {
          return { ok: false, error: 'Choose a valid date and timetable period before submitting' }
        }

        const snapshot = liveSnapshot ?? data
        let working = snapshot

        if (submit) {
          const server = await fetchServerData()
          if (server) {
            working = sanitizeNotifications(mergeLmsData(server, snapshot))
            liveSnapshot = working
            persistData(working)
          }

          const issues = checkConflicts(
            {
              labId: input.labId,
              slot: input.slot,
              studentCount: input.studentCount,
              lines: input.lines,
            },
            {
              labs: working.labs,
              items: working.items,
              requisitions: working.requisitions,
              periods: working.settings.periods,
            },
          )

          if (hasBlockingIssue(issues)) {
            // Sync UI to the same data used for the decision — never submit.
            adoptData(setData, working)
            const labIssue = issues.find((i) => i.level === 'error' && i.code === 'lab_double_booked')
            const other = issues.find((i) => i.level === 'error')
            return {
              ok: false,
              error:
                labIssue?.message ??
                other?.message ??
                'Cannot submit — resolve the errors shown on the form first.',
            }
          }
        }

        const id = uid('req')
        const base = liveSnapshot ?? data
        const draft: LmsData = JSON.parse(JSON.stringify(base))
        if (!Array.isArray(draft.notifications)) draft.notifications = []
        if (!Array.isArray(draft.requisitions)) draft.requisitions = []

        const reference = nextReference(draft)
        const req: Requisition = {
          id,
          reference,
          ...input,
          topic: input.topic.trim(),
          objectives: input.objectives.trim(),
          safetyNotes: input.safetyNotes.trim(),
          status: submit ? 'submitted' : 'draft',
          createdAt: nowISO(),
          submittedAt: submit ? nowISO() : undefined,
          reserved: false,
        }
        draft.requisitions.unshift(req)
        draft.revision = revisionOf(base) + 1
        draft.audit.unshift(
          audit(
            submit ? 'requisition.submit' : 'requisition.draft',
            reference,
            `${submit ? 'Submitted' : 'Saved draft for'} ${input.subject} practical in ${
              draft.labs.find((l) => l.id === input.labId)?.name ?? input.labId
            } (${input.slot.date} ${input.slot.start}).`,
          ),
        )
        if (submit) notifyApproversOfSubmission(draft, req)

        // Write to memory + disk only — do NOT setData yet (avoids painting own booking as a conflict).
        const clean = sanitizeNotifications(draft)
        liveSnapshot = clean
        persistData(clean)

        const saved = liveSnapshot.requisitions.find((r) => r.id === id)
        if (!saved) {
          return { ok: false, error: 'Could not save the requisition. Try again.' }
        }
        if (submit && saved.status !== 'submitted') {
          return { ok: false, error: 'Requisition was saved as a draft, not submitted.' }
        }

        // Confirm the slot is still unique after our write (exclude this new row).
        if (submit) {
          const labClashes = checkConflicts(
            {
              labId: input.labId,
              slot: input.slot,
              studentCount: input.studentCount,
              lines: input.lines,
              excludeId: id,
            },
            {
              labs: liveSnapshot.labs,
              items: liveSnapshot.items,
              requisitions: liveSnapshot.requisitions,
              periods: liveSnapshot.settings.periods,
            },
          ).filter((i) => i.level === 'error' && i.code === 'lab_double_booked')

          if (labClashes.length > 0) {
            liveSnapshot = {
              ...liveSnapshot,
              requisitions: liveSnapshot.requisitions.filter((r) => r.id !== id),
              notifications: (liveSnapshot.notifications ?? []).filter((n) => n.requisitionId !== id),
            }
            persistData(liveSnapshot)
            return {
              ok: false,
              error:
                labClashes[0]?.message ??
                'This laboratory is already booked for that date and period. Choose another lab, period or date.',
            }
          }
        }

        const pushed = await persistAndPush(liveSnapshot)
        if (!pushed && submit) {
          liveSnapshot = {
            ...liveSnapshot,
            requisitions: liveSnapshot.requisitions.filter((r) => r.id !== id),
            notifications: (liveSnapshot.notifications ?? []).filter((n) => n.requisitionId !== id),
          }
          persistData(liveSnapshot)
          return {
            ok: false,
            error: 'Could not reach the shared database. Keep npm run dev running and try again.',
          }
        }

        const finalData = pushed ?? liveSnapshot
        liveSnapshot = finalData
        // Defer React update until after the form marks submitDone and starts navigation.
        queueMicrotask(() => adoptData(setData, finalData))

        return { ok: true, id, submitted: saved.status === 'submitted' }
      },

      updateRequisition: (id, patch) => {
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          Object.assign(req, patch)
          draft.audit.unshift(audit('requisition.update', req.reference, 'Requisition details updated.'))
        })
      },

      submitRequisition: async (id) => {
        let result: { ok: true } | { ok: false; error: string } = {
          ok: false,
          error: 'Requisition not found',
        }
        let priorStatus: Requisition['status'] | null = null
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          if (req.status !== 'draft') {
            result = { ok: false, error: 'Only draft requisitions can be submitted' }
            return
          }
          if (!req.lines.some((l) => l.quantity > 0)) {
            result = { ok: false, error: 'Add at least one apparatus, chemical or reagent line' }
            return
          }
          const issues = checkConflicts(
            {
              labId: req.labId,
              slot: req.slot,
              studentCount: req.studentCount,
              lines: req.lines,
              excludeId: req.id,
            },
            {
              labs: draft.labs,
              items: draft.items,
              requisitions: draft.requisitions,
              periods: draft.settings.periods,
            },
          )
          if (hasBlockingIssue(issues)) {
            const first = issues.find((i) => i.level === 'error')
            result = {
              ok: false,
              error:
                first?.message ??
                'This lab/date/time is already booked. Choose another laboratory, period or date.',
            }
            return
          }
          priorStatus = req.status
          req.status = 'submitted'
          req.submittedAt = nowISO()
          draft.audit.unshift(
            audit('requisition.submit', req.reference, 'Requisition submitted for attendant verification.'),
          )
          notifyApproversOfSubmission(draft, req)
          result = { ok: true }
        })
        if (!result.ok) return result
        if (liveSnapshot) {
          const server = await persistAndPush(liveSnapshot)
          if (server) {
            adoptData(setData, server)
          } else {
            mutate((draft) => {
              const req = findReq(draft, id)
              if (!req) return
              req.status = priorStatus ?? 'draft'
              req.submittedAt = undefined
              draft.notifications = (draft.notifications ?? []).filter(
                (n) => !(n.requisitionId === id && n.title === 'Pending approval'),
              )
            })
            return {
              ok: false,
              error:
                'Could not reach the shared database. Keep npm run dev running and try again.',
            }
          }
        }
        return result
      },

      approveRequisition: (id, note) => {
        if (!assertCan('requisitions.approve')) return
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          req.status = 'approved'
          req.reserved = true
          req.reviewedAt = nowISO()
          req.reviewedBy = actorId
          req.reviewNote = note
          draft.audit.unshift(
            audit(
              'requisition.approve',
              req.reference,
              `Approved and reserved ${req.lines.length} line items.${note ? ` Note: ${note}` : ''}`,
            ),
          )
          notifyTeacher(
            draft,
            req,
            'Requisition approved',
            `${req.reference} was approved and stock reserved.${note ? ` Note: ${note}` : ''}`,
            'requisition.approved',
          )
        })
      },

      rejectRequisition: (id, note) => {
        if (!assertCan('requisitions.approve')) return
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          req.status = 'rejected'
          req.reserved = false
          req.reviewedAt = nowISO()
          req.reviewedBy = actorId
          req.reviewNote = note
          draft.audit.unshift(audit('requisition.reject', req.reference, `Rejected: ${note}`))
          notifyTeacher(
            draft,
            req,
            'Requisition rejected',
            `${req.reference} was rejected. Reason: ${note}`,
            'requisition.rejected',
          )
        })
      },

      markPrepared: (id) => {
        if (!assertCan('requisitions.prepare')) return
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          req.status = 'prepared'
          req.preparedAt = nowISO()
          req.preparedBy = actorId
          draft.audit.unshift(
            audit('requisition.prepare', req.reference, 'Apparatus laid out and lab marked as prepared.'),
          )
          notifyTeacher(
            draft,
            req,
            'Lab prepared',
            `${req.reference} is marked as prepared and ready for the practical.`,
            'requisition.prepared',
          )
        })
      },

      startSession: (id) => {
        if (!assertCan('requisitions.prepare')) return
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          req.status = 'in_progress'
          draft.audit.unshift(audit('session.start', req.reference, 'Practical session started.'))
        })
      },

      completeSession: (id, input) => {
        if (!assertCan('requisitions.complete')) return
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return

          const breakageEntries: BreakageEntry[] = input.breakages
            .filter((b) => b.itemId && b.quantity > 0)
            .map((b) => ({
              id: uid('brk'),
              itemId: b.itemId,
              quantity: b.quantity,
              cause: b.cause || 'No cause given.',
              reportedBy: actorId,
              reportedAt: nowISO(),
            }))

          for (const line of input.consumablesUsed) {
            if (line.quantity <= 0) continue
            const item = draft.items.find((i) => i.id === line.itemId)
            if (!item?.consumable) continue
            applyMovement(
              draft,
              line.itemId,
              -line.quantity,
              'consumption',
              `Consumed during ${req.reference}`,
              req.id,
            )
          }

          for (const b of breakageEntries) {
            draft.breakages.unshift(b)
            applyMovement(draft, b.itemId, -b.quantity, 'breakage', b.cause, req.id)
          }

          const session: SessionLog = {
            id: uid('ses'),
            requisitionId: req.id,
            outcome: input.outcome,
            plannedStart: `${req.slot.date}T${req.slot.start}:00`,
            plannedEnd: `${req.slot.date}T${req.slot.end}:00`,
            actualStart: `${req.slot.date}T${input.actualStart}:00`,
            actualEnd: `${req.slot.date}T${input.actualEnd}:00`,
            studentsPresent: input.studentsPresent,
            notDoneReason: input.outcome === 'not_done' ? input.notDoneReason : undefined,
            remarks: input.remarks,
            consumablesUsed: input.consumablesUsed.filter((l) => l.quantity > 0),
            breakageIds: breakageEntries.map((b) => b.id),
            loggedBy: actorId,
            loggedAt: nowISO(),
          }
          draft.sessions.unshift(session)

          req.status = input.outcome === 'successful' ? 'completed' : 'not_done'
          req.reserved = false

          draft.audit.unshift(
            audit(
              'session.log',
              req.reference,
              input.outcome === 'successful'
                ? `Logged as Successfully Done. ${input.consumablesUsed.length} consumable lines reconciled, ${breakageEntries.length} breakage record(s).`
                : `Logged as Not Done. Reason: ${input.notDoneReason ?? 'unspecified'}.`,
            ),
          )
          notifyTeacher(
            draft,
            req,
            input.outcome === 'successful' ? 'Session completed' : 'Session logged as Not Done',
            input.outcome === 'successful'
              ? `${req.reference} was logged as Successfully Done.`
              : `${req.reference} was logged as Not Done.`,
            input.outcome === 'successful' ? 'session.completed' : 'session.not_done',
          )
        })
      },

      cancelRequisition: (id, reason) => {
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          req.status = 'cancelled'
          req.reserved = false
          draft.audit.unshift(audit('requisition.cancel', req.reference, `Cancelled: ${reason}`))
          if (actorId === req.teacherId) {
            const staffIds = resolveStaffRecipients(draft).filter((id) => id !== actorId)
            const teacher = draft.users.find((u) => u.id === req.teacherId)
            pushNotifications(draft, staffIds, {
              title: 'Requisition withdrawn',
              body: `${teacher?.name ?? 'A teacher'} withdrew ${req.reference}.`,
              kind: 'requisition.cancelled',
              href: `/requisitions/${req.id}`,
              requisitionId: req.id,
            })
          } else {
            notifyTeacher(
              draft,
              req,
              'Requisition cancelled',
              `${req.reference} was cancelled. ${reason}`,
              'requisition.cancelled',
            )
          }
        })
      },

      deleteRequisition: (id) => {
        mutate((draft) => {
          const req = findReq(draft, id)
          if (!req) return
          draft.requisitions = draft.requisitions.filter((r) => r.id !== id)
          draft.audit.unshift(audit('requisition.delete', req.reference, 'Draft requisition deleted.'))
        })
      },

      adjustStock: (itemId, delta, kind, reason) => {
        if (!assertCan('inventory.manage')) return
        mutate((draft) => {
          const item = draft.items.find((i) => i.id === itemId)
          if (!item) return
          applyMovement(draft, itemId, delta, kind, reason)
          draft.audit.unshift(
            audit(
              `stock.${kind}`,
              item.name,
              `${delta > 0 ? '+' : ''}${delta} ${item.unit}. ${reason}`,
            ),
          )
        })
      },

      saveItem: (input) => {
        if (!assertCan('inventory.manage')) return
        mutate((draft) => {
          if (input.id) {
            const idx = draft.items.findIndex((i) => i.id === input.id)
            if (idx >= 0) {
              draft.items[idx] = { ...draft.items[idx], ...input, id: input.id }
              draft.audit.unshift(audit('item.update', input.name, 'Inventory item details updated.'))
            }
            return
          }
          const item: InventoryItem = { ...(input as Omit<InventoryItem, 'id'>), id: uid('item') }
          draft.items.push(item)
          draft.audit.unshift(
            audit('item.create', item.name, `Added new ${item.category} to the store register.`),
          )
        })
      },

      saveUser: (input) => {
        const editingSelf = Boolean(input.id && input.id === currentUserId)
        if (!editingSelf && !assertCan('users.manage')) return
        if (editingSelf && input.id !== currentUserId) return
        // Self-service cannot escalate role or activate flags beyond profile fields.
        mutate((draft) => {
          const role = draft.roles.find((r) => r.id === input.roleId)
          const roleName = role?.name ?? 'role'
          if (input.id) {
            const idx = draft.users.findIndex((u) => u.id === input.id)
            if (idx >= 0) {
              const prev = draft.users[idx]
              if (editingSelf && !can('users.manage')) {
                draft.users[idx] = {
                  ...prev,
                  name: input.name,
                  department: input.department,
                  avatarUrl: input.avatarUrl,
                  password: input.password?.trim() ? input.password : prev.password,
                }
              } else {
                draft.users[idx] = {
                  ...prev,
                  ...input,
                  id: input.id,
                  password: input.password?.trim() ? input.password : prev.password,
                }
              }
              draft.audit.unshift(audit('user.update', input.name, 'User account updated.'))
            }
            return
          }
          if (!can('users.manage')) return
          const user: User = {
            name: input.name,
            email: input.email,
            roleId: input.roleId,
            department: input.department,
            staffNo: input.staffNo,
            active: input.active,
            password: input.password?.trim() || DEMO_PASSWORD,
            id: uid('u'),
            createdAt: nowISO(),
          }
          draft.users.push(user)
          draft.audit.unshift(
            audit('user.create', user.name, `Created ${roleName} account ${user.staffNo}.`),
          )
        })
      },

      toggleUserActive: (id) => {
        if (!assertCan('users.manage')) return
        mutate((draft) => {
          const user = draft.users.find((u) => u.id === id)
          if (!user) return
          user.active = !user.active
          draft.audit.unshift(
            audit(
              user.active ? 'user.activate' : 'user.deactivate',
              user.name,
              `Account ${user.active ? 'reactivated' : 'deactivated'}.`,
            ),
          )
        })
      },

      saveLab: (input) => {
        if (!assertCan('labs.manage')) return input.id ?? ''
        const id = input.id ?? uid('lab')
        mutate((draft) => {
          if (input.id) {
            const idx = draft.labs.findIndex((l) => l.id === input.id)
            if (idx >= 0) {
              draft.labs[idx] = { ...draft.labs[idx], ...input, id: input.id }
              draft.audit.unshift(
                audit('lab.update', input.name, `Updated ${input.name} (capacity ${input.capacity}).`),
              )
            }
            return
          }
          const lab: Lab = {
            id,
            name: input.name,
            code: input.code,
            location: input.location,
            capacity: input.capacity,
            specialisation: input.specialisation,
            hasFumeHood: input.hasFumeHood,
            hasGasSupply: input.hasGasSupply,
            notes: input.notes,
          }
          draft.labs.push(lab)
          draft.audit.unshift(
            audit('lab.create', lab.name, `Added laboratory ${lab.code} (capacity ${lab.capacity}).`),
          )
        })
        return id
      },

      deleteLab: (id) => {
        if (!assertCan('labs.manage')) return { ok: false, error: 'Permission denied.' }
        const lab = data.labs.find((l) => l.id === id)
        if (!lab) return { ok: false, error: 'Laboratory not found.' }
        const live = data.requisitions.filter(
          (r) =>
            r.labId === id &&
            ['submitted', 'approved', 'prepared', 'in_progress'].includes(r.status),
        )
        if (live.length) {
          return {
            ok: false,
            error: `Cannot delete — ${live.length} active booking(s) still use this lab.`,
          }
        }
        mutate((draft) => {
          draft.labs = draft.labs.filter((l) => l.id !== id)
          draft.audit.unshift(audit('lab.delete', lab.name, 'Laboratory removed from the register.'))
        })
        return { ok: true }
      },

      saveRole: (input) => {
        if (!assertCan('roles.manage')) return input.id ?? ''
        const id = input.id ?? uid('role')
        mutate((draft) => {
          if (input.id) {
            const idx = draft.roles.findIndex((r) => r.id === input.id)
            if (idx >= 0) {
              const prev = draft.roles[idx]
              draft.roles[idx] = {
                ...prev,
                name: input.name.trim(),
                description: input.description.trim(),
                permissions: [...input.permissions],
              }
              draft.audit.unshift(
                audit('role.update', input.name.trim(), `Updated permissions (${input.permissions.length}).`),
              )
            }
            return
          }
          const role: AppRole = {
            id,
            name: input.name.trim(),
            description: input.description.trim(),
            permissions: [...input.permissions],
            system: false,
            createdAt: nowISO(),
          }
          draft.roles.push(role)
          draft.audit.unshift(
            audit('role.create', role.name, `Created role with ${role.permissions.length} permission(s).`),
          )
        })
        return id
      },

      deleteRole: (id) => {
        if (!assertCan('roles.manage')) return { ok: false, error: 'Permission denied.' }
        const role = data.roles.find((r) => r.id === id)
        if (!role) return { ok: false, error: 'Role not found.' }
        if (role.system) return { ok: false, error: 'Built-in system roles cannot be deleted.' }
        if (data.users.some((u) => u.roleId === id)) {
          return { ok: false, error: 'Reassign users before deleting this role.' }
        }
        mutate((draft) => {
          draft.roles = draft.roles.filter((r) => r.id !== id)
          draft.audit.unshift(audit('role.delete', role.name, 'Custom role deleted.'))
        })
        return { ok: true }
      },

      saveSettings: (settings) => {
        if (!assertCan('settings.manage')) return
        mutate((draft) => {
          const prevById = new Map(draft.settings.periods.map((p) => [p.id, p]))
          draft.settings = JSON.parse(JSON.stringify(settings)) as SystemSettings
          // Keep bookings aligned when period times are edited (same period id).
          for (const req of draft.requisitions) {
            const pid = req.slot.periodId
            if (!pid) continue
            const next = draft.settings.periods.find((p) => p.id === pid)
            if (!next) continue
            const prev = prevById.get(pid)
            if (prev && (prev.start !== next.start || prev.end !== next.end)) {
              req.slot = { ...req.slot, start: next.start, end: next.end, periodId: next.id }
            }
          }
          draft.audit.unshift(
            audit(
              'settings.update',
              settings.schoolName,
              `Updated system settings (${settings.periods.length} periods, ${settings.subjects.length} subjects).`,
            ),
          )
        })
      },

      updateMyProfile: (input) => {
        if (!currentUserId) return { ok: false, error: 'Not signed in.' }
        if (input.name !== undefined && !input.name.trim()) {
          return { ok: false, error: 'Display name is required.' }
        }
        if (input.password !== undefined && input.password.trim() && input.password.trim().length < 6) {
          return { ok: false, error: 'Password must be at least 6 characters.' }
        }
        mutate((draft) => {
          const user = draft.users.find((u) => u.id === currentUserId)
          if (!user) return
          if (input.name !== undefined) user.name = input.name.trim()
          if (input.password !== undefined && input.password.trim()) {
            user.password = input.password.trim()
          }
          if (input.avatarUrl !== undefined) {
            user.avatarUrl = input.avatarUrl || undefined
          }
          draft.audit.unshift(
            audit('profile.update', user.name, 'Updated personal profile settings.'),
          )
        })
        return { ok: true }
      },

      myNotifications: () => {
        if (!currentUserId || !data.notifications) return []
        return data.notifications
          .filter((n) => n.userId === currentUserId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      },

      unreadNotificationCount: () => {
        if (!currentUserId || !data.notifications) return 0
        return data.notifications.filter((n) => n.userId === currentUserId && !n.read).length
      },

      markNotificationRead: (id) => {
        mutate((draft) => {
          const target = draft.notifications?.find((x) => x.id === id && x.userId === currentUserId)
          if (!target) return
          target.read = true
          for (const n of draft.notifications ?? []) {
            if (
              n.userId === currentUserId &&
              n.requisitionId &&
              n.requisitionId === target.requisitionId &&
              n.kind === target.kind &&
              n.title === target.title
            ) {
              n.read = true
            }
          }
        })
      },

      markAllNotificationsRead: () => {
        if (!currentUserId) return
        mutate((draft) => {
          for (const n of draft.notifications ?? []) {
            if (n.userId === currentUserId) n.read = true
          }
        })
      },

      dismissNotification: (id) => {
        if (!currentUserId) return
        mutate((draft) => {
          draft.notifications = (draft.notifications ?? []).filter(
            (n) => !(n.id === id && n.userId === currentUserId),
          )
        })
      },

      clearMyNotifications: () => {
        if (!currentUserId) return
        mutate((draft) => {
          // Permanently clear this user's inbox — later alerts are new only.
          draft.notifications = (draft.notifications ?? []).filter((n) => n.userId !== currentUserId)
        })
      },
    }
  }, [data, currentUser, currentRole, currentUserId])

  if (!ready || !value) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" suppressHydrationWarning>
        <p className="text-sm text-muted-foreground">Loading laboratory records…</p>
      </div>
    )
  }

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>
}

export function useLms() {
  const ctx = React.useContext(LmsContext)
  if (!ctx) throw new Error('useLms must be used inside LmsProvider')
  return ctx
}
