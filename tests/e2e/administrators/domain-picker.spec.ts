import { expect, test } from '../fixtures/test'
import { pickDomain } from '../../support/domain-picker'

test('FR-013 mobile stages a paged domain selection and sends ASCII names only after Done', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile-'), 'The staged dialog is the phone presentation')
  await mockApi.use('domain-admins-many')
  await page.goto('administrators/domain-admins/-/new')
  const trigger = page.locator('#account-create-domains')
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('[data-picker-search]')).toBeFocused()
  await expect(dialog.getByRole('checkbox')).toHaveCount(25)
  expect(await dialog.boundingBox()).toMatchObject({ x: 0, y: 0, width: 360, height: 780 })
  await dialog.getByRole('checkbox', { name: 'domain-0000.example', exact: true }).check()
  await dialog.getByRole('button', { name: 'Load more', exact: true }).click()
  await expect(dialog.getByRole('checkbox')).toHaveCount(50)
  await dialog.getByRole('checkbox', { name: 'domain-0025.example', exact: true }).check()
  await dialog.locator('[data-picker-search]').fill('domain-2999')
  await expect(dialog.getByRole('checkbox')).toHaveCount(1)
  await dialog.getByRole('checkbox', { name: 'domain-2999.example', exact: true }).check()
  await expect(page.locator('[data-picker-chips]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('[data-picker-chips] > li')).toHaveCount(3)
  await trigger.click()
  await dialog.getByRole('checkbox', { name: 'domain-0000.example', exact: true }).uncheck()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('[data-picker-chips] > li')).toHaveCount(3)
  await trigger.click()
  await dialog.getByRole('checkbox', { name: 'domain-0000.example', exact: true }).uncheck()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('[data-picker-chips] > li')).toHaveCount(3)
  await page.locator('input[name="accountUsername"]').fill('paged-owner')
  await page.locator('[data-generate]').click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/domain-admins\/paged-owner$/)
  const calls = await mockApi.requests()
  const lists = calls.filter((request) => request.operationId === 'listDomains')
  expect(lists.every((request) => request.path.includes('limit=25'))).toBe(true)
  expect(lists.some((request) => request.path.includes('offset=25'))).toBe(true)
  expect(calls.find((request) => request.operationId === 'createDomainAdmin')?.body).toMatchObject({
    domains: ['domain-0000.example', 'domain-0025.example', 'domain-2999.example'],
  })
})

test('FR-013 mobile domain search recovers from failure and reports no matches', async ({
  page,
  mockApi,
  expectAccessible,
  expectTouchTargets,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile-'), 'The staged dialog is the phone presentation')
  await mockApi.use('domain-admins-three')
  await mockApi.failNext('listDomains', { status: 500 })
  await page.goto('administrators/domain-admins/-/new')
  await page.locator('#account-create-domains').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('The list could not be loaded')
  await expectAccessible()
  await expectTouchTargets()
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(dialog.getByRole('checkbox')).toHaveCount(2)
  await dialog.locator('[data-picker-search]').fill('does-not-exist')
  await expect(dialog.getByRole('status')).toHaveText('No matching records found')
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
})

test('FR-016 names a removed domain on its chip and preserves the other selection and password', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('domain-admins-three')
  await page.goto('administrators/domain-admins/-/new')
  await page.locator('input[name="accountUsername"]').fill('removed-domain-owner')
  await pickDomain(page, 'account-create-domains', 'example.net')
  await pickDomain(page, 'account-create-domains', 'example.org')
  await page.locator('[data-generate]').click()
  const password = await page.locator('input[autocomplete="new-password"]').first().inputValue()
  await mockApi.removeDomain('example.net')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const failedChip = page
    .locator('[data-picker-chips] > li')
    .filter({ has: page.getByRole('button', { name: 'Remove example.net', exact: true }) })
  await expect(failedChip).toContainText('Domain name is empty or invalid')
  await expect(failedChip.getByRole('button')).toBeFocused()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await failedChip.getByRole('button').click()
  await expect(page.locator('[data-picker-item-errors]')).toHaveCount(0)
  await expect(page.locator('[data-picker-chips]')).toHaveText('example.org')
  await expect(page.locator('input[autocomplete="new-password"]').first()).toHaveValue(password)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/domain-admins\/removed-domain-owner$/)
})
