// UI 011 smoke tests against the API dev stack with its outbound fakes (`RESTV2_FAKE_OUTBOUND=y`,
// research R21; T053, T065). The fake container service reports the recorded containers of API 011
// (SOGo stopped) and the recorded host figures (8 cores); a restart is reported as done and changes
// nothing. Dashboard cases are read-only.
import { expect, test, type Page } from '@playwright/test'

import { signIn } from './fixtures/domains-api'

async function openDashboard(page: Page) {
  await signIn(page, 'admin')
  await page.goto('operations/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  await expect(page.locator('[data-hostname]')).toBeVisible()
}

test.describe('@operations dashboard', () => {
  test('@read-only the dashboard shows the host figures and every container', async ({ page }) => {
    await openDashboard(page)
    await expect(page.locator('[data-cpu]')).toContainText('8 Cores @')
    await expect(page.locator('[data-architecture]')).toHaveText('x86_64')
    await expect(page.locator('[data-containers] li')).not.toHaveCount(0)
    await expect(page.locator('[data-container="sogo-mailcow"] [data-state="stopped"]')).toHaveText(
      'Stopped',
    )
    await expect(
      page.locator('[data-container="postfix-mailcow"] [data-state="running"]'),
    ).toHaveText('Running')
  })

  test('@read-only at 360 × 780 nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await openDashboard(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('restarting SOGo through the fake container service says OK; the database offers no Stop', async ({
    page,
  }) => {
    await openDashboard(page)
    const sogo = page.locator('[data-container="sogo-mailcow"]')
    await sogo.locator('[data-expand]').click()
    await sogo.getByRole('button', { name: 'Restart', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restart now' }).click()
    await expect(sogo.locator('[data-action-outcome]')).toContainText('OK', { timeout: 30_000 })
    const mysql = page.locator('[data-container="mysql-mailcow"]')
    await mysql.locator('[data-expand]').click()
    await expect(mysql.locator('[data-action]')).toHaveText(['Restart'])
  })
})

// T077: `scripts/smoke/stack-up.sh` pushes the Postfix line of the API 011 quickstart (Part B) into
// the dev stack's Redis: "to=<alice@example.org> bounced" with the priority "err".
test.describe('@operations logs', () => {
  test('@read-only a Postfix line pushed into Redis is found by a case-insensitive search', async ({
    page,
  }) => {
    await signIn(page, 'admin')
    await page.goto('operations/logs/postfix?q=ALICE%40example.org')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const entry = page.locator('[data-entry]').filter({ hasText: 'to=<alice@example.org> bounced' })
    await expect(entry.first()).toBeVisible()
    await expect(entry.first()).toContainText('err')
  })
})

// T092: the fake container service answers `postqueue -j` with the recorded queue of API 011
// (`tests/fixtures/monitoring/postqueue-j.txt`): 8 messages, 3 of them deferred to partner.example.
test.describe('@operations mail queue', () => {
  test('@read-only the mail queue lists the recorded queue and finds the deferred messages', async ({
    page,
  }) => {
    await signIn(page, 'admin')
    await page.goto('operations/mail-queue')
    await expect(page.getByRole('heading', { level: 1, name: 'Queue Manager' })).toBeVisible()
    await expect(page.locator('[data-queue-total]')).toHaveText('8')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('partner.example')
    await expect(page.locator('[data-entry]')).toHaveCount(3)
  })
})

// T107: the ban time in seconds (plan decision 1), saved with the version tag, read back after a
// reload, and restored.
test.describe('@operations fail2ban', () => {
  async function setBanTime(page: Page, seconds: string) {
    await page.getByRole('button', { name: 'Edit Fail2ban parameters' }).click()
    await page.getByLabel('Ban time (s)', { exact: true }).fill(seconds)
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v2/fail2ban/settings') &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save changes' }).click()
    const response = await saved
    expect(response.status()).toBe(200)
    expect(response.request().headers()['if-match']).toBeTruthy()
  }

  test('changing the ban time to 7200 s is kept after a reload and restored', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('operations/fail2ban')
    const banTime = page.locator('[data-value="banTime"]')
    await expect(banTime).toBeVisible({ timeout: 15_000 })
    const original = (await banTime.innerText()).replace(/\D/g, '')
    await setBanTime(page, '7200')
    await page.reload()
    await expect(banTime).toHaveText('7,200')
    await setBanTime(page, original)
    await page.reload()
    await expect(banTime).not.toHaveText('7,200')
  })
})
