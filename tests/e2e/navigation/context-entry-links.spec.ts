import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { openAccountSections as openAccountTabs } from '../fixtures/flows'

async function expectContentWidth(page: Page, selector: string) {
  const shell = await page.locator('[data-shell-content]').boundingBox()
  const content = await page.locator(selector).boundingBox()
  expect(shell).not.toBeNull()
  expect(content).not.toBeNull()
  expect(Math.abs(shell!.width - content!.width)).toBeLessThan(1)
  expect(Math.abs(shell!.x - content!.x)).toBeLessThan(1)
}

test('System and Containers keeps Queue Manager and IP Check reachable through contextual links', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('admin-operations')
  await page.goto('operations/dashboard')
  await expect(page.locator('[data-hostname]')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('main').getByRole('link', { name: 'Queue Manager', exact: true }).click()
  await expect(page).toHaveURL(/\/operations\/mail-queue$/)
  await expect(page.locator('#mail-queue-search')).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-hostname]')).toBeVisible()
  await page.locator('[data-public-addresses]').getByRole('link', { name: 'IP Check' }).click()
  await expect(page).toHaveURL(/\/system\/ip-check$/)
  await expect(page.locator('[data-ip-check-value]')).toBeVisible()
  expect(await mockApi.countRequests('getPublicAddresses')).toBe(0)
})

test('account sidebar navigation keeps pages at the shared content width', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/password')
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  await expectContentWidth(page, '[data-account-content]')
  await expect(page.getByRole('main').locator('aside')).toHaveCount(0)
  const navigation = await openAccountTabs(page)
  await expect(
    navigation.getByRole('link', { name: 'Change password', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expectAccessible()
  await expectTouchTargets()
  await expectNoHorizontalScroll()
  await navigation.getByRole('link', { name: 'App passwords', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/app-passwords$/)
  await expect(page.locator('[data-app-password-list]')).toBeVisible()
  await expect(page.locator('[data-section-nav]')).toHaveCount(0)
  await expectContentWidth(page, '[data-account-content]')
})

test('switching account tabs preserves the dirty-form leave guard', async ({ page, mockApi }) => {
  await mockApi.use('account-mailbox')
  await page.goto('account/password')
  const next = page.getByLabel('New password', { exact: true })
  await next.fill('Unsaved-password-7')
  let navigation = await openAccountTabs(page)
  await navigation.getByRole('link', { name: 'App passwords', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Leave without saving?')
  await dialog.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/password$/)
  await expect(next).toHaveValue('Unsaved-password-7')
  navigation = await openAccountTabs(page)
  await navigation.getByRole('link', { name: 'App passwords', exact: true }).click()
  await dialog.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/app-passwords$/)
  expect(await mockApi.countRequests('changeOwnPassword')).toBe(0)
})

test('mailbox-specific account pages keep their full width, mailbox context and read-only permissions', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-domain-admin-no-flags')
  await page.goto('mailboxes/anna@example.org')
  await page.getByRole('link', { name: /^App passwords/ }).click()
  await expect(page.locator('[data-app-password-list]')).toBeVisible()
  await expect(page.locator('[data-acl-note]')).toContainText('Manage app passwords')
  await expect(page.getByRole('main').locator('header').first()).toContainText('anna@example.org')
  await expect(page.getByRole('link', { name: 'Create app password', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-section-nav]')).toHaveCount(0)
  await expectContentWidth(page, '[data-app-password-list]')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.locator('[data-detail-back]').click()
  await expect(page).toHaveURL(/\/mailboxes\/anna@example.org$/)
})
