import { openBulkActions } from '../fixtures/flows'
// UI 012 US5, the classic quick actions of selected OAuth2 clients (T080): "Remove", "Revoke all
// client tokens" and "Generate new client secret" in an explicit selection mode, through the API's
// bulk operation with each client's version tag; a row per client; failed, refused and outdated
// clients stay selected for a retry; new secrets are shown once, one client after another.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { scenarioClient } from '../../mocks/scenarios/oauth2-clients'
import { fixedClientId, listReady, stubClipboard } from './helpers'

const bar = (page: Page) => page.getByRole('region', { name: 'Bulk actions' })
const results = (page: Page) => page.getByRole('region', { name: 'Results' })

async function select(page: Page, ids: number[]) {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  for (const id of ids) {
    await page.getByRole('checkbox', { name: `Select ${fixedClientId(id)}` }).check()
  }
}

const bulkRequests = async (mockApi: {
  requests: () => Promise<{ operationId: string | null; body?: unknown }[]>
}) => (await mockApi.requests()).filter((r) => r.operationId === 'bulkOauth2ClientAction')

test.describe('OAuth2 client quick actions', () => {
  test('US5-AS9 FR-065 removing three: the count typed, one request with each version, outdated stays selected and retries', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-bulk-partial')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await select(page, [1, 2, 3])
    await expect(bar(page)).toContainText('3 selected')
    await mockApi.patch({
      oauth2Clients: [
        scenarioClient(1, { activeAccessTokens: 2 }),
        scenarioClient(2, { redirectUris: ['https://changed.example.org/cb'], version: 2 }),
        scenarioClient(3, { activeRefreshTokens: 1 }),
      ],
    })
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Confirm deletion')
    await expect(dialog).toContainText('Please confirm your changes to the following object id')
    for (const id of [1, 2, 3]) await expect(dialog).toContainText(fixedClientId(id))
    const confirm = dialog.getByRole('button', { name: 'Delete now' })
    await expect(confirm).toBeDisabled()
    await expectAccessible()
    await dialog.getByRole('textbox').fill('3')
    await confirm.click()
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(2)
    await expect(results(page).locator('li', { hasText: 'Changed in the meantime' })).toContainText(
      fixedClientId(2),
    )
    await expect(bar(page)).toContainText('1 selected')
    const [first] = await bulkRequests(mockApi)
    expect(first?.body).toMatchObject({ action: 'delete' })
    const targets = (first!.body as { targets: { id: string; version: string }[] }).targets
    expect(targets.map((target) => target.id)).toEqual(['1', '2', '3'])
    expect(targets.every((target) => /^"o/.test(target.version))).toBe(true)

    await results(page).getByRole('button', { name: 'Retry the failed ones' }).click()
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(1)
    const sent = await bulkRequests(mockApi)
    expect(sent).toHaveLength(2)
    const retried = (sent[1]!.body as { targets: { id: string; version: string }[] }).targets
    expect(retried.map((target) => target.id)).toEqual(['2'])
    expect(retried[0]!.version).not.toBe(targets[1]!.version)
  })

  test('FR-065 revoking the tokens of selected clients after one confirmation', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-bulk-partial')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await select(page, [1, 3])
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Revoke all client tokens' })
      .click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Revoke all client tokens' })).toBeVisible()
    await expect(dialog).toContainText(fixedClientId(1))
    await expect(dialog).toContainText(fixedClientId(3))
    await expect(dialog.getByRole('textbox')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Revoke all client tokens' }).click()
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(2)
    const [request] = await bulkRequests(mockApi)
    expect(request?.body).toMatchObject({ action: 'revokeTokens' })
  })

  test('G42 generating new secrets shows each new secret once, one client after another', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('oauth2-bulk-partial')
    await stubClipboard(page)
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await select(page, [1, 2])
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Generate new client secret' })
      .click()
    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText(fixedClientId(2))
    await confirmation.getByRole('button', { name: 'Generate new client secret' }).click()

    const dialog = page.getByRole('dialog', { name: 'Generate new client secret' })
    await expect(dialog).toContainText(`Client ID: ${fixedClientId(1)}`)
    const first = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
    expect(first).toMatch(/^[0-9a-f]{24}$/)
    await expectAccessible()
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toContainText(`Client ID: ${fixedClientId(2)}`)
    const second = await dialog.getByRole('textbox', { name: 'Secret' }).inputValue()
    expect(second).toMatch(/^[0-9a-f]{24}$/)
    expect(second).not.toBe(first)
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(results(page).locator('li', { hasText: 'Done' })).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(first)
    await expect(page.locator('body')).not.toContainText(second)
  })

  test('the selection clears when the search, sort or page size changes', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-bulk-twenty')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await select(page, [1, 2])
    await expect(bar(page)).toContainText('2 selected')
    await page.getByRole('searchbox', { name: 'Search:' }).fill('a1b2c3')
    await expect(page).toHaveURL(/q=a1b2c3/)
    await expect(bar(page)).toContainText('0 selected')
    await page.getByRole('checkbox', { name: `Select ${fixedClientId(3)}` }).check()
    await page.getByLabel('Order').selectOption('desc')
    await expect(bar(page)).toContainText('0 selected')
    await page.getByRole('checkbox', { name: `Select ${fixedClientId(3)}` }).check()
    await page.locator('[data-page-size] select').selectOption('50')
    await expect(bar(page)).toContainText('0 selected')
  })

  test('FR-065 at the bulk limit further selection is refused with the limit stated', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-bulk-partial', { oauth2Capabilities: { bulkLimit: 2 } })
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await select(page, [1, 2])
    await expect(page.getByRole('checkbox', { name: `Select ${fixedClientId(3)}` })).toBeDisabled()
    await expect(bar(page)).toContainText('You can select at most 2 items for one action.')
  })

  test('SC-013 removing 20 clients gives 20 outcomes; only the failed one stays selected', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-bulk-twenty')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select all on this page' }).first().check()
    await expect(bar(page)).toContainText('20 selected')
    await (await openBulkActions(page)).getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('textbox').fill('20')
    await dialog.getByRole('button', { name: 'Delete now' }).click()
    await expect(results(page).locator('li')).toHaveCount(20)
    await expect(results(page).locator('li', { hasText: 'Failed' })).toContainText(fixedClientId(7))
    await expect(bar(page)).toContainText('1 selected')
  })

  test('a dropped connection reports "outcome unknown" and sends nothing again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('oauth2-bulk-partial')
    await page.goto('identity-providers/oauth2-apps')
    await listReady(page)
    await select(page, [1, 2])
    await page.route('**/api/v2/oauth2-clients/bulk-actions', (route) => route.abort())
    await (
      await openBulkActions(page)
    )
      .getByRole('button', { name: 'Revoke all client tokens' })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Revoke all client tokens' })
      .click()
    await expect(results(page).locator('li', { hasText: 'Outcome unknown' })).toHaveCount(2)
    await expect(results(page).getByRole('button', { name: 'Retry the failed ones' })).toHaveCount(
      0,
    )
    expect(await bulkRequests(mockApi)).toEqual([])
  })
})
