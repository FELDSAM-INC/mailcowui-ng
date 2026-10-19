// T039: My account › Change password (US1, FR-012, FR-015, FR-021 to FR-028; legacy
// `#pwChangeModal`, decisions D7 and D9).
import type { Page } from '@playwright/test'

import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { openNavigation } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

const heading = { level: 1, name: 'Change password' } as const

async function open(page: Page) {
  await page.goto('account/password')
  await expect(page.getByRole('heading', heading)).toBeVisible()
}

const form = (page: Page) => ({
  next: page.getByLabel('New password', { exact: true }),
  repeat: page.getByLabel('Confirmation password (repeat)'),
  current: page.getByLabel('Current password (confirm changes)'),
  endOthers: page.getByRole('checkbox', { name: 'Sign out my other sessions' }),
  submit: page.getByRole('button', { name: 'Change password' }),
})

async function fill(page: Page, next: string, current: string) {
  const fields = form(page)
  await fields.next.fill(next)
  await fields.repeat.fill(next)
  await fields.current.fill(current)
}

test('US1-AS1 FR-026 a domain administrator changes the password and two other sessions end', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-domain-admin')
  await open(page)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expect(form(page).endOthers).toBeChecked()
  await fill(page, 'summer2026x', MOCK_PASSWORD)
  await form(page).submit.click()
  const outcome = page.locator('[data-password-changed]')
  await expect(outcome).toContainText('Changes to domain administrator reseller have been saved')
  await expect(outcome).toContainText('2 other sessions were signed out.')
  await expect(outcome).toContainText('Mail apps may accept the old password for up to 5 minutes.')
  await expect(form(page).next).toHaveValue('')
  await expect(form(page).current).toHaveValue('')
  await expect(page.getByRole('heading', heading)).toBeVisible()
  await expectAccessible()

  await fill(page, 'winter2026x', 'summer2026x')
  await form(page).endOthers.uncheck()
  await form(page).submit.click()
  await expect(outcome).not.toContainText('signed out')
  const changes = (await mockApi.requests()).filter((r) => r.operationId === 'changeOwnPassword')
  expect(changes.map((r) => (r.body as { endOtherSessions: boolean }).endOtherSessions)).toEqual([
    true,
    false,
  ])
})

test('US1-AS2 a wrong current password is shown on its field; too many show the countdown', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox')
  await open(page)
  await fill(page, 'summer2026x', 'wrong')
  await form(page).submit.click()
  await expect(form(page).current).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('main')).toContainText('Access denied or invalid form data')
  await expect(form(page).current).toBeFocused()
  await expectAccessible()

  await mockApi.use('account-password-throttled')
  await open(page)
  await fill(page, 'summer2026x', MOCK_PASSWORD)
  await form(page).submit.click()
  await expect(page.getByRole('main')).toContainText(/You can try again in \d/)
  await expect(form(page).submit).toBeDisabled()
})

test('US1-AS3 FR-012 the rules are marked while typing, and refusals land on the new password', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-domain-admin')
  await open(page)
  await form(page).next.fill('summer')
  const rules = page.locator('[data-password-policy] li')
  await expect(rules).toHaveCount(2)
  await expect(rules.nth(0)).toHaveAttribute('data-met', 'false')
  await expect(rules.nth(1)).toHaveAttribute('data-met', 'false')
  await expect(rules.nth(0)).toContainText('not met')
  await form(page).repeat.fill('summer')
  await form(page).current.fill(MOCK_PASSWORD)
  await form(page).submit.click()
  await expect(form(page).next).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('main')).toContainText('Password does not meet the policy')
  await expectAccessible()

  await fill(page, '{SSHA512}abcdefgh12', MOCK_PASSWORD)
  await form(page).submit.click()
  await expect(page.getByRole('main')).toContainText(
    'The password may not start with a hash scheme such as SSHA512.',
  )
})

test('US1-AS4 a mailbox user reads that the 3 app passwords keep working', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await open(page)
  await expect(page.locator('[data-app-password-hint]')).toHaveText(
    'Your account has 3 app passwords that will not be changed. To manage these, go to the App passwords tab.',
  )
})

test('US1-AS8 an externally managed password shows the notice and no form', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-external-source')
  await open(page)
  await expect(page.locator('[data-external-password]')).toContainText(
    'Your organisation manages the password and second factors of this account.',
  )
  await expect(page.locator('form')).toHaveCount(0)
  await expectAccessible()
})

test('FR-023 FR-024 FR-025 mismatch, show and hide by keyboard, autocomplete, generate and copy', async ({
  page,
  mockApi,
  expectTouchTargets,
}) => {
  await mockApi.use('account-mailbox')
  await open(page)
  const fields = form(page)
  await expect(page.locator('input[autocomplete="username"]')).toHaveValue('anna@example.org')
  await expect(fields.next).toHaveAttribute('autocomplete', 'new-password')
  await expect(fields.repeat).toHaveAttribute('autocomplete', 'new-password')
  await expect(fields.current).toHaveAttribute('autocomplete', 'current-password')

  await fields.next.fill('first-password-1')
  await fields.repeat.fill('other')
  await fields.current.focus()
  await expect(page.getByRole('main')).toContainText('Confirmation password does not match')

  const toggle = page.getByRole('button', { name: 'Toggle password visibility' }).first()
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(fields.next).toHaveAttribute('type', 'text')

  await page.getByRole('button', { name: '(generate)' }).click()
  const generated = await fields.next.inputValue()
  expect(generated.length).toBeGreaterThanOrEqual(16)
  await expect(fields.repeat).toHaveValue(generated)
  await expect(page.getByRole('button', { name: 'Copy the generated password' })).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Confirmation password does not match')
  await expectTouchTargets()
})

test('FR-015 leaving with typed input asks first', async ({ page, mockApi }) => {
  await mockApi.use('account-mailbox')
  await open(page)
  await form(page).next.fill('something')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Home' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /stay/i }).click()
  await expect(page.getByRole('heading', heading)).toBeVisible()
})
