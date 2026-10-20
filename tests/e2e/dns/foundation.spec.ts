// UI 010 foundation (T019, FR-001, research R2), updated for grouped navigation:
// ARC/DKIM keys are under Options; MTA-STS stays accessible only by its direct address.
import { isNarrow, openNavigation } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('DNS navigation', () => {
  for (const scenario of ['dns-admin', 'dns-domain-admin']) {
    test(`FR-001 ${scenario} reaches "ARC/DKIM keys" through Options while MTA-STS is hidden`, async ({
      page,
      mockApi,
      expectAccessible,
      expectNoHorizontalScroll,
    }) => {
      await mockApi.use(scenario)
      await page.goto('')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const navigation = await openNavigation(page)
      await expect(navigation.getByRole('link', { name: 'MTA-STS', exact: true })).toHaveCount(0)
      await navigation.getByRole('link', { name: 'Options', exact: true }).click()
      await expect(page).toHaveURL(/\/ng\/dns\/dkim-keys$/)
      await expect(page.getByRole('heading', { level: 1, name: 'ARC/DKIM keys' })).toBeVisible({
        timeout: FIRST_LOAD,
      })
      await expectAccessible()
      await expectNoHorizontalScroll()
    })
  }

  test('FR-001 a mailbox user sees neither entry and gets "no access" on the DKIM keys', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('mailbox-no-spam-flags')
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: FIRST_LOAD })
    const navigation = await openNavigation(page)
    await expect(navigation.getByRole('link', { name: 'Options', exact: true })).toHaveCount(0)
    await expect(navigation.getByRole('link', { name: 'MTA-STS', exact: true })).toHaveCount(0)
    if (isNarrow(page)) await page.keyboard.press('Escape')
    await page.goto('dns/dkim-keys')
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  })

  test('FR-001 /ng/dns redirects to the DKIM keys', async ({ page, mockApi }) => {
    await mockApi.use('dns-admin')
    await page.goto('dns')
    await expect(page).toHaveURL(/\/ng\/dns\/dkim-keys$/)
  })
})
