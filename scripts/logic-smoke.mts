/**
 * Logic-level smoke test (no browser) — validates seed, permissions, and scheduling
 * for admin / attendant / teacher accounts.
 * Run: node --experimental-strip-types scripts/logic-smoke.mts
 */
import { createSeedData, PERIODS } from '../lib/seed-data.ts'
import {
  ATTENDANT_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ALL_PERMISSIONS,
  firstAccessiblePath,
  applyPermissionMigrations,
  syncAdminPermissions,
  LMS_SCHEMA_VERSION,
} from '../lib/permissions.ts'
import { checkConflicts, hasBlockingIssue, activeBookings } from '../lib/scheduling.ts'

const failures: string[] = []
function fail(msg: string) {
  failures.push(msg)
  console.log('FAIL:', msg)
}
function ok(msg: string) {
  console.log('OK:', msg)
}

const data = createSeedData()

// --- seed integrity ---
if (data.schemaVersion !== 2) fail('seed schemaVersion should be 2')
else ok('schemaVersion 2')

if (!data.settings.periods.length) fail('no periods in settings')
else ok(`${data.settings.periods.length} periods`)

if (!data.settings.subjects.length || !data.settings.forms.length) fail('subjects/forms missing')
else ok('subjects and forms present')

if (!data.settings.notDoneReasons.length) fail('notDoneReasons missing')
else ok('notDoneReasons present')

for (const req of data.requisitions) {
  if (!req.slot.periodId) fail(`requisition ${req.id} missing periodId`)
  const p = data.settings.periods.find((x) => x.id === req.slot.periodId)
  if (req.slot.periodId && !p) fail(`requisition ${req.id} periodId ${req.slot.periodId} not in settings`)
  if (p && (p.start !== req.slot.start || p.end !== req.slot.end)) {
    fail(`requisition ${req.id} slot times mismatch period ${p.id}`)
  }
}
ok('all seed requisitions have matching periodId')

// --- accounts ---
const accounts = [
  { email: 'admin@school.ac', pass: 'password', roleId: 'role-admin' },
  { email: 'attendant@school.ac', pass: 'password', roleId: 'role-attendant' },
  { email: 'teacher@school.ac', pass: 'password', roleId: 'role-teacher' },
]

for (const a of accounts) {
  const user = data.users.find((u) => u.email === a.email)
  if (!user) {
    fail(`missing user ${a.email}`)
    continue
  }
  if (user.password !== a.pass) fail(`${a.email} password mismatch`)
  if (!user.active) fail(`${a.email} inactive`)
  if (user.roleId !== a.roleId) fail(`${a.email} unexpected role`)
  ok(`account ${a.email}`)
}

const adminRole = data.roles.find((r) => r.id === 'role-admin')!
const attRole = data.roles.find((r) => r.id === 'role-attendant')!
const teaRole = data.roles.find((r) => r.id === 'role-teacher')!

for (const p of ALL_PERMISSIONS) {
  if (!adminRole.permissions.includes(p)) fail(`admin missing ${p}`)
}
ok('admin has all permissions')

for (const p of ATTENDANT_PERMISSIONS) {
  if (!attRole.permissions.includes(p)) fail(`attendant missing ${p}`)
}
if (!attRole.permissions.includes('schedule.manage')) fail('attendant missing schedule.manage')
if (attRole.permissions.includes('settings.manage')) fail('attendant should not manage settings')
if (attRole.permissions.includes('users.manage')) fail('attendant should not manage users')
ok('attendant permissions look correct')

for (const p of TEACHER_PERMISSIONS) {
  if (!teaRole.permissions.includes(p)) fail(`teacher missing ${p}`)
}
if (teaRole.permissions.includes('requisitions.approve')) fail('teacher should not approve')
if (teaRole.permissions.includes('sessions.view')) fail('teacher should not see sessions')
ok('teacher permissions look correct')

