// UI 008 smoke tests against the API dev stack (T030, T044, T052, T058, T065, T071; research R21).
// The API's DevelopmentSeeder (API 008 T066) gives alice@example.org the syncjobs flag with jobs #1
// (never run) and #2 (wrong username or password, with a log), carol@example.net job #3,
// dave@example.org no flag, and `reseller` the flag for example.org and example.net. Every job the
// suite creates is removed at the end, so the seeded data stays as it was.
import { expect, test, type Page } from '@playwright/test'

import { alice, SMOKE_DEFAULT_PASSWORD } from './fixtures/accounts'
import { signIn as apiSignIn } from './fixtures/domains-api'
import { expectHome, signIn } from './fixtures/flows'
import { freshTotp } from '../support/totp'

// Signing in as alice waits for a TOTP step that no earlier test used (fixtures/totp.ts), up to 30 s.
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const created = new Set<number>()
const SMOKE_HOST = 'imap.smoke.invalid'

async function signInAlice(page: Page) {
  await signIn(page, alice.username, alice.password)
  await page.getByLabel('Six-digit code').fill(await freshTotp(alice.totpSecret))
  await page.getByRole('button', { name: 'Login', exact: true }).first().click()
  await expectHome(page, alice.username)
}

async function listIds(page: Page): Promise<number[]> {
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(ready|empty)$/,
  )
  return page
    .locator('[data-entry]')
    .evaluateAll((items) => items.map((item) => Number(item.getAttribute('data-entry'))))
}

function remember(page: Page) {
  const match = /\/sync-jobs\/(\d+)$/.exec(page.url())
  if (match) created.add(Number(match[1]))
}

async function fillJob(page: Page, user: string) {
  await page.locator('#syncjob-create-remoteHost').fill(SMOKE_HOST)
  await page.locator('#syncjob-create-remoteUser').fill(user)
  await page.locator('#syncjob-create-remotePassword').fill('Smoke-Remote-Secret')
}

test.afterAll(async ({ browser }) => {
  if (created.size === 0) return
  const page = await browser.newPage()
  await apiSignIn(page, 'admin')
  const token = (
    (await (await page.request.get('/api/v2/csrf-token')).json()) as {
      data: { token: string }
    }
  ).data.token
  for (const id of created) {
    await page.request.delete(`/api/v2/sync-jobs/${id}`, { headers: { 'X-CSRF-Token': token } })
  }
  await page.close()
})

test('alice sees her jobs #1 and #2, not #3, and the log of #2 without a password', async ({
  page,
}) => {
  await signInAlice(page)
  await page.goto('sync-jobs')
  const ids = await listIds(page)
  expect(ids).toEqual(expect.arrayContaining([1, 2]))
  expect(ids).not.toContain(3)
  await expect(page.locator('[data-entry="2"] [data-result]')).toContainText(
    'Wrong username or password',
  )
  await page
    .locator('[data-entry="2"]')
    .getByRole('button', { name: /^Open logs/ })
    .click()
  const region = page.getByRole('dialog').getByRole('region')
  await expect(region).toBeVisible()
  expect(await region.textContent()).not.toContain(SMOKE_DEFAULT_PASSWORD)
})

test('dave has no sync jobs entry and sees "No access"', async ({ page }) => {
  await signIn(page, 'dave@example.org', SMOKE_DEFAULT_PASSWORD)
  await expectHome(page, 'dave@example.org')
  await expect(page.getByRole('link', { name: 'Sync jobs', exact: true })).toHaveCount(0)
  await page.goto('sync-jobs')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
})

test('reseller sees the jobs of its two domains', async ({ page }) => {
  await apiSignIn(page, 'reseller')
  await page.goto('sync-jobs')
  expect(await listIds(page)).toEqual(expect.arrayContaining([1, 2, 3]))
})

test('admin follows "Sync jobs" from alice\'s mailbox page to the filtered list', async ({
  page,
}) => {
  await apiSignIn(page, 'admin')
  await page.goto('mailboxes/alice@example.org')
  await page.getByRole('main').getByRole('link', { name: 'Sync jobs', exact: true }).click()
  await expect(page).toHaveURL(/sync-jobs\?mailbox=alice/)
  for (const id of await listIds(page)) {
    await expect(page.locator(`[data-entry="${id}"]`)).toContainText('alice@')
  }
})

test('alice creates a job, sees "already exists", edits, deactivates, activates and removes it', async ({
  page,
}) => {
  await signInAlice(page)
  await page.goto('sync-jobs/new')
  await fillJob(page, 'smoke.alice')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/\/sync-jobs\/\d+$/)
  remember(page)
  const id = Number(/(\d+)$/.exec(page.url())![1])
  await page.goto('sync-jobs/new')
  await fillJob(page, 'smoke.alice')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(`Object ${SMOKE_HOST} / smoke.alice already exists`)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the existing job' })).toHaveAttribute(
    'href',
    `/ng/sync-jobs/${id}`,
  )

  await page.goto(`sync-jobs/${id}?edit=syncjob`)
  await page.getByLabel('Interval (min)').fill('45')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).not.toHaveURL(/edit=/)
  await page.reload()
  await expect(page.locator('[data-section-values]')).toContainText('45')

  await page.goto(`sync-jobs?q=smoke.alice`)
  await listIds(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const label = `smoke.alice@${SMOKE_HOST}:993`
  const bar = page.getByRole('region', { name: 'Bulk actions' })
  await page.getByRole('checkbox', { name: `Select ${label}` }).check()
  await bar.getByRole('button', { name: 'Deactivate' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
  await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')
  await page.getByRole('checkbox', { name: `Select ${label}` }).check()
  await bar.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(page.locator(`[data-entry="${id}"] [data-active]`)).toContainText('✓')

  await page.getByRole('button', { name: 'Done selecting' }).click()
  await page
    .locator(`[data-entry="${id}"]`)
    .getByRole('button', { name: /^Actions for / })
    .click()
  await page.getByRole('menuitem', { name: 'Remove' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
  await expect(page.getByText(`Deleted syncjob ID ${id}`).first()).toBeVisible()
  created.delete(id)
})

test('admin creates two jobs for alice, acts on both at once and removes them with the count', async ({
  page,
}) => {
  await apiSignIn(page, 'admin')
  for (const user of ['smoke.admin.1', 'smoke.admin.2']) {
    await page.goto('sync-jobs/new')
    await page.locator('#syncjob-create-mailbox').fill('alice')
    await page.getByRole('option', { name: /alice@example\.org/ }).click()
    await fillJob(page, user)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/\/sync-jobs\/\d+$/)
    remember(page)
  }
  await page.goto('sync-jobs?q=smoke.admin')
  await listIds(page)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const bar = page.getByRole('region', { name: 'Bulk actions' })
  const selectBoth = async () => {
    for (const user of ['smoke.admin.1', 'smoke.admin.2']) {
      await page.getByRole('checkbox', { name: `Select ${user}@${SMOKE_HOST}:993` }).check()
    }
  }
  await selectBoth()
  await bar.getByRole('button', { name: 'Deactivate' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
  await expect(page.getByRole('region', { name: 'Results' })).toContainText('2 done')
  await selectBoth()
  await bar.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Results' })).toContainText('2 done')
  await selectBoth()
  await bar.getByRole('button', { name: 'Remove' }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByLabel('Type 2 to confirm').fill('2')
  await dialog.getByRole('button', { name: 'Delete now' }).click()
  await expect(page.getByRole('region', { name: 'Results' })).toContainText('2 done')
  created.clear()
})
