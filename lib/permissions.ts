export const PERMISSION_IDS = [
  'dashboard.view',
  'requisitions.view_own',
  'requisitions.view_all',
  'requisitions.create',
  'requisitions.approve',
  'requisitions.prepare',
  'requisitions.complete',
  'schedule.view',
  'schedule.manage',
  'inventory.view',
  'inventory.manage',
  'labs.view',
  'labs.manage',
  'sessions.view',
  'users.manage',
  'roles.manage',
  'settings.manage',
  'audit.view',
] as const

export type PermissionId = (typeof PERMISSION_IDS)[number]

export type PermissionDef = {
  id: PermissionId
  label: string
  description: string
  group: string
}

export const PERMISSION_CATALOGUE: PermissionDef[] = [
  {
    id: 'dashboard.view',
    label: 'View dashboard',
    description: 'Access the home dashboard and summary cards.',
    group: 'Dashboard',
  },
  {
    id: 'requisitions.view_own',
    label: 'View own requisitions',
    description: 'See only requisitions created for this user.',
    group: 'Requisitions',
  },
  {
    id: 'requisitions.view_all',
    label: 'View all requisitions',
    description: 'See every practical requisition in the school.',
    group: 'Requisitions',
  },
  {
    id: 'requisitions.create',
    label: 'Create requisitions',
    description: 'Draft and submit new practical lesson requests.',
    group: 'Requisitions',
  },
  {
    id: 'requisitions.approve',
    label: 'Approve / reject',
    description: 'Verify submitted requests and reserve stock.',
    group: 'Requisitions',
  },
  {
    id: 'requisitions.prepare',
    label: 'Prepare labs',
    description: 'Mark approved bookings as prepared and start sessions.',
    group: 'Requisitions',
  },
  {
    id: 'requisitions.complete',
    label: 'Complete sessions',
    description: 'Log successful or not-done outcomes with stock reconciliation.',
    group: 'Requisitions',
  },
  {
    id: 'schedule.view',
    label: 'View schedule',
    description: 'Open the laboratory timetable calendar.',
    group: 'Schedule',
  },
  {
    id: 'schedule.manage',
    label: 'Edit schedule',
    description: 'Reschedule bookings (change lab, date or period) from the timetable.',
    group: 'Schedule',
  },
  {
    id: 'inventory.view',
    label: 'View inventory',
    description: 'Browse the apparatus, chemical and reagent catalogue.',
    group: 'Inventory',
  },
  {
    id: 'inventory.manage',
    label: 'Manage inventory',
    description: 'Adjust stock, receive deliveries and edit item records.',
    group: 'Inventory',
  },
  {
    id: 'labs.view',
    label: 'View laboratories',
    description: 'See laboratory rooms, capacity and bookings.',
    group: 'Laboratories',
  },
  {
    id: 'labs.manage',
    label: 'Manage laboratories',
    description: 'Add new laboratories and edit existing room configuration.',
    group: 'Laboratories',
  },
  {
    id: 'sessions.view',
    label: 'View session logs',
    description: 'Open completed practical session records.',
    group: 'Sessions',
  },
  {
    id: 'users.manage',
    label: 'Manage users',
    description: 'Create staff accounts and assign roles.',
    group: 'Administration',
  },
  {
    id: 'roles.manage',
    label: 'Manage roles',
    description: 'Create roles and assign permissions.',
    group: 'Administration',
  },
  {
    id: 'settings.manage',
    label: 'Manage settings',
    description: 'Configure periods, subjects, forms and incomplete-session reasons.',
    group: 'Administration',
  },
  {
    id: 'audit.view',
    label: 'View audit log',
    description: 'Inspect system activity history.',
    group: 'Administration',
  },
]

export const ALL_PERMISSIONS: PermissionId[] = [...PERMISSION_IDS]

