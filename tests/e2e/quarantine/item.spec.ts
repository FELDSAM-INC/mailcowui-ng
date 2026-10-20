import { expect, test } from '../fixtures/test'
import { openItem } from './helpers'

test('US1-AS2 item: inert message values, signed symbols, recipients and both text parts', async ({
  page,
  mockApi,
  guardRequests,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  void guardRequests
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine?q=script')
  await page.locator('[data-quarantine-item="11"]').getByRole('link').first().click()
  await expect(page.locator('[data-item="11"]')).toBeVisible()
  await expect(page.locator('[data-item-subject]')).toContainText('<script>alert(1)</script>')
  await expect(page.locator('[data-part="plain"]')).toContainText('https://phish.example/login')
  await expect(
    page.locator('[data-content] a, [data-content] img, [data-content] script'),
  ).toHaveCount(0)
  await expect(page.locator('[data-field="recipients"]')).toContainText('alice@example.org')
  await expect(page.locator('[data-recipient-source="envelope"]')).toContainText('SMTP')
  await expect(page.locator('[data-symbol-score]').first()).toContainText('+')
  await expect(page.locator('h1')).toBeFocused()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})

test('US1 item: text expansion, missing content and size-limited messages', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 14)
  const expand = page.locator('[data-part="plain"] button')
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expand.click()
  await expect(expand).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-part="plain"] [data-text]')).toContainText('60')
  await expand.click()
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await openItem(page, 9)
  await expect(page.locator('[data-parser-fallback]')).toContainText('Parser failed')
  await expect(page.locator('[data-part="plain"]')).toContainText('-')
  await openItem(page, 29)
  await expect(page.locator('[data-content]')).toHaveAttribute('data-content-status', 'tooLarge')
  await expect(page.locator('[data-too-large]')).toContainText('10')
  await expect(page.locator('[data-attachments]')).toHaveCount(0)
  await expect(page.locator('[data-item-action="download"]')).toHaveCount(0)
  await expectAccessible()
  await openItem(page, 10)
  await expect(page.locator('[data-content]')).toHaveAttribute('data-content-status', 'missing')
})

test('US1-AS9 item: attachment permission and safe hash lookup links', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 6)
  await expect(page.locator('[data-attachment]')).toHaveCount(2)
  const lookup = page.locator('[data-hash-lookup]').first()
  await expect(lookup).toHaveAttribute(
    'href',
    /^https:\/\/www\.virustotal\.com\/file\/[0-9a-f]{64}\/analysis\/$/,
  )
  await expect(lookup).toHaveAttribute('target', '_blank')
  await expect(lookup).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(lookup).toHaveAttribute('referrerpolicy', 'no-referrer')
  await expectAccessible()
  await mockApi.use('quarantine-user-no-attachments')
  await page.reload()
  await expect(page.locator('[data-attachments]')).toHaveCount(0)
  await expect(page.locator('#qitem-acl-quarantineAttachments')).toBeVisible()
})

test('FR-018 item: back restores the list filters, and foreign or unknown IDs are not found', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await page.goto('quarantine?virus=true')
  await page.locator('[data-quarantine-item="5"]').getByRole('link').first().click()
  await expect(page.locator('[data-item="5"]')).toBeVisible()
  await page.locator('[data-back-to-list]').click()
  await expect(page).toHaveURL(/quarantine\?virus=true$/)
  await page.goto('quarantine/31')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expectAccessible()
})
