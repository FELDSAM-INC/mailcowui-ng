import { expect, test } from '../../fixtures/test'

test('API Keys and System & Containers open their contextual settings by keyboard', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('api-keys')
  const cors = page.locator('main a[href="/ng/system/cors"]')
  await cors.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/system\/cors$/)
  await expect(page.locator('main h1')).toBeVisible()
  await expectNoHorizontalScroll()

  await page.goto('operations/dashboard')
  const license = page.locator('main a[href="/ng/system/license"]')
  await license.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/system\/license$/)
  await expect(page.locator('main h1')).toBeVisible()
  await expectNoHorizontalScroll()
})

test('System & Containers omits the disabled License destination without reading its status', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-license-disabled')
  await page.goto('operations/dashboard')
  await expect.poll(() => mockApi.countRequests('getSettingsCapabilities')).toBe(1)
  await expect(page.locator('main a[href="/ng/system/license"]')).toHaveCount(0)
  expect(await mockApi.countRequests('getLicenseStatus')).toBe(0)
})