/** Operational lab-store permissions for the default attendant role. */
export const ATTENDANT_PERMISSIONS: PermissionId[] = [
  'dashboard.view',
  'requisitions.view_all',
  'requisitions.approve',
  'requisitions.prepare',
  'requisitions.complete',
  'schedule.view',
  'schedule.manage',
  'inventory.view',
  'inventory.manage',
  'labs.view',
  'sessions.view',
]

/** Default teacher permissions — own requests plus read-only store/labs. */
export const TEACHER_PERMISSIONS: PermissionId[] = [
  'dashboard.view',
  'requisitions.view_own',
  'requisitions.create',
  'schedule.view',
  'inventory.view',
  'labs.view',
]

export function permissionGroups(): { group: string; items: PermissionDef[] }[] {
  const map = new Map<string, PermissionDef[]>()
  for (const def of PERMISSION_CATALOGUE) {
    const list = map.get(def.group) ?? []
    list.push(def)
    map.set(def.group, list)
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }))
}

export function isPermissionId(value: string): value is PermissionId {
  return (PERMISSION_IDS as readonly string[]).includes(value)
}

/** Preferred landing / fallback routes when a user lacks access to the current page. */
export const APP_ROUTE_GATES: { path: string; anyOf: PermissionId[] }[] = [
  { path: '/dashboard', anyOf: ['dashboard.view'] },
  { path: '/requisitions', anyOf: ['requisitions.view_own', 'requisitions.view_all', 'requisitions.create'] },
  { path: '/schedule', anyOf: ['schedule.view'] },
  { path: '/inventory', anyOf: ['inventory.view'] },
  { path: '/labs', anyOf: ['labs.view'] },
  { path: '/sessions', anyOf: ['sessions.view'] },
  { path: '/users', anyOf: ['users.manage'] },
  { path: '/roles', anyOf: ['roles.manage'] },
  // /settings is open to every signed-in user (profile); system tabs are gated in-page
  { path: '/audit', anyOf: ['audit.view'] },
]

export function firstAccessiblePath(can: (permission: PermissionId) => boolean): string {
  for (const gate of APP_ROUTE_GATES) {
    if (gate.anyOf.some((p) => can(p))) return gate.path
  }
  return '/'
}

/** Ensure system admin always has the full catalogue; other roles keep saved permissions. */
export function syncAdminPermissions(role: {
  id: string
  name: string
  system: boolean
  permissions: PermissionId[]
}): PermissionId[] {
  if (role.id === 'role-admin' || (role.system && role.name === 'System Administrator')) {
    return [...ALL_PERMISSIONS]
  }
  return role.permissions
}

/**
 * One-shot migrations that add newly introduced permissions to built-in roles
 * without re-applying full baselines (which would undo admin edits).
 */
export function applyPermissionMigrations(
  roles: { id: string; name: string; system: boolean; permissions: PermissionId[] }[],
  fromVersion: number,
  toVersion: number,
): void {
  if (fromVersion >= toVersion) return
  for (const role of roles) {
    if (fromVersion < 2) {
      const isAttendant =
        role.id === 'role-attendant' || (role.system && role.name === 'Lab Attendant')
      if (isAttendant && !role.permissions.includes('schedule.manage')) {
        role.permissions = [...role.permissions, 'schedule.manage']
      }
    }
    if (fromVersion < 3) {
      const isAttendant =
        role.id === 'role-attendant' || (role.system && role.name === 'Lab Attendant')
      if (isAttendant) {
        for (const p of ['requisitions.approve', 'requisitions.view_all', 'requisitions.prepare'] as PermissionId[]) {
          if (!role.permissions.includes(p)) {
            role.permissions = [...role.permissions, p]
          }
        }
      }
    }
  }
}

export const LMS_SCHEMA_VERSION = 3

/** @deprecated Prefer syncAdminPermissions + applyPermissionMigrations */
export function mergeSystemRolePermissions(role: {
  id: string
  name: string
  system: boolean
  permissions: PermissionId[]
}): PermissionId[] {
  return syncAdminPermissions(role)
}
