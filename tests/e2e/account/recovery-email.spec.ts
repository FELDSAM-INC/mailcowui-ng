// T061: My account › Password recovery email (US3-AS1, US3-AS2, FR-016, FR-032, FR-033; legacy
// `#pwRecoveryEmailModal`, decision D15).
import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'

const heading = { level: 1, name: 'Password recovery email' } as const

test('US3-AS1 FR-032 FR-033 sets an address with the current password and clears it', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/recovery-email')
  await expect(page.getByRole('heading', heading)).toBeVisible()
  const email = page.getByLabel('Email', { exact: true })
  await expect(email).toHaveAttribute('type', 'email')
  await expect(email).toHaveValue('anna.private@example.net')
  await expect(page.getByRole('main')).toContainText(
    'If no email for password recovery is provided, this function cannot be used.',
  )
  await expectAccessible()
  await expectNoHorizontalScroll()
  await email.fill('anna@example.net')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('main')).toContainText(
    'Changes to mailbox anna@example.org have been saved',
  )
  await expect(email).toHaveValue('anna@example.net')
  await email.fill('')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(email).toHaveValue('')
})

test('current-password-incorrect is shown on its field', async ({ page, mockApi }) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/recovery-email')
  await page.getByLabel('Current password (confirm changes)').fill('wrong')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('FR-016 a change elsewhere keeps the typed address and reloads the stored one', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/recovery-email')
  const email = page.getByLabel('Email', { exact: true })
  await expect(email).toHaveValue('anna.private@example.net')
  await mockApi.patch({
    mailboxes: { set: { 'anna@example.org': { recoveryEmail: 'other@example.net' } } },
    selfService: { mailboxes: { 'anna@example.org': { recoveryVersion: 9 } } },
  })
  await email.fill('typed@example.net')
  await page.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('[data-outdated]')).toContainText('Changed elsewhere')
  await expect(page.locator('[data-outdated]')).toContainText('other@example.net')
  await expect(email).toHaveValue('typed@example.net')
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveValue('')
})

test('US3-AS2 without the pwReset flag the section is absent; the address an administrator set stays', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox-no-pw-reset')
  await page.goto('account')
  await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
  await expect(page.locator('[data-section-nav] a[href$="/account/recovery-email"]')).toHaveCount(0)
  await page.goto('account/recovery-email')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
})
