// T048: My account › Two-factor authentication, the list and its removals (US2-AS1, AS6 to AS8,
// FR-043, FR-044, FR-053, FR-055 and the list's edge cases; decisions D10, D11).
import type { Page } from '@playwright/test'

import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { expect, test } from '../fixtures/test'

const heading = { level: 1, name: 'Two-factor authentication' } as const

async function open(page: Page) {
  await page.goto('account/two-factor')
  await expect(page.getByRole('heading', heading)).toBeVisible()
}

const entries = (page: Page) => page.locator('[data-second-factors] > li')

test('US2-AS1 FR-044 FR-055 without second factors: the help, the passkey pointer and the methods', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-two-factor-empty')
  await open(page)
  const main = page.getByRole('main')
  await expect(main).toContainText('you need app passwords to log in to apps')
  await expect(main.locator('[data-empty]')).toHaveText('No record')
  await expect(
    main.locator('[data-passkey-pointer]').getByRole('link', { name: 'Passkeys' }),
  ).toBeVisible()
  await expect(main.locator('[data-method]')).toHaveText([
    'Yubico OTP authentication',
    'WebAuthn authentication',
    'Time-based OTP (Google Authenticator, Authy, etc.)',
  ])
  await expect(main.locator('[data-turn-off]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US2-AS6 FR-043 removing one of two entries needs no password', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-two-factor-two-active')
  await open(page)
  await expect(entries(page)).toHaveCount(2)
  await expect(entries(page).first()).toContainText('Phone')
  await expect(entries(page).first()).toContainText('Used for this sign-in')
  await expect(entries(page).nth(1)).toContainText('WebAuthn authentication')
  await entries(page)
    .nth(1)
    .getByRole('button', { name: /^Remove/ })
    .click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Are you sure you want to proceed?')
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Remove' }).click()
  await expect(entries(page)).toHaveCount(1)
  await expect(page.getByLabel('Current password (confirm changes)')).toHaveCount(0)
})

test('US2-AS7 FR-053 the only active entry turns two-factor authentication off with the password', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-two-factor-single-active')
  await open(page)
  await entries(page)
    .first()
    .getByRole('button', { name: /^Remove/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Disable TFA' })
  await expect(dialog).toContainText('All second factors are removed. Your passkeys stay.')
  await expectAccessible()
  await dialog.getByLabel('Current password (confirm changes)').fill(MOCK_PASSWORD)
  await dialog.getByRole('button', { name: 'Disable TFA' }).click()
  await expect(page.locator('[data-empty]')).toHaveText('No record')

  await mockApi.use('account-two-factor-two-active')
  await open(page)
  await page.locator('[data-turn-off]').click()
  await expect(page.getByRole('dialog', { name: 'Disable TFA' })).toBeVisible()
})

test('US2-AS8 under the policy nothing can be removed and legacy explains why', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-two-factor-required-by-policy')
  await open(page)
  await expect(page.locator('[data-policy-note]')).toContainText(
    'Two-factor authentication cannot be removed because it is required for your account.',
  )
  await expect(entries(page).getByRole('button')).toHaveCount(0)
  await expect(page.locator('[data-turn-off]')).toHaveCount(0)
})

test('Edge: inactive and unsupported entries are listed, and the unsupported one does not count', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-two-factor-inactive-and-unsupported')
  await open(page)
  await expect(entries(page)).toHaveCount(3)
  await expect(entries(page).nth(1)).toContainText('Inactive')
  await expect(entries(page).nth(2)).toContainText('No longer supported')
  await entries(page)
    .nth(2)
    .getByRole('button', { name: /^Remove/ })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(entries(page)).toHaveCount(2)
  await entries(page)
    .first()
    .getByRole('button', { name: /^Remove/ })
    .click()
  await expect(page.getByRole('dialog', { name: 'Disable TFA' })).toBeVisible()
})

test('Edge: a refusal after a change elsewhere refreshes and turns off instead', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-two-factor-two-active')
  await open(page)
  await mockApi.patch({
    accounts: {
      'anna@example.org': {
        secondFactors: [{ id: 21, type: 'totp', name: 'Phone', tier: 'primary', secret: '123456' }],
      },
    },
  })
  await entries(page)
    .first()
    .getByRole('button', { name: /^Remove/ })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('dialog', { name: 'Disable TFA' })).toBeVisible()
})
