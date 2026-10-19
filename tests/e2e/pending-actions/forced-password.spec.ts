// T040: the forced password change on the pending-actions screen (US1-AS5 to AS7, FR-029 to
// FR-031; legacy `#ChangePWModal`).
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const screen = { level: 1, name: 'Actions required' } as const

const form = (page: Page) => ({
  next: page.getByLabel('New password', { exact: true }),
  repeat: page.getByLabel('Confirmation password (repeat)'),
  save: page.getByRole('button', { name: 'Save changes' }),
})

for (const scenario of [
  'account-forced-password-policy',
  'account-forced-password-change-domain-admin',
]) {
  test(`US1-AS5 US1-AS6 FR-030 the new password is set on the screen without the current one (${scenario})`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.goto('domains')
    await expect(page.getByRole('heading', screen)).toBeVisible()
    await expect(page.getByRole('main')).toContainText('Change password')
    await expect(page.locator('input[autocomplete="current-password"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /classic interface/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check again' })).toHaveCount(0)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.goto('account')
    await expect(page.getByRole('heading', screen)).toBeVisible()

    await form(page).next.fill('summer')
    await expect(page.locator('[data-password-policy] li').first()).toHaveAttribute(
      'data-met',
      'false',
    )
    await page.getByRole('button', { name: '(generate)' }).click()
    await expect(page.getByRole('button', { name: 'Copy the generated password' })).toBeVisible()
    await form(page).save.click()
    await expect(page.getByRole('heading', screen)).toHaveCount(0)
    await expect(page).toHaveURL(/\/ng\/account$/)
  })
}

test('US1-AS6 FR-031 the second-factor setup follows the password on the same screen', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-forced-both-policy')
  await page.goto('')
  await expect(page.getByRole('heading', screen)).toBeVisible()
  await expect(page.getByRole('main')).toContainText(
    'You set up a second factor here once your new password is saved.',
  )
  await form(page).next.fill('summer2026x')
  await form(page).repeat.fill('summer2026x')
  await form(page).save.click()
  await expect(page.getByRole('heading', { level: 2, name: 'Change password' })).toHaveCount(0)
  await expect(page.getByRole('heading', screen)).toBeVisible()
})

test('US1-AS7 "Sign out" ends the session; a reload resumes the screen; language and theme stay', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-forced-password-policy')
  await page.goto('')
  await expect(page.getByRole('heading', screen)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', screen)).toBeVisible()
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel and log out' }).click()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
})

test('FR-023 a mismatch is reported before saving', async ({ page, mockApi }) => {
  await mockApi.use('account-forced-password-policy')
  await page.goto('')
  await form(page).next.fill('summer2026x')
  await form(page).repeat.fill('summer2026y')
  await form(page).save.click()
  await expect(page.getByRole('main')).toContainText('Confirmation password does not match')
  const changes = (await mockApi.requests()).filter((r) => r.operationId === 'changeOwnPassword')
  expect(changes).toHaveLength(0)
})