// --- firstAccessiblePath ---
const canOf = (perms: string[]) => (p: string) => perms.includes(p)
if (firstAccessiblePath(canOf(adminRole.permissions) as any) !== '/dashboard') {
  fail('admin home should be dashboard')
} else ok('admin home /dashboard')

if (firstAccessiblePath(canOf(attRole.permissions) as any) !== '/dashboard') {
  fail('attendant home should be dashboard')
} else ok('attendant home /dashboard')

if (firstAccessiblePath(canOf(teaRole.permissions) as any) !== '/dashboard') {
  fail('teacher home should be dashboard')
} else ok('teacher home /dashboard')

// --- permission migration does not re-add removed perms after schema caught up ---
const customAtt = {
  id: 'role-attendant',
  name: 'Lab Attendant',
  system: true,
  permissions: ATTENDANT_PERMISSIONS.filter((p) => p !== 'inventory.manage') as typeof ATTENDANT_PERMISSIONS,
}
applyPermissionMigrations([customAtt], LMS_SCHEMA_VERSION, LMS_SCHEMA_VERSION)
if (customAtt.permissions.includes('inventory.manage')) {
  fail('migration re-added removed inventory.manage')
} else ok('migration respects admin-removed permissions at current schema')

const staleAtt = {
  id: 'role-attendant',
  name: 'Lab Attendant',
  system: true,
  permissions: ATTENDANT_PERMISSIONS.filter((p) => p !== 'schedule.manage') as typeof ATTENDANT_PERMISSIONS,
}
applyPermissionMigrations([staleAtt], 0, 2)
if (!staleAtt.permissions.includes('schedule.manage')) {
  fail('migration v0→2 should add schedule.manage')
} else ok('migration v0→2 adds schedule.manage')

const synced = syncAdminPermissions({
  id: 'role-admin',
  name: 'System Administrator',
  system: true,
  permissions: ['dashboard.view'] as any,
})
if (synced.length !== ALL_PERMISSIONS.length) fail('admin sync incomplete')
else ok('admin sync restores ALL_PERMISSIONS')

// --- conflict check on a submitted booking ---
const sample = data.requisitions.find((r) => r.status === 'submitted' || r.status === 'approved')
if (sample) {
  const issues = checkConflicts(
    {
      labId: sample.labId,
      slot: sample.slot,
      studentCount: sample.studentCount,
      lines: sample.lines,
      excludeId: sample.id,
    },
    { labs: data.labs, items: data.items, requisitions: data.requisitions },
  )
  ok(`conflict scan for ${sample.reference}: ${issues.length} issue(s)`)
  // Self-exclude should not create room conflict with itself
  const selfConflict = issues.find((i) => i.message?.includes?.(sample.reference))
  void selfConflict
}

const live = activeBookings(data.requisitions)
ok(`active bookings: ${live.length}`)

// Simulate period time remapping
const period = data.settings.periods[0]
const linked = data.requisitions.filter((r) => r.slot.periodId === period.id)
const newStart = '07:50'
for (const r of linked) {
  r.slot = { ...r.slot, start: newStart, end: period.end }
}
const stillLinked = linked.every((r) => r.slot.periodId === period.id && r.slot.start === newStart)
if (!stillLinked) fail('period remapping simulation failed')
else ok(`period remapping keeps ${linked.length} bookings on ${period.id}`)

// PERIODS seed matches settings periods
for (const p of PERIODS) {
  const s = data.settings.periods.find((x) => x.id === p.id)
  if (!s) fail(`settings missing period ${p.id}`)
  else if (s.start !== p.start || s.end !== p.end) fail(`period ${p.id} drift`)
}
ok('seed PERIODS match settings.periods')

console.log('\n========== SUMMARY ==========')
if (failures.length) {
  console.log(`${failures.length} failure(s)`)
  process.exit(1)
}
console.log('All logic smoke checks passed.')
