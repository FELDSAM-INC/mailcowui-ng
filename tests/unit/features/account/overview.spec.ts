import { beforeAll, describe, expect, it } from 'vitest'

import { ApiProblem, api, requireData } from '@/api'
import { fetchOwnMailboxOverview } from '@/features/account/api/overview'
import { createWebmailHandOff } from '@/features/account/api/webmail'
import QuotaUsage from '@/features/account/components/overview/QuotaUsage.vue'
import { Badge } from '@/shared/ui/badge'
import ProtocolAccessList from '@/features/account/components/overview/ProtocolAccessList.vue'
import AddressLists from '@/features/account/components/overview/AddressLists.vue'
import { loadLegacy } from '@/i18n/legacy'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))

describe('mailbox overview', () => {
  it('keeps legacy used/quota, a labelled progress bar and locale message counts', () => {
    const wrapper = mountWithApp(QuotaUsage, {
      props: {
        quota: {
          usedBytes: 256 * 1024 ** 2,
          quotaBytes: 1024 ** 3,
          percentUsed: 25,
          messages: 1234,
        },
      },
    })
    expect(wrapper.text()).toContain('256 MiB / 1 GiB')
    expect(wrapper.text()).toContain('1,234 messages')
    expect(wrapper.get('[role=progressbar]').attributes('aria-valuenow')).toBe('25')
    expect(wrapper.get('[role=progressbar]').text()).toBe('25%')
    expect(wrapper.get('[role=progressbar]').attributes('aria-label')).toBe('256 MiB / 1 GiB')
  })

  it('uses infinity for unlimited quotas and never presents an indeterminate loading bar', () => {
    const wrapper = mountWithApp(QuotaUsage, {
      props: {
        quota: {
          usedBytes: 256 * 1024 ** 2,
          quotaBytes: 0,
          percentUsed: null,
          messages: 0,
        },
      },
    })
    expect(wrapper.text()).toContain('256 MiB / ∞')
    expect(wrapper.find('[role=progressbar]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('null')
  })

  it('localises decimal sizes and clamps overflowing aria values while keeping actual usage visible', () => {
    testPlugins().i18n.global.locale.value = 'cs-cz'
    const wrapper = mountWithApp(QuotaUsage, {
      props: {
        quota: {
          usedBytes: 1.5 * 1024 ** 3,
          quotaBytes: 1024 ** 3,
          percentUsed: 150,
          messages: 1234,
        },
      },
    })
    expect(wrapper.text()).toContain('1,5 GiB / 1 GiB')
    expect(wrapper.get('[role=progressbar]').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.get('[role=progressbar]').text()).toBe('150%')
  })

  it('uses the legacy protocol order and explicit allowed/not allowed text', async () => {
    useScenario('account-mailbox')
    const overview = await fetchOwnMailboxOverview()
    const wrapper = mountWithApp(ProtocolAccessList, {
      props: {
        access: { ...overview.protocolAccess, imap: false },
      },
    })
    expect(wrapper.findAll('li').map((item) => item.get('span').text())).toEqual([
      'IMAP',
      'SMTP',
      'Sieve',
      'POP3',
      'ActiveSync',
      'CalDAV/CardDAV',
    ])
    expect(
      wrapper.findAllComponents(Badge).map((badge) => [badge.props('color'), badge.text()]),
    ).toEqual([['gray', 'not allowed'], ...Array.from({ length: 5 }, () => ['success', 'allowed'])])
  })

  it('renders aliases and comments as plain text, with alias-domain addresses under direct aliases', async () => {
    useScenario('account-mailbox')
    const overview = await fetchOwnMailboxOverview()
    const wrapper = mountWithApp(AddressLists, {
      props: {
        overview: {
          ...overview,
          sharedAliases: [
            { address: 'sales@example.org', publicComment: '<img src=x onerror=alert(1)>' },
          ],
        },
      },
    })
    expect(wrapper.text()).toContain('anna@example.com')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('hands webmail to the browser with a non-cached legacy cookie and records SSO', async () => {
    useScenario('account-mailbox')
    const result = await api.POST('/me/webmail-handoff')
    expect(requireData(result).data.url).toBe('/SOGo/so/')
    expect(result.response.headers.get('cache-control')).toContain('no-store')
    expect(result.response.headers.get('set-cookie')).toMatch(
      /MCSESSID=.+; Path=\/; HttpOnly; SameSite=Lax/,
    )
    expect(mockState().selfService.mailboxes['anna@example.org']!.recentLogins[0]?.service).toBe(
      'SSO',
    )
    expect(testPlugins().queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it.each([
    ['account-admin', 'forbidden'],
    ['account-groupware-disabled', 'groupware-disabled'],
  ])('refuses an unavailable hand-off for %s', async (scenario, problem) => {
    useScenario(scenario)
    await expect(createWebmailHandOff()).rejects.toBeInstanceOf(ApiProblem)
    await expect(createWebmailHandOff()).rejects.toMatchObject({
      type: `/api/v2/problems/${problem}`,
    })
  })

  it('refuses a restricted session before issuing the legacy cookie', async () => {
    useScenario('account-mailbox')
    mockState().accounts.find((item) => item.username === 'anna@example.org')!.pendingActions = [
      'passwordChange',
    ]
    await expect(createWebmailHandOff()).rejects.toMatchObject({
      status: 403,
      type: '/api/v2/problems/pending-action-required',
    })
  })
})
