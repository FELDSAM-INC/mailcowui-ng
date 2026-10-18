// T068: password sign-in (US1-AS2, AS5, AS6, FR-005, FR-016–FR-019, FR-047, FR-081).
import { expect, test } from '../fixtures/test'
import {
  assertiveRegion,
  openNavigation,
  passwordForm,
  politeRegion,
  signInWithPassword,
  submitPassword,
} from '../fixtures/flows'

test('US1-AS2 FR-047 an administrator without second factors lands on home with the administrator navigation', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('admin-password')
  await signInWithPassword(page, 'admin')
  await expect(page).toHaveURL(/\/ng\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('You are signed in as Administrator.')
  await expect(page).toHaveTitle('Home – Example Mail')
  const navigation = await openNavigation(page)
  await expect(navigation.getByRole('link', { name: 'API keys' })).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Audit log' })).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US1-AS5 FR-018 a wrong password gives one generic message, keeps the username, clears the password and moves focus', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('admin-password')
  await signInWithPassword(page, 'admin', 'wrong password')
  const form = passwordForm(page)
  const message = 'Sign-in failed. Check your details and try again.'
  await expect(page.getByRole('alert')).toContainText(message)
  await expect(assertiveRegion(page)).toContainText(message)
  await expect(form.username).toHaveValue('admin')
  await expect(form.password).toHaveValue('')
  await expect(form.password).toBeFocused()
  await expectAccessible()

  await submitPassword(page, 'nobody@example.org', 'whatever')
  await expect(page.getByRole('alert')).toContainText(message)
})

test('US1-AS6 too many attempts disable sign-in until the retry time, and re-enabling is announced', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('throttled')
  await page.clock.install()
  await signInWithPassword(page, 'admin', 'wrong')
  const form = passwordForm(page)
  await expect(page.getByRole('alert')).toContainText('Too many attempts.')
  await expect(page.getByText(/You can try again in 1:(30|29|28)/)).toBeVisible()
  await expect(assertiveRegion(page)).toContainText('You can try again in 1 minute and 30 seconds')
  await expect(form.submit).toBeDisabled()
  await expectAccessible()

  await page.clock.fastForward('00:30')
  // The clock keeps running during the accessibility checks, so up to a minute is left now.
  await expect(page.getByText(/You can try again in (1:00|0:[0-5]\d)/)).toBeVisible()
  await expect(form.submit).toBeDisabled()
  await page.clock.fastForward('01:01')
  await expect(form.submit).toBeEnabled()
  await expect(politeRegion(page)).toContainText('You can try to sign in again.')
})

test('FR-016 FR-081 the form works with password managers, allows pasting and has an accessible show/hide toggle', async ({
  page,
  expectAccessible,
}) => {
  await page.goto('sign-in')
  const form = passwordForm(page)
  await expect(form.username).toHaveAttribute('autocomplete', /^username/)
  await expect(form.username).toHaveAttribute('autocapitalize', 'none')
  await expect(form.username).toHaveAttribute('autocorrect', 'off')
  await expect(form.username).toHaveAttribute('spellcheck', 'false')
  await expect(form.password).toHaveAttribute('autocomplete', 'current-password')
  await expect(form.password).toHaveAttribute('type', 'password')

  const pasteBlocked = await form.password.evaluate((input) => {
    const event = new Event('paste', { bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(pasteBlocked).toBe(false)

  const toggle = page.getByRole('button', { name: 'Show password' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await form.password.fill('secret value')
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(form.password).toHaveAttribute('type', 'text')
  await page.keyboard.press('Space')
  await expect(form.password).toHaveAttribute('type', 'password')
  await expectAccessible()
})

test('FR-017 a deliberately delayed answer keeps the busy state, prevents a second submit and announces progress', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('slow-sign-in')
  await page.goto('sign-in')
  const form = passwordForm(page)
  await form.username.fill('admin')
  await form.password.fill('Passw0rd!mock')
  await form.submit.click()
  const busy = page.getByRole('button', { name: 'Signing in…' })
  await expect(busy).toBeDisabled()
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  await expect(politeRegion(page)).toContainText('Signing in…')
  await busy.click({ force: true }).catch(() => undefined)
  await form.password.press('Enter').catch(() => undefined)
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  const attempts = (await mockApi.requests()).filter((r) => r.operationId === 'createSession')
  expect(attempts).toHaveLength(1)
})

test('FR-005 FR-019 a role screen names its role in the sign-in, the neutral screen does not', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('domain-admin-password')
  await signInWithPassword(page, 'reseller', 'Passw0rd!mock', 'sign-in/domain-admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, reseller' })).toBeVisible()
  const [roleAttempt] = (await mockApi.requests()).filter((r) => r.operationId === 'createSession')
  expect(roleAttempt?.body).toMatchObject({ username: 'reseller', role: 'domainAdmin' })

  await mockApi.use('admin-password')
  await signInWithPassword(page, 'admin', 'Passw0rd!mock', 'sign-in')
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, admin' })).toBeVisible()
  const [neutral] = (await mockApi.requests()).filter((r) => r.operationId === 'createSession')
  expect(neutral?.body).not.toHaveProperty('role')
})
