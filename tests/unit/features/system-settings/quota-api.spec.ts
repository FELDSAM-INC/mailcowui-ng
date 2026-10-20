import { describe, expect, it } from 'vitest'
import { api, requireData } from '@/api'
import {
  updateQuotaNotification,
  updateQuotaCopies,
} from '@/features/system-settings/api/notifications'
import { mockState, useScenario } from '../../../mocks/node'
import { mockDomain } from '../../../mocks/factories/domain'

describe('quota contract round trips', () => {
  it('keeps independent defaults and refuses an explicitly custom localhost sender like the API', async () => {
    useScenario('quota-defaults')
    const before = requireData(await api.GET('/settings/quota-notification')).data
    expect(before.senderIsDefault).toBe(true)
    const after = await updateQuotaNotification({ subject: 'Storage warning' }, before.etag)
    expect(after).toMatchObject({
      sender: 'quota-warning@localhost',
      senderIsDefault: true,
      subjectIsDefault: false,
    })
    await expect(
      updateQuotaNotification({ sender: 'quota-warning@localhost' }, after.etag),
    ).rejects.toMatchObject({ status: 422 })
    const reset = await updateQuotaNotification({ subject: '' }, after.etag)
    expect(reset.subjectIsDefault).toBe(true)
  })
  it('rejects out-of-scope and alias domains, preserves copies after domain removal and recreation', async () => {
    useScenario('quota-copies-example-org')
    const read = (domain: string) =>
      api.GET('/domains/{domain}/quota-notification-recipients', { params: { path: { domain } } })
    await expect(read('example.net')).rejects.toMatchObject({ status: 404 })
    await expect(read('alias.example.org')).rejects.toMatchObject({ status: 404 })
    const before = requireData(await read('example.org')).data
    await updateQuotaCopies(
      'example.org',
      { recipients: ['IT@example.org', 'it@example.org'], active: true },
      before.etag,
    )
    mockState().domains = mockState().domains.filter((domain) => domain.name !== 'example.org')
    await expect(read('example.org')).rejects.toMatchObject({ status: 404 })
    mockState().domains.push(mockDomain({ name: 'example.org' }))
    expect(requireData(await read('example.org')).data).toMatchObject({
      recipients: ['IT@example.org'],
      active: true,
    })
  })
  it('rejects stale writes and makes an empty active list inactive', async () => {
    useScenario('quota-defaults')
    await expect(
      updateQuotaCopies('example.org', { active: true }, '"stale"'),
    ).rejects.toMatchObject({ status: 412 })
    const data = requireData(
      await api.GET('/domains/{domain}/quota-notification-recipients', {
        params: { path: { domain: 'example.org' } },
      }),
    ).data
    expect(
      await updateQuotaCopies('example.org', { active: true, recipients: [] }, data.etag),
    ).toMatchObject({ active: false, recipients: [] })
  })
})
