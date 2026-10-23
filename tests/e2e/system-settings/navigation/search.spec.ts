import { expect, test } from '../../fixtures/test'

test('the retired settings overview redirects to Options', async ({ page, mockApi }) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system')
  await expect(page).toHaveURL(/\/dns\/dkim-keys$/)
  await expect(page.locator('[data-settings-overview]')).toHaveCount(0)
  await expect(page.locator('[data-list-toolbar]')).toBeVisible()
})
