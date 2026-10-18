// T102: own passkeys (US4-AS1–AS10, FR-051–FR-057 and the edge cases of changes elsewhere and
// long names).
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { alicePasskeys, PASSKEY_IDS } from '../../mocks/scenarios/passkeys'
import { expect, test } from '../fixtures/test'
import { assertiveRegion, politeRegion, signOutFromMenu } from '../fixtures/flows'

const cards = (page: Page) => page.getByRole('main').getByRole('listitem')
const addButton = (page: Page) => page.getByRole('button', { name: 'Add a passkey' })

test('US4-AS1 FR-051 without passkeys the page explains passkeys and offers to add one', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('passkeys')
  await expect(page.getByRole('heading', { level: 1, name: 'Passkeys' })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('You have no passkeys yet.')
  await expect(addButton(page)).toBeEnabled()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US4-AS2 FR-053 @virtual-authenticator adding a passkey with a name lists it and announces it', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.withoutConditionalMediation()
  await webauthn.virtualAuthenticator()
  await page.goto('passkeys')
  await page.getByLabel('Name (optional)').fill('Work laptop')
  await addButton(page).click()
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Work laptop')
  await expect(cards(page).first().locator('time')).toBeVisible()
  await expect(politeRegion(page)).toContainText('Passkey added.')
})

test('US4-AS2 FR-053 adding a passkey without a name works with any device answer', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentials('bmV3LXBhc3NrZXktY3JlZGVudGlhbA')
  await page.goto('passkeys')
  await addButton(page).click()
  await expect(cards(page)).toHaveCount(1)
  const [registration] = (await mockApi.requests()).filter(
    (r) => r.operationId === 'registerPasskey',
  )
  expect(registration?.body).not.toHaveProperty('name')
})

test('US4-AS3 @virtual-authenticator a new passkey signs in after sign-out', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.withoutConditionalMediation()
  await webauthn.virtualAuthenticator()
  await page.goto('passkeys')
  await addButton(page).click()
  await expect(cards(page)).toHaveCount(1)
  await signOutFromMenu(page)
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
})

test('US4-AS4 FR-054 renaming refuses an empty or over-long name on the field and then saves', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('user-with-passkeys')
  await page.goto('passkeys')
  const phone = cards(page).filter({ hasText: 'Phone' })
  await phone.getByRole('button', { name: 'Rename' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rename passkey' })
  const field = dialog.getByLabel('Name')
  await expect(field).toHaveValue('Phone')
  await field.fill('   ')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('This field is required.')).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await field.fill('x'.repeat(256))
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Enter at most 255 characters.')).toBeVisible()
  await expectAccessible()
  expect((await mockApi.requests()).map((r) => r.operationId)).not.toContain('updatePasskey')
  await field.fill('Work phone')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(cards(page).filter({ hasText: 'Work phone' })).toHaveCount(1)
  await expect(politeRegion(page)).toContainText('Passkey renamed.')
})

test('US4-AS5 FR-055 removal names the passkey and its consequence, including the last-passkey wording', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('anonymous-default', {
    signedInAs: 'alice@example.org',
    accounts: { 'alice@example.org': { passkeys: alicePasskeys().slice(0, 2) } },
  })
  await page.goto('passkeys')
  await cards(page).filter({ hasText: 'Phone' }).getByRole('button', { name: 'Remove' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Remove the passkey “Phone”?')
  await expect(confirm).toContainText(
    'It will no longer sign you in, here or in the classic interface.',
  )
  await expect(confirm).not.toContainText('password remains')
  await expectAccessible()
  await confirm.getByRole('button', { name: 'Remove' }).click()
  await expect(cards(page)).toHaveCount(1)
  await expect(politeRegion(page)).toContainText('Passkey removed.')

  await cards(page).first().getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('alertdialog')).toContainText(
    'This is your last passkey. Your password remains the way to sign in.',
  )
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('main')).toContainText('You have no passkeys yet.')
})

test('US4-AS6 US4-AS7 FR-052 the list notes another host and inactive passkeys, newest first with name fallbacks', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('user-with-passkeys')
  await page.goto('passkeys')
  await expect(cards(page)).toHaveCount(4)
  await expect(cards(page).getByRole('heading', { level: 2 })).toHaveText([
    /^Unknown passkey/,
    'Lost key',
    'Old laptop',
    'Phone',
  ])
  await expect(cards(page).nth(2)).toContainText('Works only on mail.example.net')
  await expect(cards(page).nth(1)).toContainText('Inactive: it cannot be used to sign in')
  await expect(cards(page).nth(3)).toContainText('iCloud Keychain')
  const requests = (await mockApi.requests()).filter((r) => r.operationId === 'listPasskeys')
  expect(requests.at(-1)?.path).toContain('sort=registeredAt')
  expect(requests.at(-1)?.path).toContain('order=desc')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US4-AS8 FR-053 a cancelled prompt registers nothing and shows no error', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentialsRejection('NotAllowedError')
  await page.goto('passkeys')
  await addButton(page).click()
  await expect(addButton(page)).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await mockApi.requests()).map((r) => r.operationId)).not.toContain('registerPasskey')
})

