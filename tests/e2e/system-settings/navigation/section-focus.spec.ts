import { expect, test } from '../../fixtures/test'

test('FR-007 direct reset-email link waits for its section heading and clears the sticky header', async ({
  page,
  mockApi,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('password-reset-available')
  await page.route('**/api/v2/settings/password-reset-notification', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.continue()
  })
  await page.goto('system/password-reset-email')
  await expect(page).toHaveURL(/password-policy#password-reset-email$/)
  const heading = page.locator('#password-reset-email').getByRole('heading', { level: 2 })
  await expect(heading).toBeFocused()
  const position = await heading.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    padding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  }))
  expect(position.top).toBeGreaterThanOrEqual(position.padding - 1)
  await page.keyboard.press('Tab')
  await expect(
    page.locator('#password-reset-email').getByRole('link', { name: 'History', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Edit Password Recovery Settings', exact: true }),
  ).toBeFocused()
  await expectNoHorizontalScroll()
})

test('FR-007 an unknown fragment falls back to the page heading and another page retains normal focus', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('password-reset-available')
  await page.goto('system/password-policy#unknown-section')
  await expect(page.getByRole('heading', { level: 1, name: 'Password Settings' })).toBeFocused({
    timeout: 6000,
  })
  const tabs = page.locator('[data-section-navigation]')
  if (await tabs.getByRole('button').isVisible()) await tabs.getByRole('button').click()
  await tabs.getByRole('link', { name: 'Quota notifications', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Quota notifications' })).toBeFocused()
})
