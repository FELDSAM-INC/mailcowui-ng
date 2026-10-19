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
