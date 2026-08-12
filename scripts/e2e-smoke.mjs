/**
 * Smoke-test all demo roles against the running LMS at localhost:3000.
 * Run: npx playwright install chromium && node scripts/e2e-smoke.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.LMS_BASE || 'http://localhost:3000'
const PASS = 'password'

const accounts = [
  {
    email: 'admin@school.ac',
    label: 'Admin',
    expectNav: ['Dashboard', 'Requisitions', 'Lab Schedule', 'Store & Inventory', 'Laboratories', 'Session Logs', 'Users', 'Roles & Permissions', 'Settings', 'Audit Log'],
    forbidNav: [],
    pages: ['/dashboard', '/requisitions', '/schedule', '/inventory', '/labs', '/sessions', '/users', '/roles', '/settings', '/audit'],
    forbidPages: [],
  },
  {
    email: 'attendant@school.ac',
    label: 'Attendant',
    expectNav: ['Dashboard', 'Requisitions', 'Lab Schedule', 'Store & Inventory', 'Laboratories', 'Session Logs'],
    forbidNav: ['Users', 'Roles & Permissions', 'Settings', 'Audit Log'],
    pages: ['/dashboard', '/requisitions', '/schedule', '/inventory', '/labs', '/sessions'],
    forbidPages: ['/users', '/roles', '/settings', '/audit'],
  },
  {
    email: 'teacher@school.ac',
    label: 'Teacher',
    expectNav: ['Dashboard', 'Requisitions', 'Lab Schedule', 'Store & Inventory', 'Laboratories'],
    forbidNav: ['Users', 'Roles & Permissions', 'Settings', 'Audit Log', 'Session Logs'],
    pages: ['/dashboard', '/requisitions', '/schedule', '/inventory', '/labs', '/requisitions/new'],
    forbidPages: ['/users', '/roles', '/settings', '/audit', '/sessions'],
  },
]

const failures = []
const consoleErrors = []

function log(msg) {
  console.log(msg)
}

async function login(page, email) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  // Clear prior session by signing out if already in
  const emailInput = page.locator('input[type="email"], input#email, input[name="email"]').first()
  if ((await emailInput.count()) === 0) {
    // Maybe already logged in — try sign out
    const signOut = page.getByRole('button', { name: /sign out|log out/i })
    if (await signOut.count()) {
      await signOut.first().click()
      await page.waitForURL(/\/$|\/\?/, { timeout: 10000 }).catch(() => {})
      await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    }
  }
  await page.locator('input[type="email"], input#email').first().fill(email)
  await page.locator('input[type="password"], input#password').first().fill(PASS)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/(dashboard|requisitions|schedule|inventory|labs)/, { timeout: 15000 })
}

async function signOut(page) {
  const btn = page.getByRole('button', { name: /sign out|log out/i })
  if (await btn.count()) {
    await btn.first().click()
    await page.waitForTimeout(500)
  }
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message)
    log('PAGEERROR: ' + err.message)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore benign Next.js / hydration noise in headless
      if (/Download the React DevTools|favicon|hydration/i.test(text)) return
      consoleErrors.push(text)
      log('CONSOLE: ' + text)
    }
  })

  for (const acct of accounts) {
    log(`\n=== ${acct.label} (${acct.email}) ===`)
    try {
      await login(page, acct.email)
      log(`  logged in → ${page.url()}`)

      const navText = await page.locator('aside a, nav a').allTextContents().catch(() => [])
      const navJoined = navText.join(' | ')
      for (const label of acct.expectNav) {
        if (!navJoined.includes(label)) {
          failures.push(`${acct.label}: missing nav "${label}"`)
          log(`  FAIL missing nav: ${label}`)
        } else {
          log(`  OK nav: ${label}`)
        }
      }
      for (const label of acct.forbidNav) {
        if (navJoined.includes(label)) {
          failures.push(`${acct.label}: unexpected nav "${label}"`)
          log(`  FAIL unexpected nav: ${label}`)
        }
      }

      for (const path of acct.pages) {
        await page.goto(BASE + path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(400)
        const body = await page.locator('body').innerText()
        if (/Redirecting/i.test(body) && !body.includes('Good day') && !body.includes('Requisition') && path !== '/') {
          // Might still be redirecting
          await page.waitForTimeout(800)
        }
        const url = page.url()
        if (!url.includes(path.split('?')[0]) && acct.pages.includes(path)) {
          // Allow landing elsewhere only for forbid cases
          failures.push(`${acct.label}: could not open ${path} (landed ${url})`)
          log(`  FAIL page ${path} → ${url}`)
        } else {
          log(`  OK page ${path}`)
        }
        if (/Application error|Unhandled Runtime Error|Something went wrong/i.test(body)) {
          failures.push(`${acct.label}: runtime error on ${path}`)
          log(`  FAIL runtime error on ${path}`)
        }
      }

      for (const path of acct.forbidPages) {
        await page.goto(BASE + path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(700)
        const url = page.url()
        if (url.includes(path) && !url.includes('dashboard')) {
          // Check if still showing forbidden content
          const stillThere = url.replace(BASE, '').startsWith(path)
          if (stillThere) {
            failures.push(`${acct.label}: still on forbidden ${path}`)
            log(`  FAIL still on forbidden ${path}`)
          }
        } else {
          log(`  OK blocked ${path} → ${url}`)
        }
      }

      // Role-specific actions
      if (acct.label === 'Teacher') {
        await page.goto(BASE + '/requisitions/new', { waitUntil: 'networkidle' })
        await page.waitForTimeout(300)
        const topic = page.locator('#topic, input').filter({ hasText: '' }).first()
        // Fill topic via label
        const topicInput = page.getByLabel(/topic/i).first()
        if (await topicInput.count()) {
          await topicInput.fill('E2E Titration check')
          // Add one item quantity if catalogue visible
          const qty = page.locator('input[type="number"]').nth(1)
          if (await qty.count()) {
            await qty.fill('2')
          }
          const saveDraft = page.getByRole('button', { name: /save draft/i })
          if (await saveDraft.count()) {
            await saveDraft.click()
            await page.waitForTimeout(1000)
            log(`  OK teacher save draft → ${page.url()}`)
          }
        }
      }

      if (acct.label === 'Admin') {
        await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
        const school = page.getByLabel(/School|system name/i).first()
        if (await school.count()) {
          log('  OK settings form visible')
        } else {
          failures.push('Admin: settings form missing')
        }
        await page.goto(BASE + '/users', { waitUntil: 'networkidle' })
        log(`  OK users → ${page.url()}`)
        await page.goto(BASE + '/roles', { waitUntil: 'networkidle' })
        log(`  OK roles → ${page.url()}`)
      }

      if (acct.label === 'Attendant') {
        await page.goto(BASE + '/requisitions', { waitUntil: 'networkidle' })
        const link = page.locator('a[href^="/requisitions/"]').first()
        if (await link.count()) {
          await link.click()
          await page.waitForTimeout(600)
          log(`  OK open requisition → ${page.url()}`)
          const body = await page.locator('body').innerText()
          if (/Approve|Mark lab prepared|Start session|Log completion/i.test(body)) {
            log('  OK attendant actions visible (status-dependent)')
          }
        }
        await page.goto(BASE + '/inventory', { waitUntil: 'networkidle' })
        if (await page.getByRole('button', { name: /Add item/i }).count()) {
          log('  OK inventory Add item')
        } else {
          failures.push('Attendant: missing Add item')
        }
      }

      await signOut(page)
      log('  signed out')
    } catch (err) {
      failures.push(`${acct.label}: ${err.message}`)
      log(`  ERROR: ${err.message}`)
      await page.screenshot({ path: `e2e-${acct.label.toLowerCase()}-error.png`, fullPage: true }).catch(() => {})
      await signOut(page).catch(() => {})
    }
  }

  await browser.close()

  log('\n========== SUMMARY ==========')
  if (failures.length === 0 && consoleErrors.length === 0) {
    log('All smoke checks passed.')
    process.exit(0)
  }
  for (const f of failures) log('FAIL: ' + f)
  for (const e of consoleErrors) log('CONSOLE ERR: ' + e)
  process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
