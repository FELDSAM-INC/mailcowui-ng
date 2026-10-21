import { clickRowAction } from '../fixtures/row-actions'
// UI 009 T114: relayhost and transport passwords stay secret (SC-003, FR-025, FR-028, FR-075). No
// seeded or typed password appears in the page, in browser storage or in the history state; a
// typed password travels only in the body of its own write; password fields are empty after a
// save, a refusal and a return; and no form draft of these pages is kept.
import type { Page, Request } from '@playwright/test'

import type { RecordedRequest } from '../../mocks/scenarios'
import { RELAYHOST_PASSWORDS } from '../../mocks/scenarios/routing/relayhosts'
import { TRANSPORT_PASSWORD } from '../../mocks/scenarios/routing/transports'
import { expect, test } from '../fixtures/test'
import { entry, listReady } from './helpers'

const SEEDED = [...RELAYHOST_PASSWORDS, TRANSPORT_PASSWORD]
const TYPED = ['Typed-Relay-Secret-7', 'Typed-Transport-Secret-8', 'Typed-Refused-Secret-9']
const WRITES = /\/api\/v2\/(relayhosts|transports)(\/\d+)?$/

/** Every API request the page sends, with its real body (the mock's record redacts passwords). */
function recordRequests(page: Page): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v2/')) requests.push(request)
  })
  return requests
}

async function expectNoSecretsInPage(page: Page, secrets: readonly string[]) {
  const snapshot = await page.evaluate(() => ({
    html: document.documentElement.outerHTML,
    values: [...document.querySelectorAll('input, textarea')].map(
      (element) => (element as HTMLInputElement).value,
    ),
    local: JSON.stringify(Object.entries(localStorage)),
    session: JSON.stringify(Object.entries(sessionStorage)),
    history: JSON.stringify(history.state ?? null),
  }))
  const everything = JSON.stringify(snapshot)
  for (const secret of secrets) expect(everything, secret).not.toContain(secret)
}

/**
 * Each typed secret travels only in the body of its own write (`POST` or `PATCH` of a relayhost or
 * transport), `writes` times, and never in an address or a header. Chromium does not expose the
 * body of the client's requests (a `fetch` of a `Request`), so where the browser gives no body the
 * mock's record proves which operations carried a password (it records the member as
 * `[redacted]`).
 */
async function expectOnlyInWrites(
  requests: Request[],
  recorded: RecordedRequest[],
  expected: Record<string, number>,
  passwordWrites: string[],
) {
  const bodies = requests.filter((request) => ['POST', 'PATCH'].includes(request.method()))
  const exposed = bodies.length > 0 && bodies.every((request) => request.postData() !== null)
  for (const [secret, writes] of Object.entries(expected)) {
    let carried = 0
    for (const request of requests) {
      const headers = JSON.stringify(await request.allHeaders())
      expect(request.url(), secret).not.toContain(secret)
      expect(headers, secret).not.toContain(secret)
      if (request.postData()?.includes(secret)) {
        expect(['POST', 'PATCH']).toContain(request.method())
        expect(request.url()).toMatch(WRITES)
        carried += 1
      }
    }
    if (exposed) expect(carried, secret).toBe(writes)
  }
  const withPassword = recorded.filter((request) =>
    JSON.stringify(request.body ?? null).includes('"password":"[redacted]"'),
  )
  expect(withPassword.map((request) => request.operationId)).toEqual(passwordWrites)
}

