import { expect, it } from 'vitest'
import {
  applyMailboxMailSettingsBulk,
  mailSettingsBulkRequest,
} from '@/features/account/api/bulk-mail-settings'
import { confirmationOf } from '@/features/mailboxes/bulk'
import { fetchMailboxes } from '@/features/mailboxes/api'
import { mockState, useScenario } from '../../../mocks/node'
import { testPlugins } from '../../support/mount'

it('D6 has four immediate TLS actions and each target carries mailSettingsVersion', () => {
  for (const direction of ['inbound', 'outbound'] as const) {
    for (const enabled of [true, false]) {
      expect(confirmationOf({ action: 'setTlsEnforcement', direction, enabled })).toBe('none')
    }
  }
  expect(
    mailSettingsBulkRequest('outbound', true, [
      { address: 'alice@example.org', mailSettingsVersion: '"mail-settings"' },
    ]),
  ).toEqual({
    action: 'setTlsEnforcement',
    tlsEnforceOutbound: true,
    targets: [{ id: 'alice@example.org', version: '"mail-settings"' }],
  })
})
it('returns one result per distinct mailbox, with missing and outdated versions and the capability limit', async () => {
  useScenario('mailbox-list-tls')
  const boxes = (await fetchMailboxes({ limit: 100 })).data
  expect(boxes).toHaveLength(30)
  const changed = mockState().mailboxes[0]!
  changed.tlsEnforceInbound = !changed.tlsEnforceInbound
  mockState().mailboxes.pop()
  const client = testPlugins().queryClient
  const result = await applyMailboxMailSettingsBulk(
    client,
    mailSettingsBulkRequest('outbound', true, boxes),
  )
  expect(result.summary).toMatchObject({ total: 30, done: 28, outdated: 1, notFound: 1 })
  mockState().selfService.capabilities.bulkLimit = 2
  await expect(
    applyMailboxMailSettingsBulk(client, mailSettingsBulkRequest('inbound', true, boxes)),
  ).rejects.toMatchObject({ status: 422 })
})