test('US4-AS9 a rejected registration and an already registered device each get a message and a retry', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('passkey-registration-rejected')
  await webauthn.stubCredentials('cmVqZWN0ZWQtY3JlZGVudGlhbA')
  await page.goto('passkeys')
  await addButton(page).click()
  await expect(page.getByRole('alert')).toContainText(
    'The passkey could not be registered. Please try again.',
  )
  await expect(assertiveRegion(page)).toContainText('could not be registered')
  await expect(addButton(page)).toBeEnabled()
  await expectAccessible()
})

test('US4-AS9 an authenticator that already holds a passkey gets its own message', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('admin-no-passkeys')
  await webauthn.stubCredentialsRejection('InvalidStateError')
  await page.goto('passkeys')
  await addButton(page).click()
  await expect(page.getByRole('alert')).toContainText(
    'This device already has a passkey for your account.',
  )
  await expect(addButton(page)).toBeEnabled()
})

test('US4-AS10 FR-056 without support adding is unavailable with an explanation, renaming and removing work', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('user-with-passkeys')
  await webauthn.withoutPasskeySupport()
  await page.goto('passkeys')
  await expect(addButton(page)).toHaveCount(0)
  await expect(page.getByRole('main')).toContainText('This device cannot create passkeys.')
  await expect(cards(page).first().getByRole('button', { name: 'Rename' })).toBeVisible()
  await expect(cards(page).first().getByRole('button', { name: 'Remove' })).toBeVisible()
  await expectAccessible()
})

test('FR-057 the page shows only the signed-in account’s passkeys', async ({ page, mockApi }) => {
  await mockApi.use('user-with-passkeys', {
    accounts: {
      admin: {
        passkeys: alicePasskeys().map((p, i) => ({
          ...p,
          id: String(i + 5).repeat(64),
          name: `Admin ${i}`,
        })),
      },
    },
  })
  await page.goto('passkeys')
  await expect(cards(page)).toHaveCount(4)
  await expect(page.getByRole('main')).not.toContainText('Admin 0')
})

test('Edge: a rename changed elsewhere keeps the input, reloads and saves on retry', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('passkey-changed-elsewhere')
  await page.goto('passkeys')
  await cards(page).filter({ hasText: 'Phone' }).getByRole('button', { name: 'Rename' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rename passkey' })
  await dialog.getByLabel('Name').fill('My phone')
  const changed = alicePasskeys().map((p) =>
    p.id === PASSKEY_IDS.phone
      ? { ...p, name: 'Phone (renamed elsewhere)', etag: '"pk-phone-2"' }
      : p,
  )
  await mockApi.patch({ accounts: { 'alice@example.org': { passkeys: changed } } })
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toContainText('changed elsewhere')
  await expect(dialog.getByLabel('Name')).toHaveValue('My phone')
  // The open dialog hides the page from the accessibility tree, so the list is read from the DOM.
  await expect(
    page.locator('main li').filter({ hasText: 'Phone (renamed elsewhere)' }),
  ).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(cards(page).filter({ hasText: 'My phone' })).toHaveCount(1)
})

test('Edge: a removal changed elsewhere is confirmed again against the reloaded passkey', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('passkey-changed-elsewhere')
  await page.goto('passkeys')
  await cards(page).filter({ hasText: 'Phone' }).getByRole('button', { name: 'Remove' }).click()
  const changed = alicePasskeys().map((p) =>
    p.id === PASSKEY_IDS.phone ? { ...p, name: 'Renamed phone', etag: '"pk-phone-3"' } : p,
  )
  await mockApi.patch({ accounts: { 'alice@example.org': { passkeys: changed } } })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Remove the passkey “Renamed phone”?')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(cards(page)).toHaveCount(3)
})

test('Edge: long passkey names wrap without horizontal scrolling', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  const name = 'Passkey'.repeat(36)
  await mockApi.use('anonymous-default', {
    signedInAs: 'alice@example.org',
    accounts: {
      'alice@example.org': { passkeys: [{ ...alicePasskeys()[0]!, name: name.slice(0, 255) }] },
    },
  })
  await page.goto('passkeys')
  await expect(cards(page).first()).toContainText(name.slice(0, 50))
  await expectNoHorizontalScroll()
})
