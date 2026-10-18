// T111: the pending-actions screen (US5-AS1–AS6, US2-AS7, FR-038–FR-041 and the reload edge case).
import type { Page } from '@playwright/test'

import { SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
import { expect, test } from '../fixtures/test'
import { politeRegion } from '../fixtures/flows'

const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Actions required' })
const actions = (page: Page) => page.getByRole('main').getByRole('listitem')

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
  await expect(actions(page).first()).toContainText('Set up a second factor')
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

test('US5-AS2 FR-040 a forced password change links to the classic sign-in, and "Check again" stays until it is done', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('forced-password-change')
  await page.goto('')
  await expect(heading(page)).toBeVisible()
  const item = actions(page).first()
  await expect(item).toContainText('Change your password')
  await expect(
    item.getByRole('link', { name: 'Change your password in the classic interface' }),
  ).toHaveAttribute('href', '/')
  await expectAccessible()
  await item.getByRole('button', { name: 'Check again' }).click()
  await expect(
    page.getByRole('main').getByText('The password change is still pending.'),
  ).toBeVisible()
  await expect(politeRegion(page)).toContainText('The password change is still pending.')
  await expect(heading(page)).toBeVisible()
  await mockApi.patch({ accounts: { 'bob@example.org': { pendingActions: [] } } })
  await item.getByRole('button', { name: 'Check again' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hello, bob@example.org' }),
  ).toBeVisible()
})

test('US5-AS2 FR-040 the classic link follows the role', async ({ page, mockApi }) => {
  await mockApi.use('anonymous-default', {
    signedInAs: 'reseller',
    accounts: { reseller: { pendingActions: ['passwordChange'] } },
  })
  await page.goto('')
  await expect(
    page.getByRole('link', { name: 'Change your password in the classic interface' }),
  ).toHaveAttribute('href', '/domainadmin')
})

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
    'Change your password',
    'Set up a second factor',
  ])
  await expect(actions(page).nth(1)).toContainText(
    'You can register a passkey here once your password has been changed.',
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
  await page.getByRole('button', { name: 'Sign out' }).click()
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
  await expect(actions(page).first()).toContainText('Change your password')
})

test('Edge: a reload resumes the pending-actions screen', async ({ page, mockApi }) => {
  await mockApi.use('forced-password-change')
  await page.goto('')
  await expect(heading(page)).toBeVisible()
  await page.reload()
  await expect(heading(page)).toBeVisible()
  await expect(actions(page).first()).toContainText('Change your password')
})
