// UI 009 T015, the Routing section's shell (FR-001, FR-002): the index lists the six screens by the
// classic interface's tab names for administrators and leads to the section navigation; every
// domain administrator goes straight to the BCC maps, with or without the BCC maps permission; a
// mailbox user gets "no access" and no routing request.
import { expect, test } from '../fixtures/test'
import { isNarrow, listReady } from './helpers'

const SCREENS = [
  'Sender-dependent transports',
  'Transport Maps',
  'TLS policy maps',
  'Recipient maps',
  'BCC maps',
  'Forwarding Hosts',
]

test.describe('routing shell', () => {
  test('FR-001 an administrator opens the index and moves between the screens', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing')
    await expect(page.getByRole('heading', { level: 1, name: 'Routing' })).toBeVisible()
    const index = page.locator('[data-routing-index]')
    await expect(index.getByRole('link')).toHaveText(SCREENS)
    await expectAccessible()
    await expectTouchTargets()
    await expectNoHorizontalScroll()

    await index.getByRole('link', { name: 'Transport Maps' }).click()
    await expect(page).toHaveURL(/routing\/transports$/)
    await listReady(page)
    const nav = page.getByRole('navigation', { name: 'Routing' })
    if (isNarrow(page)) {
      const toggle = nav.getByRole('button')
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
    }
    await expect(nav.getByRole('link', { name: 'Transport Maps' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await nav.getByRole('link', { name: 'Forwarding Hosts' }).click()
    await expect(page).toHaveURL(/routing\/forwarding-hosts$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Forwarding Hosts' })).toBeVisible()
    await expectNoHorizontalScroll()
  })

  for (const scenario of ['routing-da-bcc', 'routing-da-readonly']) {
    test(`FR-002 a domain administrator goes straight to the BCC maps (${scenario})`, async ({
      page,
      mockApi,
    }) => {
      await mockApi.use(scenario)
      await page.goto('routing')
      await expect(page).toHaveURL(/routing\/bcc-maps$/)
      await expect(page.getByRole('heading', { level: 1, name: 'BCC maps' })).toBeVisible()
      await listReady(page)
      await expect(page.getByRole('navigation', { name: 'Routing' })).toHaveCount(0)
    })
  }

  test('FR-002 a mailbox user gets "no access" and no routing request', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('routing-mailbox-user')
    await page.goto('routing')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    await expectAccessible()
    const routing = (await mockApi.requests()).filter((item) =>
      /Relayhost|Transport|BccMap|BccDestination|RecipientMap|TlsPolicyMap|ForwardingHost|RoutingCapabilities/.test(
        item.operationId ?? '',
      ),
    )
    expect(routing).toEqual([])
  })
})
