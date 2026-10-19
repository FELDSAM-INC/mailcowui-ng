// UI 009 US4 smoke test (T072, research R25): as admin, a relayhost to the API stack's mailpit
// (`routing` compose profile, SMOKE_COMPOSE_PROFILES=routing) is created with credentials and
// tested; the test is accepted, the transcript shows the login as `[redacted]` and never the
// password, and the relayhost is deleted.
import { expect, test } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries, findEntries, smokePassword } from './fixtures/routing-api'

const HOST = '[mailpit]:1025'

test.describe('@routing connection test', () => {
  test('admin tests a relayhost with credentials against mailpit and reads "Accepted"', async ({
    page,
  }) => {
    const username = `${uniqueName('relay')}@smoke.example`
    const password = smokePassword()
    await signIn(page, 'admin')
    try {
      await page.goto('routing/relayhosts/new')
      await page.getByLabel('Host').fill(HOST)
      await page.getByLabel('Username').fill(username)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(HOST)
      const created = (await findEntries(page, 'relayhosts', 'host', HOST)).find(
        (item) => item.username === username,
      )
      expect(created).toBeTruthy()

      await page.goto(`routing/relayhosts/${created!.id}/test`)
      await expect(page.getByRole('heading', { level: 1, name: 'Transport' })).toBeVisible()
      await page.getByRole('button', { name: 'Run test' }).click()
      const summary = page.getByRole('region', { name: 'Test result' })
      await expect(summary.getByRole('heading', { name: 'Accepted' })).toBeVisible({
        timeout: 75_000,
      })
      await expect(summary).toContainText('Reached: Message')
      await expect(summary).toContainText('Succeeded')
      const transcript = page.locator('[data-transcript]')
      await expect(transcript).toContainText('[redacted]')
      expect(await page.content()).not.toContain(password)
    } finally {
      await deleteEntries(page, 'relayhosts', 'username', username)
    }
  })
})
