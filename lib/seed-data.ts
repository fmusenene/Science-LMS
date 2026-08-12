import {
  ALL_PERMISSIONS,
  ATTENDANT_PERMISSIONS,
  LMS_SCHEMA_VERSION,
  TEACHER_PERMISSIONS,
} from './permissions'
import { createSeedInventory } from './inventory-seed'
import type { AppRole, Lab, LmsData, SystemSettings, User } from './types'
import { DEMO_PASSWORD } from './types'

/** Standard school double-period slots used across the timetable. */
export const PERIODS = [
  { id: 'p1', label: 'Period 1-2', start: '08:00', end: '09:20' },
  { id: 'p2', label: 'Period 3-4', start: '09:20', end: '10:40' },
  { id: 'p3', label: 'Period 5-6', start: '11:00', end: '12:20' },
  { id: 'p4', label: 'Period 7-8', start: '12:20', end: '13:40' },
  { id: 'p5', label: 'Period 9-10', start: '14:00', end: '15:20' },
  { id: 'p6', label: 'Period 11-12', start: '15:20', end: '16:40' },
]

export const SUBJECTS = [
  'Chemistry',
  'Biology',
  'Physics',
  'Integrated Science',
  'Agriculture',
]

export const FORMS = ['Form 1', 'Form 2', 'Form 3', 'Form 4']

export function createDefaultSettings(): SystemSettings {
  return {
    schoolName: 'Science LMS',
    schoolTagline: 'Laboratory Management System',
    periods: PERIODS.map((p) => ({ ...p })),
    subjects: [...SUBJECTS],
    forms: [...FORMS],
    notDoneReasons: [
      { id: 'power_outage', label: 'Power outage' },
      { id: 'missing_reagents', label: 'Missing reagents' },
      { id: 'teacher_absence', label: 'Teacher absence' },
      { id: 'lab_unavailable', label: 'Lab unavailable' },
      { id: 'equipment_failure', label: 'Equipment failure' },
      { id: 'insufficient_time', label: 'Insufficient time' },
      { id: 'other', label: 'Other' },
    ],
  }
}

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `ref`. */
export function startOfWeek(ref: Date) {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return d
}

export function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const ACCOUNT_CREATED_AT = '2026-01-01T08:00:00'

// ---------------------------------------------------------------- labs (empty rooms — no bookings)

export const seedLabs: Lab[] = [
  {
    id: 'lab-1',
    name: 'Laboratory 1',
    code: 'LAB-01',
    location: 'Science Block A, Ground Floor',
    capacity: 40,
    specialisation: 'Chemistry',
    hasFumeHood: true,
    hasGasSupply: true,
  },
  {
    id: 'lab-2',
    name: 'Laboratory 2',
    code: 'LAB-02',
    location: 'Science Block A, Ground Floor',
    capacity: 36,
    specialisation: 'Chemistry',
    hasFumeHood: true,
    hasGasSupply: true,
  },
  {
    id: 'lab-3',
    name: 'Laboratory 3',
    code: 'LAB-03',
    location: 'Science Block A, First Floor',
    capacity: 32,
    specialisation: 'Biology',
    hasFumeHood: false,
    hasGasSupply: true,
  },
  {
    id: 'lab-4',
    name: 'Laboratory 4',
    code: 'LAB-04',
    location: 'Science Block A, First Floor',
    capacity: 32,
    specialisation: 'Biology',
    hasFumeHood: false,
    hasGasSupply: false,
  },
  {
    id: 'lab-5',
    name: 'Laboratory 5',
    code: 'LAB-05',
    location: 'Science Block B, Ground Floor',
    capacity: 30,
    specialisation: 'Physics',
    hasFumeHood: false,
    hasGasSupply: false,
  },
  {
    id: 'lab-6',
    name: 'Laboratory 6',
    code: 'LAB-06',
    location: 'Science Block B, First Floor',
    capacity: 24,
    specialisation: 'Physics / Multipurpose',
    hasFumeHood: false,
    hasGasSupply: false,
  },
]

// ---------------------------------------------------------------- roles

export const seedRoles: AppRole[] = [
  {
    id: 'role-admin',
    name: 'System Administrator',
    description: 'Full access to users, roles, labs, inventory and operational workflows.',
    permissions: [...ALL_PERMISSIONS],
    system: true,
    createdAt: ACCOUNT_CREATED_AT,
  },
  {
    id: 'role-attendant',
    name: 'Lab Attendant',
    description: 'Approve requisitions, manage store stock, prepare labs and close sessions.',
    permissions: [...ATTENDANT_PERMISSIONS],
    system: true,
    createdAt: ACCOUNT_CREATED_AT,
  },
  {
    id: 'role-teacher',
    name: 'Teacher',
    description: 'Submit practical requisitions and view own bookings, schedule and catalogue.',
    permissions: [...TEACHER_PERMISSIONS],
    system: true,
    createdAt: ACCOUNT_CREATED_AT,
  },
]

/** Only the three sign-in accounts — no other demo users. */
export const seedUsers: User[] = [
  {
    id: 'u-admin-1',
    name: 'Dr. Miriam Achieng',
    email: 'admin@school.ac',
    password: DEMO_PASSWORD,
    roleId: 'role-admin',
    department: 'Administration',
    staffNo: 'ADM-001',
    active: true,
    createdAt: ACCOUNT_CREATED_AT,
  },
  {
    id: 'u-att-1',
    name: 'Grace Wanjiru',
    email: 'attendant@school.ac',
    password: DEMO_PASSWORD,
    roleId: 'role-attendant',
    department: 'Science Store',
    staffNo: 'LAB-101',
    active: true,
    createdAt: ACCOUNT_CREATED_AT,
  },
  {
    id: 'u-tea-1',
    name: 'Joseph Mwangi',
    email: 'teacher@school.ac',
    password: DEMO_PASSWORD,
    roleId: 'role-teacher',
    department: 'Chemistry',
    staffNo: 'TSC-2201',
    active: true,
    createdAt: ACCOUNT_CREATED_AT,
  },
]

/** Clean system: accounts + roles + labs + settings + store inventory. No demo bookings. */
export function createSeedData(): LmsData {
  return {
    schemaVersion: LMS_SCHEMA_VERSION,
    revision: 1,
    settings: createDefaultSettings(),
    roles: seedRoles,
    users: seedUsers,
    labs: seedLabs,
    items: createSeedInventory(),
    requisitions: [],
    sessions: [],
    breakages: [],
    movements: [],
    audit: [],
    notifications: [],
  }
}
