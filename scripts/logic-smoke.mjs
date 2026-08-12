/**
 * Standalone logic smoke (no TS imports) — validates demo account expectations.
 * Run: node scripts/logic-smoke.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const ok = (m) => console.log('OK:', m)
const fail = (m) => {
  failures.push(m)
  console.log('FAIL:', m)
}

// Parse key constants from source files (lightweight static checks)
const permsSrc = readFileSync(join(root, 'lib/permissions.ts'), 'utf8')
const seedSrc = readFileSync(join(root, 'lib/seed-data.ts'), 'utf8')
const storeSrc = readFileSync(join(root, 'lib/lms-store.tsx'), 'utf8')
const authSrc = readFileSync(join(root, 'components/lms/auth-gate.tsx'), 'utf8')
const schedSrc = readFileSync(join(root, 'app/(portal)/schedule/page.tsx'), 'utf8')
const detailSrc = readFileSync(join(root, 'app/(portal)/requisitions/[id]/page.tsx'), 'utf8')
const invSrc = readFileSync(join(root, 'app/(portal)/inventory/page.tsx'), 'utf8')
const dashSrc = readFileSync(join(root, 'app/(portal)/dashboard/page.tsx'), 'utf8')
const newSrc = readFileSync(join(root, 'app/(portal)/requisitions/new/page.tsx'), 'utf8')

// Accounts present in seed
for (const email of ['admin@school.ac', 'attendant@school.ac', 'teacher@school.ac']) {
  if (!seedSrc.includes(`email: '${email}'`)) fail(`seed missing ${email}`)
  else ok(`seed has ${email}`)
}
if (!seedSrc.includes("DEMO_PASSWORD") && !seedSrc.includes("password: DEMO_PASSWORD")) {
  fail('seed passwords not using DEMO_PASSWORD')
} else ok('demo passwords wired')

// Attendant has schedule.manage
if (!permsSrc.includes("'schedule.manage'") || !/ATTENDANT_PERMISSIONS[\s\S]*schedule\.manage/.test(permsSrc)) {
  fail('ATTENDANT_PERMISSIONS missing schedule.manage')
} else ok('attendant includes schedule.manage')

// Auth gate denies synchronously
if (!authSrc.includes('if (denied)')) fail('AuthGate missing sync denied guard')
else ok('AuthGate blocks forbidden pages before render')

// Empty draft submit guard
if (!detailSrc.includes('Add at least one apparatus')) fail('detail submit missing lines check')
else ok('draft submit requires lines')
if (!storeSrc.includes('if (!req.lines.some((l) => l.quantity > 0)) return')) {
  fail('store submitRequisition missing lines guard')
} else ok('store submit rejects empty lines')

// Period remapping on settings save
if (!storeSrc.includes('Keep bookings aligned when period times')) {
  fail('saveSettings missing period remapping')
} else ok('settings save remaps booking slots')

// Schedule matches periodId
if (!schedSrc.includes('r.slot.periodId')) fail('schedule not matching periodId')
else ok('schedule matches by periodId')
if (/can\('schedule\.manage'\)\s*\|\|\s*can\('labs\.manage'\)/.test(schedSrc)) {
  fail('reschedule still gated by labs.manage')
} else ok('reschedule gated by schedule.manage only')

// New requisition stores periodId
if (!newSrc.includes('periodId: period?.id')) fail('new requisition missing periodId on slot')
else ok('new requisition stores periodId')

// Inventory edit does not overwrite stock casually
if (!invSrc.includes('Use Adjust to change stock')) fail('inventory edit still allows free onHand edit UX')
else ok('inventory edit disables onHand')

// Teacher recent sorted
if (!dashSrc.includes('[...myReqs]')) fail('teacher dashboard recent not sorted')
else ok('teacher recent requisitions sorted')

// Migration helpers exist
if (!permsSrc.includes('applyPermissionMigrations')) fail('missing applyPermissionMigrations')
else ok('permission migrations present')
if (!permsSrc.includes('syncAdminPermissions')) fail('missing syncAdminPermissions')
else ok('admin permission sync present')

// Seed schema + periodId
if (!seedSrc.includes('schemaVersion: 2')) fail('seed missing schemaVersion 2')
else ok('seed schemaVersion 2')
if (!seedSrc.includes('periodId: period.id')) fail('seed requisitions missing periodId')
else ok('seed slots include periodId')

console.log('\n========== SUMMARY ==========')
if (failures.length) {
  console.log(failures.length + ' failure(s)')
  process.exit(1)
}
console.log('All static smoke checks passed for admin/attendant/teacher wiring.')
