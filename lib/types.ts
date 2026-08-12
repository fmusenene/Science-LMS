import type { PermissionId } from './permissions'

export type AppRole = {
  id: string
  name: string
  description: string
  permissions: PermissionId[]
  /** Built-in roles cannot be deleted. */
  system: boolean
  createdAt: string
}

export type User = {
  id: string
  name: string
  email: string
  /** Password hash (scrypt$…) on the server; always blank in browser payloads. */
  password: string
  roleId: string
  department?: string
  staffNo: string
  active: boolean
  createdAt: string
  /** Optional profile photo as a data URL (browser-local). */
  avatarUrl?: string
}

export type Lab = {
  id: string
  name: string
  code: string
  location: string
  capacity: number
  specialisation: string
  hasFumeHood: boolean
  hasGasSupply: boolean
  notes?: string
}

export type ItemCategory = 'apparatus' | 'chemical' | 'reagent'

/** Apparatus is returnable; chemicals and reagents are consumed. */
export type InventoryItem = {
  id: string
  name: string
  code: string
  category: ItemCategory
  unit: string
  onHand: number
  reorderLevel: number
  storageLocation: string
  hazardClass?: string
  concentration?: string
  expiryDate?: string
  consumable: boolean
  notes?: string
}

export type RequisitionLine = {
  itemId: string
  quantity: number
}

export type RequisitionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'prepared'
  | 'in_progress'
  | 'completed'
  | 'not_done'
  | 'rejected'
  | 'cancelled'

export const REQUISITION_FLOW: RequisitionStatus[] = [
  'submitted',
  'approved',
  'prepared',
  'in_progress',
  'completed',
]

export type TimeSlot = {
  /** ISO date, e.g. 2026-08-04 */
  date: string
  /** 24h HH:MM */
  start: string
  end: string
  /** Optional link to settings.periods[].id for timetable remapping. */
  periodId?: string
}

export type Requisition = {
  id: string
  reference: string
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
  status: RequisitionStatus
  createdAt: string
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: string
  reviewNote?: string
  preparedAt?: string
  preparedBy?: string
  /** Quantities held against stock while the booking is live. */
  reserved: boolean
}

export type NotDoneReason = string

export type PeriodConfig = {
  id: string
  label: string
  /** 24h HH:MM */
  start: string
  end: string
}

export type ReasonConfig = {
  id: string
  label: string
}

/** Admin-editable catalogue used across timetable and requisitions. */
export type SystemSettings = {
  schoolName: string
  schoolTagline: string
  periods: PeriodConfig[]
  subjects: string[]
  forms: string[]
  notDoneReasons: ReasonConfig[]
}

export type BreakageEntry = {
  id: string
  itemId: string
  quantity: number
  cause: string
  reportedBy: string
  reportedAt: string
}

export type SessionOutcome = 'successful' | 'not_done'

export type SessionLog = {
  id: string
  requisitionId: string
  outcome: SessionOutcome
  plannedStart: string
  plannedEnd: string
  actualStart: string
  actualEnd: string
  studentsPresent: number
  notDoneReason?: NotDoneReason
  remarks: string
  consumablesUsed: RequisitionLine[]
  breakageIds: string[]
  loggedBy: string
  loggedAt: string
}

export type MovementKind =
  | 'receipt'
  | 'consumption'
  | 'breakage'
  | 'adjustment'
  | 'return'

export type StockMovement = {
  id: string
  itemId: string
  kind: MovementKind
  /** Signed change applied to onHand. */
  delta: number
  reason: string
  actorId: string
  createdAt: string
  requisitionId?: string
}

export type AuditEntry = {
  id: string
  actorId: string
  action: string
  target: string
  detail: string
  createdAt: string
}

export type AppNotification = {
  id: string
  userId: string
  title: string
  body: string
  href?: string
  kind:
    | 'requisition.submitted'
    | 'requisition.approved'
    | 'requisition.rejected'
    | 'requisition.prepared'
    | 'requisition.cancelled'
    | 'session.completed'
    | 'session.not_done'
    | 'general'
  read: boolean
  createdAt: string
  requisitionId?: string
}

export type LmsData = {
  /** Bumps when load-time migrations need to run once. */
  schemaVersion?: number
  /** Monotonic write counter — prevents stale tabs from overwriting newer submissions. */
  revision?: number
  settings: SystemSettings
  roles: AppRole[]
  users: User[]
  labs: Lab[]
  items: InventoryItem[]
  requisitions: Requisition[]
  sessions: SessionLog[]
  breakages: BreakageEntry[]
  movements: StockMovement[]
  audit: AuditEntry[]
  notifications: AppNotification[]
}

export const STATUS_LABEL: Record<RequisitionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved / Reserved',
  prepared: 'Lab Prepared',
  in_progress: 'In Progress',
  completed: 'Completed',
  not_done: 'Not Done',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  apparatus: 'Apparatus',
  chemical: 'Chemical',
  reagent: 'Reagent',
}

/** Demo password shared by seeded accounts. */
export const DEMO_PASSWORD = 'password'
