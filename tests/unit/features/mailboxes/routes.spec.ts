import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { buildRoutes } from '@/app/router/routes'

describe('mailbox address routes', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

  it.each([
    ['', 'mailbox-detail'],
    ['/filters', 'mailbox-filters'],
    ['/filters/new', 'mailbox-filter-create'],
    ['/filters/12', 'mailbox-filter-detail'],
    ['/push-notifications', 'mailbox-push-notifications'],
    ['/recent-logins', 'mailbox-recent-logins'],
    ['/mail-settings', 'mailbox-mail-settings'],
    ['/temporary-aliases', 'mailbox-temporary-aliases'],
    ['/app-passwords', 'mailbox-app-passwords'],
    ['/app-passwords/new', 'mailbox-app-password-create'],
    ['/app-passwords/12', 'mailbox-app-password-detail'],
  ])('opens literal and percent-encoded addresses in %s', (suffix, name) => {
    for (const address of ['alice+tag@example.org', 'alice%2Btag%40example.org']) {
      const route = router.resolve(`/mailboxes/${address}${suffix}`)
      expect(route.name).toBe(name)
      expect(route.params.address).toBe('alice+tag@example.org')
    }
    const named = router.resolve({
      name,
      params: { address: 'alice+tag@example.org', filterId: 12, appPasswordId: 12 },
    })
    expect(router.resolve(named.href).name).toBe(name)
  })

  it('preserves creation routes and rejects identifiers without an address separator', () => {
    expect(router.resolve('/mailboxes/new').name).toBe('mailbox-create')
    expect(router.resolve('/mailbox-templates/new').name).toBe('mailbox-template-create')
    for (const path of [
      '/mailboxes/not-an-address',
      '/mailboxes/new/filters',
      '/mailboxes/invalid%2540example.org',
    ]) {
      expect(router.resolve(path).name).toBe('not-found')
    }
  })
})
