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

test('T173 saving a rule refreshes the cached effective map during in-app navigation', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  // Four screens each run the complete four-palette accessibility fixture.
  test.setTimeout(90_000)
  await mockApi.use('rspamd-rules-30')
  // Keep the 30-second freshness window open throughout accessibility checks. A new map read
  // must come from the mutation's invalidation, not from elapsed time or a fresh document.
  await page.clock.setFixedTime(new Date())
  await page.goto('system/rspamd-effective-map')
  const editor = page.locator('#effective-settings-map')
  await expect(editor).toHaveValue(/EXAMPLE_1"/)
  expect(await mockApi.countRequests('getEffectiveRspamdSettingsMap')).toBe(1)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()

  const rulesLink = page
    .getByRole('main')
    .getByRole('link', { name: 'Rspamd settings map', exact: true })
    .last()
  await rulesLink.click()
  await page.getByRole('link', { name: 'Active settings map', exact: true }).click()
  await expect(editor).toHaveValue(/EXAMPLE_1"/)
  expect(await mockApi.countRequests('getEffectiveRspamdSettingsMap')).toBe(1)

  await rulesLink.click()
  await expect(page.locator('[data-rule-id="1"]')).toBeVisible()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page
    .locator('[data-rule-id="1"]')
    .getByRole('link', { name: 'Edit: Rule 01', exact: true })
    .click()
  await page.locator('#rule-content').fill('apply { symbols = ["UPDATED_FRESHNESS_RULE"]; }')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-rule-saved]')).toBeVisible()
  expect(await mockApi.countRequests('updateRspamdSettingsRule')).toBe(1)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()

  await rulesLink.click()
  await page.getByRole('link', { name: 'Active settings map', exact: true }).click()
  await expect(editor).toHaveValue(/UPDATED_FRESHNESS_RULE/)
  await expect(editor).not.toHaveValue(/EXAMPLE_1"/)
  expect(await mockApi.countRequests('getEffectiveRspamdSettingsMap')).toBe(2)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})
