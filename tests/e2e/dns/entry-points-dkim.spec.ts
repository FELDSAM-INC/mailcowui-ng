// UI 010 US1, the DKIM section of the domain page (T033, FR-021): the key's state, selector, length
// and record with copy buttons, the link to the entry, the DKIM keys of the domain and its alias
// domains, "no key", and the same for a domain administrator. The alias domain page belongs to UI
// 004, which mounts the exported section there.
import { expect, test } from '../fixtures/test'
import { FIRST_LOAD } from './helpers'

test.describe('DKIM section on the domain page', () => {
  test('FR-021 the section of example.org leads to its entry and to its keys', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('domains/example.org')
    const section = page.locator('#section-dkim')
    await expect(section.getByRole('heading', { level: 2, name: 'ARC/DKIM keys' })).toBeVisible({
      timeout: FIRST_LOAD,
    })
    await expect(section).toContainText('Key valid')
    await expect(section).toContainText('Domain: example.org (dkim._domainkey)')
    await expect(section).toContainText('2,048')
    await expect(
      section.getByRole('button', { name: 'Copy record value of example.org' }),
    ).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
    await section
      .getByRole('link', { name: 'DKIM keys of this domain and its alias domains' })
      .click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\?domain=example\.org$/)
    await page.goBack()
    await page
      .locator('#section-dkim')
      .getByRole('link', { name: 'Details of the DKIM key' })
      .click()
    await expect(page).toHaveURL(/\/dns\/dkim-keys\/example\.org$/)
  })

  test('FR-021 a domain without a key says that its mail is not signed', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('dns-admin')
    await page.goto('domains/example.net')
    const section = page.locator('#section-dkim')
    await expect(section).toContainText('Key missing')
    await expect(section).toContainText('Its mail is not signed')
  })

  test('FR-021 a domain administrator sees the same section', async ({ page, mockApi }) => {
    await mockApi.use('dns-domain-admin')
    await page.goto('domains/example.org')
    const section = page.locator('#section-dkim')
    await expect(section).toContainText('Key valid')
    await expect(section.getByRole('link', { name: 'Details of the DKIM key' })).toBeVisible()
  })
})
