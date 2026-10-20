import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const records = (page: Page) =>
  (page.viewportSize()?.width ?? 0) >= 768
    ? page.getByRole('table', { name: 'Audit records' }).locator('tbody > tr[data-record]')
    : page.getByRole('list', { name: 'Audit records' }).getByRole('listitem')

test('US12 mailbox history includes password and app password changes with safe details', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('audit-self-service')
  await page.goto('mailboxes/anna@example.org')
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/\/audit-log\?targetId=anna(?:@|%40)example.org$/)
  await expect(records(page)).toHaveCount(24)
  const password = records(page).filter({ hasText: 'Own password changed' }).first()
  await expect(password).toContainText('anna@example.org')
  await expect(password).toContainText('192.0.2.10')
  await expect(password.locator('time')).toHaveCount(1)
  await password.getByRole('button', { name: 'Show details' }).click()
  const detail = page.getByRole('region', { name: /Details of Own password changed/ }).first()
  await expect(detail).toContainText('changed')
  await expect(detail).not.toContainText('generatedPassword')
  await expect(records(page).filter({ hasText: 'App password added' })).toHaveCount(1)
  await expect(page.getByRole('main')).not.toContainText('Unknown (')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US12 object History filters by its type and owning mailbox, context History shows every target', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('audit-self-service')
  await page.goto('mailboxes/anna@example.org/app-passwords/2')
  const history = page.getByRole('link', { name: 'History', exact: true })
  await expect(history).toHaveAttribute(
    'href',
    '/ng/audit-log?targetType=appPassword&targetId=anna@example.org',
  )
  await history.click()
  await expect(records(page)).toHaveCount(3)

  await page.goto('mailboxes/anna@example.org/temporary-aliases')
  const alias = page.locator('[data-entry="bavoki.rumesa@example.org"]')
  await alias.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/targetType=temporaryAlias&targetId=anna(?:@|%40)example.org$/)
  await expect(records(page)).toHaveCount(3)

  await page.goto('mailboxes/anna@example.org/recent-logins')
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page).toHaveURL(/\/audit-log\?targetId=anna(?:@|%40)example.org$/)
  await expect(records(page)).toHaveCount(24)
})

test('US12 domain administrators and mailbox users see no History action', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('audit-self-service', { signedInAs: 'reseller' })
  for (const path of [
    'mailboxes/anna@example.org',
    'mailboxes/anna@example.org/app-passwords/2',
    'mailboxes/anna@example.org/temporary-aliases',
    'mailboxes/anna@example.org/recent-logins',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  }
  await mockApi.use('audit-self-service', { signedInAs: 'anna@example.org' })
  for (const path of ['account/app-passwords/2', 'account/temporary-aliases']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  }
})

test('US12 both filter detail routes use the owning mailbox in administrator-only history', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('audit-self-service')
  for (const path of ['mailboxes/anna@example.org/filters/1', 'filters/1']) {
    await page.goto(path)
    await expect(page.locator('[data-filter-form]')).toBeVisible()
    await page.getByRole('link', { name: 'History', exact: true }).click()
    await expect(page).toHaveURL(/targetType=sieveFilter&targetId=anna(?:@|%40)example.org$/)
    await expect(records(page)).toHaveCount(3)
  }
  await mockApi.use('audit-self-service', { signedInAs: 'reseller' })
  for (const path of ['mailboxes/anna@example.org/filters/1', 'filters/1']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  }
})

test('US12 self-service targets are labelled and script size changes are text', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('audit-self-service')
  await page.goto('audit-log?targetType=sieveFilter&targetId=anna@example.org')
  await expect(records(page)).toHaveCount(3)
  const filter = records(page).filter({ hasText: 'Filter changed' })
  await filter.getByRole('button', { name: 'Show details' }).click()
  await expect(page.getByRole('region', { name: /Details of Filter changed/ })).toContainText(
    'script: changed (120 → 240 bytes)',
  )
  const toggle = page.getByRole('button', { name: 'Filters', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  const select = page.getByRole('form', { name: 'Filters' }).getByLabel('Target type')
  for (const value of [
    'accountPassword',
    'secondFactor',
    'recoveryEmail',
    'passwordReset',
    'appPassword',
    'temporaryAlias',
    'sieveFilter',
    'pushNotificationSettings',
    'mailSettings',
    'recentLogins',
    'groupwareData',
    'webmailHandOff',
  ]) {
    const option = select.locator(`option[value="${value}"]`)
    await expect(option).toHaveCount(1)
    expect(await option.textContent()).not.toContain('Unknown (')
  }
  await expectAccessible()
})
