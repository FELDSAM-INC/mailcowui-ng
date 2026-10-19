// UI 009 US2 smoke test (T045, research R25; legacy form map decision 12): as admin, a relayhost is
// chosen in example.org's Domain section and in alice@example.org's Mailbox section, saved with the
// section, cleared again, and the relayhost deleted; as reseller, the relayhost field follows the
// identity's flags.
import { expect, test, type Page } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries } from './fixtures/routing-api'

const field = (page: Page) => page.getByRole('combobox', { name: 'Sender-dependent transports' })
const polite = '[data-live="polite"]'

async function choose(page: Page, option: RegExp | string) {
  await field(page).click()
  await field(page).fill(typeof option === 'string' ? option : '')
  await page.getByRole('option', { name: option }).first().click()
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
}

test.describe('@routing assignments', () => {
  test('admin assigns a relayhost to a domain and a mailbox and clears it again', async ({
    page,
  }) => {
    const host = `[${uniqueName('assign')}.smoke.example]:587`
    await signIn(page, 'admin')
    const created = await page.request.post('/api/v2/relayhosts', {
      headers: {
        'X-CSRF-Token': (
          (await (await page.request.get('/api/v2/csrf-token')).json()) as {
            data: { token: string }
          }
        ).data.token,
      },
      data: { host },
    })
    expect(created.status()).toBe(201)
    try {
      await page.goto('domains/example.org?edit=domain')
      await choose(page, new RegExp(host.replace(/[[\]]/g, '\\$&')))
      await save(page)
      await expect(page.locator(polite)).toContainText('example.org')
      const domain = await page.request.get('/api/v2/domains/example.org/relayhost-assignment')
      expect(
        ((await domain.json()) as { data: { relayhost: { host: string } } }).data.relayhost.host,
      ).toBe(host)

      await page.goto('mailboxes/alice@example.org?edit=mailbox')
      await choose(page, new RegExp(host.replace(/[[\]]/g, '\\$&')))
      await save(page)
      await expect(page.locator(polite)).toContainText('alice@example.org')

      for (const path of [
        'mailboxes/alice@example.org?edit=mailbox',
        'domains/example.org?edit=domain',
      ]) {
        await page.goto(path)
        await choose(page, 'None / Inherit')
        await save(page)
        await expect(page.locator(polite)).not.toBeEmpty()
      }
    } finally {
      await deleteEntries(page, 'relayhosts', 'host', host)
    }
  })

  test('reseller sees the relayhost field only with its flags', async ({ page }) => {
    await signIn(page, 'reseller')
    const identity = await page.request.get('/api/v2/me')
    const permissions = (
      (await identity.json()) as { data: { permissions: Record<string, boolean> } }
    ).data.permissions
    await page.goto('domains/example.org?edit=domain')
    await expect(page.getByRole('heading', { level: 2, name: 'Edit domain' })).toBeVisible()
    await expect(field(page)).toHaveCount(permissions.domainRelayhost ? 1 : 0)
  })
})
