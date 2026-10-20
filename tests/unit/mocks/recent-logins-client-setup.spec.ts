import { beforeEach, describe, expect, it } from 'vitest'
import { api, requireData } from '@/api'
import { mockState, useScenario } from '../../mocks/node'
import { recentLogin } from '../../mocks/factories/recent-login'
import { mailboxSelfService } from '../../mocks/scenarios/self-service/state'

describe('recent login contract mock', () => {
  beforeEach(() => {
    useScenario('account-mailbox')
  })
  const list = (query = {}) =>
    api.GET('/mailboxes/{mailbox}/recent-logins', {
      params: { path: { mailbox: 'anna@example.org' }, query },
    })
  it('defaults to seven days/newest first and filters service case-insensitively', async () => {
    const record = mailboxSelfService(mockState(), 'anna@example.org')
    record.recentLogins.push(
      recentLogin({
        service: 'DAV',
        clientAddress: '8.8.4.4',
        lastSeenAt: new Date(mockState().now() - 20 * 86_400_000).toISOString(),
      }),
    )
    expect(requireData(await list()).data).toHaveLength(3)
    const month = requireData(await list({ days: 31 }))
    expect(month.data).toHaveLength(4)
    expect(month.data.at(-1)?.service).toBe('DAV')
    expect(requireData(await list({ service: 'smtp' })).data[0]?.appPassword?.name).toBe('Phone')
    expect(requireData(await list({ q: '198.51' })).data).toHaveLength(1)
  })
  it('resolves deleted app names as null and clears all periods', async () => {
    const record = mailboxSelfService(mockState(), 'anna@example.org')
    record.appPasswords = record.appPasswords.filter((item) => item.id !== 2)
    expect(requireData(await list({ service: 'SMTP' })).data[0]?.appPassword?.name).toBeNull()
    await api.DELETE('/mailboxes/{mailbox}/recent-logins', {
      params: { path: { mailbox: 'anna@example.org' } },
    })
    expect(requireData(await list({ days: 31 })).data).toEqual([])
  })
  it('keeps other mailboxes out of reach and reports the shared store outage', async () => {
    await expect(
      api.GET('/mailboxes/{mailbox}/recent-logins', {
        params: { path: { mailbox: 'alice@example.org' } },
      }),
    ).rejects.toMatchObject({ status: 404 })
    mockState().selfService.outages.sharedStore = true
    await expect(list()).rejects.toMatchObject({
      status: 503,
      type: '/api/v2/problems/temporary-failure',
    })
  })
})
describe('client setup and Apple profile contract mock', () => {
  beforeEach(() => {
    useScenario('account-mailbox')
  })
  it('returns published ports and excludes groupware when disabled', async () => {
    mockState().selfService.groupwareEnabled = false
    const data = requireData(await api.GET('/me/mailbox/client-configuration')).data
    expect(data.imap).toMatchObject({ tlsPort: 993, starttlsPort: 143 })
    expect(data.caldav).toBeNull()
    expect(data.carddav).toBeNull()
    expect(data.activeSync).toBeNull()
    await expect(
      api.GET('/me/mailbox/apple-profile', {
        params: { query: { variant: 'emailAndDav' } },
        parseAs: 'blob',
      }),
    ).rejects.toMatchObject({ status: 403, type: '/api/v2/problems/groupware-disabled' })
  })
  it('downloads a no-store profile; a POST creates exactly one listed app password', async () => {
    const regular = await api.GET('/me/mailbox/apple-profile', {
      params: { query: { variant: 'email' } },
      parseAs: 'blob',
    })
    expect(regular.response.headers.get('content-type')).toContain(
      'application/x-apple-aspen-config',
    )
    expect(regular.response.headers.get('cache-control')).toBe('no-store')
    expect(regular.response.headers.get('content-disposition')).toContain('.mobileconfig')
    const record = mailboxSelfService(mockState(), 'anna@example.org')
    const before = record.appPasswords.length
    const created = await api.POST('/me/mailbox/apple-profile', {
      body: { variant: 'email', appPasswordName: 'Test profile' },
      parseAs: 'blob',
    })
    expect(created.response.status).toBe(201)
    expect(created.response.headers.get('location')).toContain('/app-passwords/')
    expect(record.appPasswords).toHaveLength(before + 1)
    expect(record.appPasswords.at(-1)?.name).toBe('Test profile')
    expect(await (created.data as unknown as Blob).text()).toContain('IncomingPassword')
  })
  it('refuses app password creation without the flag but still permits plain profiles', async () => {
    mockState().accounts.find(
      (account) => account.username === 'anna@example.org',
    )!.permissions.appPasswds = false
    await expect(
      api.POST('/me/mailbox/apple-profile', { body: { variant: 'email' }, parseAs: 'blob' }),
    ).rejects.toMatchObject({ status: 403, type: '/api/v2/problems/permission-flag-required' })
    expect(
      (
        await api.GET('/me/mailbox/apple-profile', {
          params: { query: { variant: 'email' } },
          parseAs: 'blob',
        })
      ).response.status,
    ).toBe(200)
  })
})
