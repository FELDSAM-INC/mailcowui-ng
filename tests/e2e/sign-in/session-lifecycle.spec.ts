// T070: the session lifecycle (US1-AS12, AS17, FR-031–FR-037, FR-092, SC-009, SC-014 and the edge
// cases of ended sessions and lost connections).
import { expect, test } from '../fixtures/test'
import {
  assertiveRegion,
  openNavigation,
  passwordForm,
  signInWithPassword,
  signOutFromMenu,
  submitPassword,
} from '../fixtures/flows'

const domainsHeading = { level: 1, name: 'Domains' } as const

test('US1-AS12 SC-009 sign-out confirms on the sign-in screen and Back reveals nothing of the session', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('admin-active')
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Mailboxes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeVisible()
  await signOutFromMenu(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
  await expectAccessible()
  await page.goBack()
  await expect(page).toHaveURL(/\/ng\/sign-in\?returnTo=(%2F|\/)domains$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('heading', domainsHeading)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Account menu of / })).toHaveCount(0)
})

test('FR-036 a sign-out that cannot reach the server says so and offers a retry', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('admin-active')
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  await page.route('**/api/v2/session', (route) =>
    route.request().method() === 'DELETE' ? route.abort() : route.fallback(),
  )
  await signOutFromMenu(page)
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Sign-out could not be confirmed.')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  await expectAccessible()
  await page.unroute('**/api/v2/session')
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
})

test('US1-AS17 SC-014 the idle warning comes 2 minutes before expiry, "Stay signed in" continues, and expiry returns to the page after sign-in', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('short-idle')
  await page.clock.install()
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  // Logo images follow the theme the accessibility check switches; they are not app requests.
  const apiRequests = async () =>
    (await mockApi.requests()).filter((r) => r.operationId !== 'getPublicConfigLogo')
  const before = (await apiRequests()).length

  await page.clock.fastForward('00:31')
  const dialog = page.getByRole('alertdialog', { name: 'Your session is about to end' })
  await expect(dialog).toBeVisible()
  await expect(assertiveRegion(page)).toContainText('left before you are signed out')
  expect((await apiRequests()).length, 'no request while idle').toBe(before)
  await expectAccessible()

  await dialog.getByRole('button', { name: 'Stay signed in' }).click()
  await expect(dialog).toHaveCount(0)
  const ops = (await apiRequests()).slice(before).map((r) => r.operationId)
  expect(ops).toEqual(['getSession'])
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()

  await page.clock.fastForward('00:31')
  await expect(dialog).toBeVisible()
  await mockApi.patch({ expireSession: true })
  await page.clock.fastForward('02:00')
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(
    page.getByRole('main').getByText('Your session has ended. Please sign in again.'),
  ).toBeVisible()
  await submitPassword(page, 'admin')
  await expect(page).toHaveURL(/\/ng\/domains$/)
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
})

test('Edge: activity in another page of the app suppresses the idle warning', async ({
  page,
  context,
  mockApi,
}) => {
  await mockApi.use('short-idle')
  await page.clock.install()
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  const other = await context.newPage()
  await page.clock.fastForward('00:20')
  await other.goto('mailboxes')
  await expect(other.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeVisible()
  await page.clock.fastForward('00:20')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await other.close()
})

test('FR-031 a deep link opened signed out is reached after sign-in', async ({ page, mockApi }) => {
  await mockApi.use('admin-password')
  await page.goto('mailboxes')
  await expect(page).toHaveURL(/\/ng\/sign-in\?returnTo=(%2F|\/)mailboxes$/)
  await submitPassword(page, 'admin')
  await expect(page).toHaveURL(/\/ng\/mailboxes$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mailboxes' })).toBeVisible()
})

test('FR-092 a hostile return address is ignored', async ({ page, mockApi }) => {
  await mockApi.use('admin-password')
  await signInWithPassword(page, 'admin', undefined, 'sign-in?returnTo=//evil.example/x')
  await expect(page).toHaveURL(/\/ng\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
})

test('FR-034 a request answered as unauthenticated shows the session-ended message', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.clock.install()
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  await mockApi.patch({ expireSession: true })
  // FR-050: a navigation with an identity older than five minutes reads it again.
  await page.clock.fastForward('06:00')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Mailboxes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(
    page.getByRole('main').getByText('Your session has ended. Please sign in again.'),
  ).toBeVisible()
})

test('Edge: an account deactivated while signed in ends the session on its next request', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.clock.install()
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  await mockApi.patch({ accounts: { admin: { active: false } } })
  await page.clock.fastForward('06:00')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Mailboxes' }).click()
  await expect(
    page.getByRole('main').getByText('Your session has ended. Please sign in again.'),
  ).toBeVisible()
})

test('FR-035 an expired anti-forgery token is refreshed silently once', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('csrf-expired')
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  await mockApi.patch({
    session: { csrfToken: 'RotatedTokenRotatedTokenRotatedTokenRotatedToken' },
  })
  await signOutFromMenu(page)
  await expect(page.getByRole('main').getByText('You have signed out.')).toBeVisible()
  const ops = (await mockApi.requests()).map((r) => `${r.operationId} ${r.status}`)
  expect(ops).toEqual(
    expect.arrayContaining(['deleteSession 403', 'getCsrfToken 200', 'deleteSession 204']),
  )
})

test('FR-035 a second anti-forgery refusal ends the session', async ({ page, mockApi }) => {
  await mockApi.use('csrf-expired', {
    failures: { deleteSession: { status: 403, type: 'csrf-token-mismatch', times: 2 } },
  })
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()
  await signOutFromMenu(page)
  await expect(
    page.getByRole('main').getByText('Your session has ended. Please sign in again.'),
  ).toBeVisible()
})

test('FR-037 a sign-out in another page ends this one, and a sign-in there as another account replaces its data', async ({
  page,
  context,
  mockApi,
}) => {
  await mockApi.use('mailbox-password', { signedInAs: 'admin' })
  await page.goto('domains')
  await expect(page.getByRole('heading', domainsHeading)).toBeVisible()

  const other = await context.newPage()
  await other.goto('')
  await expect(other.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  await signOutFromMenu(other)
  await expect(other.getByRole('main').getByText('You have signed out.')).toBeVisible()

  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('heading', domainsHeading)).toHaveCount(0)

  await submitPassword(other, 'alice@example.org')
  await expect(
    other.getByRole('heading', { level: 1, name: 'Hello, alice@example.org' }),
  ).toBeVisible()
  // The first page shows the new session's state: alice's account, and no data of admin.
  await expect(
    page.getByRole('button', { name: 'Account menu of alice@example.org' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account menu of admin' })).toHaveCount(0)
  await other.close()
})

test('Edge: a lost connection gives a translated message, nothing is reported as done, and a retry works', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('admin-password')
  await page.goto('sign-in')
  await expect(passwordForm(page).username).toBeVisible()
  await page.route('**/api/v2/session', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.fallback(),
  )
  await submitPassword(page, 'admin')
  await expect(page.getByRole('alert')).toContainText(
    'The server could not be reached. Check your connection and try again.',
  )
  await expect(page).toHaveURL(/\/ng\/sign-in/)
  await expectAccessible()
  await page.unroute('**/api/v2/session')
  await passwordForm(page).password.fill('Passw0rd!mock')
  await passwordForm(page).submit.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
})
