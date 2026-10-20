import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

async function clipboard(page: Page, refused = false) {
  await page.addInitScript((deny) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          if (deny) return Promise.reject(new Error('denied'))
          ;(window as unknown as { copied: string }).copied = value
          return Promise.resolve()
        },
      },
    })
  }, refused)
}

test('creates once, copies raw, edits, regenerates and deletes, with keyboard and both themes', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-app-passwords-empty')
  await clipboard(page)
  await page.goto('account/app-passwords')
  await expect(page.getByRole('main')).toContainText('No data available in table')
  await expect(page.getByRole('main')).toContainText(
    'The username remains unchanged. SOGo webmail is not available through app passwords.',
  )
  await page.getByRole('link', { name: 'Create app password' }).click()
  await expect(page.getByRole('heading', { name: 'Add app password', exact: true })).toBeVisible()
  const protocol = page.getByLabel('Allowed protocols for app password')
  await expect(protocol).toHaveValues(['imap', 'smtp', 'activeSync', 'dav', 'pop3', 'sieve'])
  await protocol.selectOption([])
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'With no protocol selected',
  )
  await page.getByLabel('App name', { exact: true }).fill('Phone')
  await protocol.selectOption(['imap', 'smtp'])
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'App password', exact: true })
  await expect(dialog).toContainText('anna@example.org')
  const secret = await dialog.getByLabel('Secret', { exact: true }).inputValue()
  expect(secret).toHaveLength(32)
  await expect(dialog.locator('[data-grouped-secret] > span:not(.sr-only)')).toHaveCount(8)
  await expectAccessible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog', { name: 'Have you saved the secret?' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to the secret' }).click()
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(secret)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/app-passwords\/\d+$/)
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(page.getByLabel('App name', { exact: true })).toHaveValue('Phone')
  await page.getByLabel('App name', { exact: true }).fill('Mobile phone')
  await page.getByLabel('Active', { exact: true }).uncheck()
  await page.getByLabel('Allowed protocols for app password').selectOption(['imap'])
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'Changes to object Mobile phone have been saved',
  )
  await page.getByRole('button', { name: 'generate', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'generate', exact: true }).click()
  await expect(dialog).toBeVisible()
  const renewed = await dialog.getByLabel('Secret', { exact: true }).inputValue()
  expect(renewed).not.toBe(secret)
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('account/app-passwords')
  await expect(page.getByRole('main')).toContainText('Mobile phone')
  await expect(page.getByRole('main')).not.toContainText(renewed)
  await expect(page.locator('[data-entry]')).toContainText('IMAP')
  await expect(page.locator('[data-entry]')).not.toContainText('SMTP')
  await expect(page.locator('[data-entry]')).toContainText('Inactive')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('button', { name: 'Remove: Mobile phone', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Mobile phone')
  await page.getByRole('button', { name: 'Delete now' }).click()
  await expect(page.locator('[data-app-password-list]')).toHaveCount(0)
  const requests = await mockApi.requests()
  expect(requests.filter((r) => r.operationId === 'deleteAppPassword')).toHaveLength(1)
})

test('copy refusal exposes and selects the raw secret, and Back asks before discarding', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await clipboard(page, true)
  await page.goto('account/app-passwords')
  await page.getByRole('link', { name: 'Create app password' }).click()
  await page.getByLabel('App name', { exact: true }).fill('Uncopied')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'App password', exact: true })
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
  const field = dialog.getByLabel('Secret', { exact: true })
  await expect(field).toBeVisible()
  expect(
    await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]),
  ).toEqual([0, 32])
  await page.goBack()
  await expect(page.getByRole('alertdialog', { name: 'Have you saved the secret?' })).toBeVisible()
  await page.getByRole('button', { name: 'Yes, I have saved it' }).click()
  await expect(page).toHaveURL(/account\/app-passwords$/)
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await page.getByRole('link', { name: 'Edit: Uncopied', exact: true }).click()
  await expect(page.getByRole('button', { name: 'generate', exact: true })).toBeVisible()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
})

test('a version conflict keeps the draft, shows current values and explicitly saves again', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/app-passwords/1')
  await expect(page.getByLabel('App name', { exact: true })).toHaveValue('Laptop')
  await mockApi.patch({
    selfService: {
      setAppPasswords: { 'anna@example.org#1': { name: 'Elsewhere', active: false } },
    },
  })
  await page.getByLabel('App name', { exact: true }).fill('My laptop')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('[data-outdated]')).toContainText('Elsewhere')
  await expect(page.getByLabel('App name', { exact: true })).toHaveValue('My laptop')
  await page.getByRole('button', { name: 'Save again' }).click()
  await expect(page.locator('[data-outdated]')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('status')).toContainText('My laptop')
})

