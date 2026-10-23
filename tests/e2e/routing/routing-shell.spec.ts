// UI 009 T015, the Routing section's shell (FR-001, FR-002): the index lists the six screens by the
// classic interface's tab names for administrators and leads to the section navigation; every
// domain administrator goes straight to the BCC maps, with or without the BCC maps permission; a
// mailbox user gets "no access" and no routing request.
import { expect, test } from '../fixtures/test'
import { listReady } from './helpers'

test.describe('routing shell', () => {
  test('the old Routing address opens BCC maps and exposes only email routing tabs', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await mockApi.use('routing-admin-default')
    await page.goto('routing')
    await expect(page).toHaveURL(/routing\/bcc-maps$/)
    await listReady(page)
    const nav = page.getByRole('navigation', { name: 'Routing', exact: true })
    await expect(nav.getByRole('button')).toHaveCount(0)
    await expect(nav.getByRole('link')).toHaveText([
      'BCC maps',
      'Recipient maps',
      'TLS policy maps',
    ])
    await nav.getByRole('link', { name: 'Recipient maps', exact: true }).click()
    await expect(page).toHaveURL(/routing\/recipient-maps$/)
    await expectAccessible()
    await expectTouchTargets()
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
