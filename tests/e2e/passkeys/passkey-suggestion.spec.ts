// T103: the home screen's passkey suggestion (FR-047, FR-051), and the identity refresh after a
// `forbidden` answer (US3-AS7, FR-045), tested with the suggestion's passkey read.
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { permissionFlags } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'
import { isNarrow, openNavigation } from '../fixtures/flows'

const suggestion = (page: Page) =>
  page.getByRole('region', { name: 'Sign in faster with a passkey' })

test('FR-047 FR-051 the suggestion appears without passkeys on a capable device and leads to Passkeys', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('')
  await expect(suggestion(page)).toBeVisible()
  await expectAccessible()
  await suggestion(page).getByRole('link', { name: 'Add a passkey' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
})

test('FR-047 the suggestion is absent with a passkey or without passkey support', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('user-with-passkeys')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your scope' })).toBeVisible()
  await expect(suggestion(page)).toHaveCount(0)
})

test('FR-047 the suggestion is absent on a device without passkey support', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.withoutPasskeySupport()
  await page.goto('')
  await expect(page.getByRole('region', { name: 'Your scope' })).toBeVisible()
  await expect(suggestion(page)).toHaveCount(0)
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).not.toContain('listPasskeys')
})

test('FR-047 dismissing the suggestion is remembered on this device', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('')
  await suggestion(page).getByRole('button', { name: 'Not now' }).click()
  await expect(suggestion(page)).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem('mailcowui-ng.passkey-suggestion-dismissed')),
  ).toBe('1')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Your scope' })).toBeVisible()
  await expect(suggestion(page)).toHaveCount(0)
})

test('FR-051 Passkeys is reachable from the user menu', async ({ page, mockApi }) => {
  await mockApi.use('admin-active')
  await page.goto('')
  await page.getByRole('button', { name: 'Account menu of admin' }).click()
  await page.getByRole('menuitem', { name: 'Passkeys' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
})

test('US3-AS7 FR-045 a forbidden answer refreshes the identity, so the navigation shows changed flags', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('flags-change')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('passkeys')
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
  await mockApi.patch({
    accounts: {
      reseller: { permissions: permissionFlags(true, { bccMaps: false, loginAs: false }) },
    },
    failures: { listPasskeys: { status: 403, type: 'forbidden', times: 1 } },
  })
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, reseller' })).toBeVisible()
  await expect
    .poll(async () => (await mockApi.requests()).map((r) => `${r.operationId} ${r.status}`))
    .toEqual(expect.arrayContaining(['listPasskeys 403', 'getIdentity 200']))
  const after = await openNavigation(page)
  await expect(after.getByRole('link', { name: 'Sync jobs' })).toBeVisible()
  if (isNarrow(page)) await page.keyboard.press('Escape')
})