test('search, active, order and paging stay in the URL; bulk actions use per-item versions', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-app-passwords-many')
  await page.goto('account/app-passwords')
  await expect(page.locator('[data-entry]')).toHaveCount(25)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('[data-entry]')).toHaveCount(5)
  await page.getByRole('searchbox', { name: 'Search:' }).fill('Device 30')
  await expect(page).toHaveURL(/q=Device/)
  await expect(page.locator('[data-entry]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByLabel('Device 30', { exact: true }).check()
  await page.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(page.getByRole('main')).toContainText('1 done')
  await page.getByRole('combobox', { name: 'Active', exact: true }).selectOption('yes')
  await expect(page).toHaveURL(/active=yes/)
  await expect(page.locator('[data-entry]')).toHaveCount(1)
  const request = (await mockApi.requests()).find((r) => r.operationId === 'updateAppPassword')
  expect(request).toBeDefined()
})

test('permission loss refreshes identity and removes the own section', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/app-passwords/1')
  await expect(page.getByLabel('App name', { exact: true })).toHaveValue('Laptop')
  await mockApi.setFlags('anna@example.org', { appPasswds: false })
  await page.getByLabel('App name', { exact: true }).fill('Denied')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
})

test('without the user flag the hub and direct link do not load app passwords', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox-no-app-passwords-flag')
  await page.goto('account')
  await expect(page.locator('[data-section="appPasswords"]')).toHaveCount(0)
  await page.goto('account/app-passwords')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'listAppPasswords'),
  ).toHaveLength(0)
})

test('bulk conflicts keep only the refused item selected and retry with its refreshed version', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/app-passwords')
  await expect(page.locator('[data-entry]')).toHaveCount(3)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Laptop', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Phone', exact: true }).check()
  await mockApi.patch({
    selfService: { setAppPasswords: { 'anna@example.org#1': { name: 'Changed laptop' } } },
  })
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
  const results = page.getByRole('region', { name: 'Results', exact: true })
  await expect(results).toContainText('1 done')
  await expect(results).toContainText('1 changed in the meantime')
  await expect(page.getByRole('checkbox', { name: 'Changed laptop', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Phone', exact: true })).not.toBeChecked()
  await results.getByRole('button', { name: 'Retry the failed ones' }).click()
  await expect(results).toContainText('1 done')
  await expect(results).not.toContainText('Changed in the meantime')
  expect(
    (await mockApi.requests()).filter((r) => r.operationId === 'updateAppPassword'),
  ).toHaveLength(3)
})

test('bulk removal names the items and requires the selected count', async ({ page, mockApi }) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/app-passwords')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Laptop', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Phone', exact: true }).check()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation).toContainText('Laptop')
  await expect(confirmation).toContainText('Phone')
  await expect(confirmation.getByRole('button', { name: 'Delete now' })).toBeDisabled()
  await confirmation.getByLabel('Type 2 to confirm').fill('2')
  await confirmation.getByRole('button', { name: 'Delete now' }).click()
  await expect(page.locator('[data-entry]')).toHaveCount(1)
})

test('sort and filter changes are restored by browser Back with the remaining list parameters', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-app-passwords-many')
  await page.goto('account/app-passwords?q=Device&size=50')
  await expect(page.locator('[data-entry]')).toHaveCount(30)
  const sort = page.getByRole('combobox', { name: 'Sort by', exact: true })
  const active = page.getByRole('combobox', { name: 'Active', exact: true })
  await sort.selectOption('createdAt')
  await expect(page).toHaveURL(/sort=createdAt/)
  await expect(page.getByRole('button', { name: 'Descending', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Descending', exact: true }).click()
  await expect(page).toHaveURL(/order=asc/)
  await active.selectOption('no')
  await expect(page).toHaveURL(/active=no/)
  await expect(page.locator('[data-entry]')).toHaveCount(15)
  await page.goBack()
  await expect(active).toHaveValue('')
  await expect(page).toHaveURL(/order=asc/)
  await expect(page.locator('[data-entry]')).toHaveCount(30)
  await page.goBack()
  await expect(sort).toHaveValue('createdAt')
  await expect(page.getByRole('button', { name: 'Descending', exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/order=/)
  await page.goBack()
  await expect(sort).toHaveValue('name')
  await expect(page).not.toHaveURL(/sort=/)
  await expect(page.getByRole('searchbox', { name: 'Search:' })).toHaveValue('Device')
  await expect(page).toHaveURL(/size=50/)
})

test('SC-003 default creation and copy use four actions from My account', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-app-passwords-empty')
  await clipboard(page)
  await page.goto('account')
  let actions = 0
  await page.locator('[data-sections] [data-section="appPasswords"]').click()
  actions++
  await page.getByRole('link', { name: 'Create app password' }).click()
  actions++
  // Entering the required name is excluded; defaults need no protocol/active interaction.
  await page.getByLabel('App name', { exact: true }).fill('Phone')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  actions++
  const dialog = page.getByRole('dialog', { name: 'App password', exact: true })
  const copy = dialog.getByRole('button', { name: 'Copy', exact: true })
  await expect(copy).toBeFocused()
  await copy.click()
  actions++
  expect(actions).toBe(4)
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toHaveLength(
    32,
  )
  expect(
    (await mockApi.requests()).filter((request) => request.operationId === 'createAppPassword'),
  ).toHaveLength(1)
})
