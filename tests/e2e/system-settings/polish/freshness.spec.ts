import { expect, test } from '../../fixtures/test'
import { customizeLink } from './helpers'

test('T173 revisiting Customize pages within their freshness window uses cached settings', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('brand-colours-none')
  // Freeze Date, without pausing timers or events: query freshness cannot expire under CI load.
  await page.clock.setFixedTime(new Date())
  await page.goto('system/customize/colours')
  await expect(page.locator('#section-brand-colours')).toBeVisible()
  for (const [name, ready] of [
    ['UI labels and texts', '#section-names'],
    ['Login Page', '#section-sign-in-links'],
    ['Colours', '#section-brand-colours'],
    ['UI labels and texts', '#section-names'],
    ['Login Page', '#section-sign-in-links'],
  ]) {
    // Router navigation preserves the query client; full page.goto would invalidate this test.
    await customizeLink(page, name!)
    await expect(page.locator(ready!)).toBeVisible()
  }
  for (const operation of ['getBrandColors', 'getUiTexts', 'getLoginPageSettings'])
    expect(await mockApi.countRequests(operation), operation).toBe(1)
  await expectAccessible()
})
