// UI 009 US9, the change history of routing entries (T111, FR-064, research R18): History on every
// kind of entry and in the relayhost field of the Domain and Mailbox sections opens UI 001's audit
// log filtered by the entry's target; "History of this source" on the filtered forwarding host
// list; domain administrators, who may not open the audit log, are never offered History.
import type { Page } from '@playwright/test'

import { ROUTING_SCREENS, type RoutingScreenId } from '../../../src/features/routing/screens'
import { expect, test } from '../fixtures/test'
import { entry, listReady } from './helpers'
import { clickRowAction } from '../fixtures/row-actions'

async function expectAuditFilter(page: Page, targetType: string, targetId: string) {
  await expect(page).toHaveURL(/\/ng\/audit-log\?/)
  const query = new URL(page.url()).searchParams
  expect(query.get('targetType')).toBe(targetType)
  expect(query.get('targetId')).toBe(targetId)
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible()
}

const available = (id: RoutingScreenId) =>
  ROUTING_SCREENS.find((screen) => screen.id === id)?.status === 'available'

const CASES: {
  screen: RoutingScreenId
  path: string
  id: string
  targetType: string
}[] = [
  {
    screen: 'relayhosts',
    path: 'routing/relayhosts',
    id: '1',
    targetType: 'relayhost',
  },
  {
    screen: 'transports',
    path: 'routing/transports',
    id: '1',
    targetType: 'transport',
  },
  {
    screen: 'bccMaps',
    path: 'routing/bcc-maps',
    id: '1',
    targetType: 'bccMap',
  },
  {
    screen: 'recipientMaps',
    path: 'routing/recipient-maps',
    id: '1',
    targetType: 'recipientMap',
  },
  {
    screen: 'tlsPolicyMaps',
    path: 'routing/tls-policy-maps',
    id: '1',
    targetType: 'tlsPolicyMap',
  },
  {
    screen: 'forwardingHosts',
    path: 'routing/forwarding-hosts',
    id: '192.0.2.0/24',
    targetType: 'forwardingHost',
  },
]

test.describe('routing history', () => {
  for (const item of CASES) {
    test(`US9-AS1 FR-064 ${item.targetType} rows omit History and editable entries keep it on their form`, async ({
      page,
      mockApi,
    }) => {
      test.skip(!available(item.screen), `${item.screen} is pending`)
      await mockApi.use('routing-admin-default')
      await page.goto(item.path)
      await listReady(page)
      await expect(entry(page, item.id).getByRole('link', { name: /History/ })).toHaveCount(0)
      if (item.screen === 'forwardingHosts') return
      await clickRowAction(page, entry(page, item.id), /^Edit:/)
      await page.getByRole('main').getByRole('link', { name: 'History', exact: true }).click()
      await expectAuditFilter(page, item.targetType, item.id)
    })
  }

  test('FR-064 History of this source uses the forwarding host target and the source', async ({
    page,
    mockApi,
  }) => {
    test.skip(!available('forwardingHosts'), 'forwardingHosts is pending')
    await mockApi.use('routing-admin-default')
    await page.goto('routing/forwarding-hosts?source=forwarder.example')
    await listReady(page)
    await page.getByRole('link', { name: 'History of this source' }).click()
    await expectAuditFilter(page, 'forwardingHost', 'forwarder.example')
  })

  test('US9-AS2 History at the relayhost of a mailbox and of a domain uses the assignment targets', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-assignments')
    await page.goto('mailboxes/alice@example.org?edit=mailbox')
    await page
      .locator('[data-relayhost-field]')
      .getByRole('link', { name: 'History: Sender-dependent transports' })
      .click()
    await expectAuditFilter(page, 'mailboxRelayhostAssignment', 'alice@example.org')
    await page.goto('domains/example.org?edit=domain')
    await page
      .locator('[data-relayhost-field]')
      .getByRole('link', { name: 'History: Sender-dependent transports' })
      .click()
    await expectAuditFilter(page, 'domainRelayhostAssignment', 'example.org')
  })

  test('US9-AS3 domain administrators are offered no History on BCC maps or at the relayhost', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('routing-da-bcc')
    await page.goto('routing/bcc-maps')
    await listReady(page)
    await expect(entry(page, 1)).toBeVisible()
    await expect(page.locator('a[href*="audit-log"]')).toHaveCount(0)
    await page.goto('domains/example.org?edit=domain')
    await expect(page.locator('[data-relayhost-field]')).toBeVisible()
    await expect(page.locator('[data-relayhost-field] a[href*="audit-log"]')).toHaveCount(0)
    await page.goto('mailboxes/alice@example.org?edit=mailbox')
    await expect(page.locator('[data-relayhost-field]')).toBeVisible()
    await expect(page.locator('[data-relayhost-field] a[href*="audit-log"]')).toHaveCount(0)
  })
})
