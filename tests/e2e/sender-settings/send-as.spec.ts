// UI 004 US5, "Allow to send as" and "External sender addresses" (T071), in their legacy positions
// in UI 003's "Mailbox" section (orchestrator, 2026-10-19; legacy form map part 3, item 1): legacy's
// labels and subtexts, the entries a domain administrator cannot change, the aliases that deliver
// to the mailbox, the server-searched options, the legacy hints and the domain administrator's view.
import { SENDER_004 } from '../../mocks/scenarios/sender-settings'
import { expect, test } from '../fixtures/test'
import { choose, entry, MAILBOX_PAGE, openMailboxSection, options, picker } from './helpers'

test.describe('send as', () => {
  test('FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('sender-settings')
    await page.goto(MAILBOX_PAGE)
    const value = page.locator('[data-value="senderAcl"]')
    await expect(value).toContainText('Allow to send as')
    await expect(value).toContainText(
      'Disable sender check for domain example.com (+ alias domains)',
    )
    await expect(value).toContainText('sales@example.org')
    await expect(page.locator('[data-value="externalSenderAddresses"]')).toContainText(
      'news@mailer.example',
    )
    await openMailboxSection(page)
    await expect(entry(page, SENDER_004.explicitDomain)).toContainText(
      'Disable sender check for domain example.com (+ alias domains)',
    )
    await expect(entry(page, SENDER_004.allowedAlias).locator('[data-subtext]')).toHaveText(
      'Alias (allowed)',
    )
    await expect(entry(page, SENDER_004.allowedAlias).getByRole('button')).toHaveCount(0)
    await expect(entry(page, SENDER_004.catchAll)).toHaveCount(0)
    await expect(entry(page, SENDER_004.aliasDomainAddress)).toHaveCount(0)
    await expect(
      page.getByText('This behaviour does not apply to alias addresses.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByLabel('External sender addresses')).toHaveValue(
      '@partner.example, news@mailer.example',
    )
    await expect(
      page.getByText('A DKIM domain key should be imported, if available.', { exact: false }),
    ).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
  })

  test('US5-AS8 a stale entry says so and an administrator can remove it; the blocked alias is an option', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sender-settings')
    await openMailboxSection(page)
    const stale = entry(page, SENDER_004.stale)
    await expect(stale.locator('[data-subtext]')).toHaveText('No longer exists')
    await stale.getByRole('button', { name: /^Remove/ }).click()
    await expect(stale).toHaveCount(0)
    await picker(page).click()
    const blocked = options(page).filter({ hasText: 'info@example.org' })
    await expect(blocked).toContainText('Alias (blocked)')
    await expectAccessible()
  })

  test('US5-AS4 US5-AS5 US5-AS6 the domain administrator: an entry it cannot change, no "*", no external addresses', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings-da')
    await page.goto(MAILBOX_PAGE)
    await expect(page.locator('[data-value="externalSenderAddresses"]')).toHaveCount(0)
    await openMailboxSection(page)
    const outside = entry(page, SENDER_004.outsideScope)
    await expect(outside.locator('[data-subtext]')).toHaveText('Admin')
    await expect(outside.getByRole('button')).toHaveCount(0)
    await expect(page.getByLabel('External sender addresses')).toHaveCount(0)
    await picker(page).click()
    await expect(options(page).first()).toBeVisible()
    const reads = (await mockApi.requests()).filter(
      (r) => r.operationId === 'listSenderPermissionCandidates',
    )
    expect(reads.length).toBeGreaterThan(0)
    const query = new URL(reads.at(-1)!.path, 'http://x').searchParams
    expect(query.getAll('type')).toEqual(['address', 'domain'])
    expect(query.get('mailbox')).toBe(SENDER_004.mailbox)
    await expect(options(page).filter({ hasText: 'domain * ' })).toHaveCount(0)
  })

  test('Edge: "any address" set by an administrator is shown to the domain administrator as not changeable', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings-any-da')
    await openMailboxSection(page)
    const any = entry(page, '*')
    await expect(any).toContainText('Disable sender check for domain * (+ alias domains)')
    await expect(any.locator('[data-subtext]')).toHaveText('Admin')
    await expect(page.locator('[data-sender-check-disabled]')).toHaveText(
      'Sender check is disabled',
    )
  })

  test('US5-AS9 FR-050 5,000 candidates are searched by the server and load on demand', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sender-settings-5000')
    await openMailboxSection(page)
    await picker(page).click()
    await picker(page).fill('sales')
    await expect(options(page).filter({ hasText: 'sales0001@example.com' })).toBeVisible()
    await expect(options(page)).toHaveCount(25)
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(options(page)).toHaveCount(50)
    const reads = (await mockApi.requests()).filter(
      (r) => r.operationId === 'listSenderPermissionCandidates',
    )
    for (const read of reads) expect(read.path).toContain('limit=25')
    await choose(page, 'sales0002', /sales0002@example\.com/)
    await expect(entry(page, 'sales0002@example.com')).toBeVisible()
  })
})
