import { describe, expect, it } from 'vitest'
import {
  fetchPushSettings,
  replacePushSettings,
  verifyPushSettings,
  deletePushSettings,
} from '@/features/account/api/push-notifications'
import { mockState, useScenario } from '../../../mocks/node'
import { testPlugins } from '../../support/mount'

const mailbox = 'anna@example.org'
const fields = {
  title: '',
  text: '',
  senders: [],
  senderPattern: '',
  sound: 'pushover',
  active: true,
  evaluatePriority: false,
  onlyHighPriority: false,
}
describe('Pushover settings', () => {
  it('never reads credentials, preserves omitted credentials and enforces versions', async () => {
    useScenario('pushover-configured')
    const stored = await fetchPushSettings(mailbox)
    expect(stored).toMatchObject({ configured: true, tokenSet: true, userKeySet: true })
    expect(stored).not.toHaveProperty('token')
    expect(stored).not.toHaveProperty('userKey')
    const changed = await replacePushSettings(mailbox, { ...fields, title: 'Shop' }, stored.etag)
    expect(changed).toMatchObject({ title: 'Shop', tokenSet: true, userKeySet: true })
    expect(mockState().selfService.mailboxes[mailbox]!.push?.token).toBe('a'.repeat(30))
    await expect(replacePushSettings(mailbox, fields, stored.etag)).rejects.toMatchObject({
      status: 412,
    })
    await deletePushSettings(testPlugins().queryClient, mailbox, changed.etag)
    expect(await fetchPushSettings(mailbox)).toMatchObject({ configured: false, tokenSet: false })
  })
  it('requires missing secrets and handles verification refusals and outages', async () => {
    useScenario('pushover-unconfigured')
    const stored = await fetchPushSettings(mailbox)
    await expect(replacePushSettings(mailbox, fields, stored.etag)).rejects.toMatchObject({
      status: 422,
    })
    await expect(verifyPushSettings(testPlugins().queryClient, mailbox)).rejects.toMatchObject({
      status: 409,
    })
    const changed = await replacePushSettings(
      mailbox,
      { ...fields, token: 'a'.repeat(30), userKey: 'b'.repeat(30) },
      stored.etag,
    )
    expect(changed.configured).toBe(true)
    mockState().selfService.pushVerification = { accepted: false, reason: 'Unknown user' }
    expect(await verifyPushSettings(testPlugins().queryClient, mailbox)).toEqual({
      accepted: false,
      reason: 'Unknown user',
    })
    mockState().selfService.outages.pushover = true
    await expect(verifyPushSettings(testPlugins().queryClient, mailbox)).rejects.toMatchObject({
      status: 503,
    })
    useScenario('account-domain-admin-no-flags')
    await expect(replacePushSettings(mailbox, fields, '"po-none"')).rejects.toMatchObject({
      status: 403,
    })
  })
})
