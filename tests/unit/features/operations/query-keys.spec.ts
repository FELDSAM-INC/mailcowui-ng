// UI 011 (data-model §3, research R5): the operations query keys. Only `['monitoring', 'live', …]`
// polls, so every live read lives under that prefix; lists and details share their roots, so that
// one prefix invalidates everything that depends on it.
import { describe, expect, it } from 'vitest'

import { operationsKeys as keys } from '@/features/operations/query-keys'

describe('operationsKeys', () => {
  it('puts every polled read under the live prefix', () => {
    const live = keys.monitoring.live()
    expect(live).toEqual(['monitoring', 'live'])
    for (const key of [
      keys.monitoring.host(),
      keys.monitoring.containers(),
      keys.monitoring.resourceUsage('sogo-mailcow'),
      keys.monitoring.mailStorage(),
    ]) {
      expect(key.slice(0, 2)).toEqual(live)
    }
    expect(keys.monitoring.resourceUsage('sogo-mailcow').at(-1)).toBe('sogo-mailcow')
  })

  it('keeps the reads that never poll outside the live prefix', () => {
    expect(keys.monitoring.all()).toEqual(['monitoring'])
    expect(keys.monitoring.capabilities()).toEqual(['monitoring', 'capabilities'])
    expect(keys.monitoring.installation()).toEqual(['monitoring', 'installation'])
    expect(keys.monitoring.updateStatus()).toEqual(['monitoring', 'update-status'])
    expect(keys.monitoring.publicAddresses()).toEqual(['monitoring', 'public-addresses'])
  })

  it('names containers, logs and Rspamd by their roots', () => {
    expect(keys.containers.all()).toEqual(['containers'])
    expect(keys.containers.detail('postfix-mailcow')).toEqual([
      'containers',
      'detail',
      'postfix-mailcow',
    ])
    expect(keys.logs.all()).toEqual(['logs'])
    expect(keys.logs.type('postfix')).toEqual(['logs', 'postfix'])
    expect(keys.logs.list('postfix', { q: 'alice' })).toEqual(['logs', 'postfix', { q: 'alice' }])
    expect(keys.rspamd.all()).toEqual(['rspamd'])
    expect(keys.rspamd.statistics()).toEqual(['rspamd', 'statistics'])
    expect(keys.rspamd.histories()).toEqual(['rspamd', 'history'])
    expect(keys.rspamd.history({ limit: 25 })).toEqual(['rspamd', 'history', { limit: 25 }])
  })

  it('names the mail queue and the ban service by their roots', () => {
    expect(keys.mailQueue.all()).toEqual(['mail-queue'])
    expect(keys.mailQueue.lists()).toEqual(['mail-queue', 'list'])
    expect(keys.mailQueue.list({ limit: 25 })).toEqual(['mail-queue', 'list', { limit: 25 }])
    expect(keys.mailQueue.counts()).toEqual(['mail-queue', 'counts'])
    expect(keys.mailQueue.content('4F2A1B')).toEqual(['mail-queue', 'content', '4F2A1B'])
    expect(keys.fail2ban.all()).toEqual(['fail2ban'])
    expect(keys.fail2ban.settings()).toEqual(['fail2ban', 'settings'])
    expect(keys.fail2ban.rules()).toEqual(['fail2ban', 'rules'])
    expect(keys.fail2ban.activeBanLists()).toEqual(['fail2ban', 'active-bans'])
    expect(keys.fail2ban.activeBans({ limit: 1000 })).toEqual([
      'fail2ban',
      'active-bans',
      { limit: 1000 },
    ])
    expect(keys.fail2ban.permanentBanLists()).toEqual(['fail2ban', 'permanent-bans'])
    expect(keys.fail2ban.permanentBans({ limit: 1000 })).toEqual([
      'fail2ban',
      'permanent-bans',
      { limit: 1000 },
    ])
  })
})
