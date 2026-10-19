// T111: the pending-actions screen (US5-AS1–AS6, US2-AS7, FR-038–FR-041 and the reload edge case).
// UI 005 replaced the classic link and "Check again" of the password change (FR-029).
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { expect, test } from '../fixtures/test'

const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Actions required' })
// UI 005: only the actions, not the list of password rules inside the password change.
const actions = (page: Page) => page.getByRole('main').locator('[data-pending-actions] > li')

test('US5-AS1 FR-039 @virtual-authenticator registering a passkey lifts second-factor setup and continues without a new sign-in', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('forced-second-factor')
  await webauthn.virtualAuthenticator()
  await page.goto('quarantine')
  await expect(heading(page)).toBeVisible()
  await expect(page).toHaveURL(/\/ng\/pending-actions\?returnTo=(%2F|\/)quarantine$/)
  await expect(actions(page)).toHaveCount(1)
  await expect(actions(page).first()).toContainText('Two-Factor Authentication Required')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page.getByRole('button', { name: 'Register a passkey' }).click()
  await expect(page).toHaveURL(/\/ng\/quarantine$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Quarantine' })).toBeVisible()
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).toContain('registerPasskey')
  expect(ops).not.toContain('createSession')
})

// UI 005 (FR-029): the forced password change is resolved on this screen; its tests are in
// tests/e2e/pending-actions/forced-password.spec.ts.

test('US5-AS3 FR-041 with both actions the password change comes first and registration waits for it', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('forced-both')
  await webauthn.stubCredentials(SEEDED_CREDENTIALS.unknown)
  await page.goto('')
  await expect(actions(page).getByRole('heading', { level: 2 })).toHaveText([
    'Change password',
    'Two-Factor Authentication Required',
  ])
  await expect(actions(page).nth(1)).toContainText(
    'You set up a second factor here once your new password is saved.',
  )
  await expect(page.getByRole('button', { name: 'Register a passkey' })).toHaveCount(0)
  await expectAccessible()
})

test('US5-AS4 FR-039 without passkey support second-factor setup points to the classic interface', async ({
  page,
  mockApi,
  webauthn,
  expectAccessible,
}) => {
  await mockApi.use('forced-second-factor')
  await webauthn.withoutPasskeySupport()
  await page.goto('')
  const item = actions(page).first()
  await expect(item).toContainText('This device cannot create passkeys.')
  await expect(
    item.getByRole('link', { name: 'Set up a second factor in the classic interface' }),
  ).toHaveAttribute('href', '/')
  await expect(page.getByRole('button', { name: 'Register a passkey' })).toHaveCount(0)
  await expectAccessible()
})

test('US5-AS5 FR-038 any other address shows the pending-actions screen', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('forced-password-change')
  for (const path of ['', 'api-keys', 'passkeys', 'sign-in', 'sign-in/second-factor']) {
    await page.goto(path)
    await expect(heading(page)).toBeVisible()
  }
  const ops = (await mockApi.requests()).map((r) => r.operationId)
  expect(ops).not.toContain('listPasskeys')
  expect(ops).not.toContain('listApiKeys')
})

test('US5-AS6 FR-036 the screen offers sign-out', async ({ page, mockApi }) => {
  await mockApi.use('forced-password-change')
  await page.goto('')
  await expect(heading(page)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel and log out' }).click()
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
})

test('US2-AS7 @virtual-authenticator a passkey sign-in of an account forced to change its password shows this screen', async ({
  page,
  mockApi,
  webauthn,
}) => {
  await mockApi.use('passkey-forced-password-change')
  await webauthn.withoutConditionalMediation()
  const authenticator = await webauthn.virtualAuthenticator()
  await authenticator.addCredential({ credentialId: SEEDED_CREDENTIALS.bob })
  await page.goto('sign-in')
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(heading(page)).toBeVisible()
  await expect(actions(page).first()).toContainText('Change password')
})

test('Edge: a reload resumes the pending-actions screen', async ({ page, mockApi }) => {
  await mockApi.use('forced-password-change')
  await page.goto('')
  await expect(heading(page)).toBeVisible()
  await page.reload()
  await expect(heading(page)).toBeVisible()
  await expect(actions(page).first()).toContainText('Change password')
})