test.describe('credential secrecy', () => {
  test('SC-003 FR-025 lists, entry pages, deletion dialogs, choices and test pages show no seeded password', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-admin-default')
    for (const path of [
      'routing/relayhosts',
      'routing/relayhosts/1',
      'routing/relayhosts/1/usage',
      'routing/transports',
      'routing/transports/1',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      if (await page.locator('[data-list-state]').count()) await listReady(page)
      await expect(page.locator('[data-list-loading], [aria-busy="true"]')).toHaveCount(0)
      await expectNoSecretsInPage(page, SEEDED)
    }
    await page.goto('routing/relayhosts')
    await listReady(page)
    await clickRowAction(page, entry(page, 1), /^Remove: /)
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expectNoSecretsInPage(page, SEEDED)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

    await mockApi.use('routing-tests')
    await page.goto('routing/relayhosts/1/test')
    await page.getByRole('button', { name: 'Run test' }).click()
    await expect(page.getByRole('region', { name: 'Test result' })).toBeVisible()
    await expectNoSecretsInPage(page, SEEDED)

    await mockApi.use('routing-assignments')
    await page.goto('domains/example.org?edit=domain')
    await page.getByRole('combobox', { name: 'Sender-dependent transports' }).click()
    await expect(page.getByRole('option').first()).toBeVisible()
    await expectNoSecretsInPage(page, SEEDED)
    await page.goto('mailboxes/alice@example.org?edit=mailbox')
    await expect(page.locator('[data-relayhost-field]')).toBeVisible()
    await expectNoSecretsInPage(page, SEEDED)
  })

  test('FR-028 a typed password travels only in its write and is cleared after save, refusal and return', async ({
    page,
    mockApi,
  }) => {
    const requests = recordRequests(page)
    await mockApi.use('routing-admin-default')

    // A relayhost password changed and saved: the list opens, and the entry page shows it empty.
    await page.goto('routing/relayhosts/2')
    await page.getByLabel('Username').fill('relay-user')
    await page.getByLabel('Password').fill(TYPED[0]!)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/routing\/relayhosts$/)
    await expectNoSecretsInPage(page, [...SEEDED, ...TYPED])
    await page.goto('routing/relayhosts/2')
    await expect(page.getByLabel('Password')).toHaveValue('')

    // A refused save clears the typed password and keeps the other values.
    await page.getByLabel('Username').fill('refused-user')
    await page.getByLabel('Password').fill(TYPED[2]!)
    await mockApi.failNext('updateRelayhost', { status: 500 })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText(/Request ID/)).toBeVisible()
    await expect(page.getByLabel('Password')).toHaveValue('')
    await expect(page.getByLabel('Username')).toHaveValue('refused-user')
    await expectNoSecretsInPage(page, [...SEEDED, ...TYPED])

    // A transport added with credentials.
    await page.goto('routing/transports/new')
    await page.getByLabel('Destination', { exact: true }).fill('secret.example')
    await page.getByLabel('Next hop', { exact: true }).fill('[relay.secret.example]:587')
    await page.getByLabel('Username').fill('transport-user')
    await page.getByLabel('Password').fill(TYPED[1]!)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page).toHaveURL(/routing\/transports$/)
    await expectNoSecretsInPage(page, [...SEEDED, ...TYPED])

    await expectOnlyInWrites(
      requests,
      await mockApi.requests(),
      {
        [TYPED[0]!]: 1,
        [TYPED[1]!]: 1,
        [TYPED[2]!]: 1,
        ...Object.fromEntries(SEEDED.map((secret) => [secret, 0])),
      },
      ['updateRelayhost', 'updateRelayhost', 'createTransport'],
    )
  })

  test('FR-075 a form left with a typed password keeps no draft', async ({ page, mockApi }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing/relayhosts/new')
    await page.getByLabel('Host').fill('[draft.example]:587')
    await page.getByLabel('Username').fill('draft-user')
    await page.getByLabel('Password').fill(TYPED[0]!)
    await page.goto('routing/transports')
    const leave = page.getByRole('alertdialog')
    if (await leave.isVisible()) await leave.getByRole('button', { name: /Leave/ }).click()
    await listReady(page)
    await expectNoSecretsInPage(page, [...SEEDED, ...TYPED])
    await page.goto('routing/relayhosts/new')
    await expect(page.getByLabel('Host')).toHaveValue('')
    await expect(page.getByLabel('Username')).toHaveValue('')
    await expect(page.getByLabel('Password')).toHaveValue('')
    await page.goBack()
    await expect(page).toHaveURL(/routing\/transports$/)
    await listReady(page)
    await expectNoSecretsInPage(page, [...SEEDED, ...TYPED])
  })
})
