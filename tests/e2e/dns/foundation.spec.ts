// UI 010 foundation (T019, FR-001, research R2): the two DNS navigation entries for administrators
// and domain administrators, none for mailbox users, the /dns redirect, and the layout checks.
import { expect, test } from '../fixtures/test'
import { isNarrow, openNavigation } from '../fixtures/flows'

test.describe('DNS navigation', () => {
  for (const scenario of ['dns-admin', 'dns-domain-admin']) {
    test(`FR-001 ${scenario} sees "ARC/DKIM keys" and "MTA-STS" in the navigation`, async ({
      page,
      mockApi,
      expectAccessible,
      expectNoHorizontalScroll,
    }) => {
      await mockApi.use(scenario)
      await page.goto('')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const navigation = await openNavigation(page)
      await expect(navigation.getByRole('link', { name: 'ARC/DKIM keys' })).toBeVisible()
      await expect(navigation.getByRole('link', { name: 'MTA-STS', exact: true })).toBeVisible()
      await navigation.getByRole('link', { name: 'ARC/DKIM keys' }).click()
      await expect(page).toHaveURL(/\/ng\/dns\/dkim-keys$/)
      await expect(page.getByRole('heading', { level: 1, name: 'ARC/DKIM keys' })).toBeVisible()
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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const navigation = await openNavigation(page)
    await expect(navigation.getByRole('link', { name: 'ARC/DKIM keys' })).toHaveCount(0)
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
