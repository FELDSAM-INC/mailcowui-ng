// T094: the home screen (FR-047): greeting, scope per role and shortcuts to the visible sections.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { queryKeys, type Identity } from '@/api'
import { visibleEntries } from '@/app/navigation/visibility'
import HomePage from '@/features/home/pages/HomePage.vue'

import { permissionFlags } from '../../../mocks/scenarios/accounts'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

function identity(overrides: Partial<Identity>): Identity {
  return {
    username: 'admin',
    role: 'admin',
    authentication: { method: 'password' },
    scope: { type: 'allDomains' },
    permissions: permissionFlags(true),
    pendingActions: [],
    preferences: { language: 'en-gb', theme: 'system', etag: '"p"' },
    ...overrides,
  }
}

async function mountHome(who: Identity) {
  testPlugins().queryClient.setQueryData(queryKeys.identity(), who)
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mountWithApp(HomePage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('HomePage', () => {
  it('greets with the username and the translated role', async () => {
    const wrapper = await mountHome(identity({}))
    expect(wrapper.get('h1').text()).toBe('Hello, admin')
    expect(wrapper.text()).toContain('You are signed in as Administrator.')
  })

  it('shows all domains for an administrator', async () => {
    const wrapper = await mountHome(identity({}))
    expect(wrapper.get('[data-scope]').text()).toContain('You manage all domains.')
  })

  it('lists the managed domains, or says that none are assigned', async () => {
    const reseller = identity({
      username: 'reseller',
      role: 'domainAdmin',
      scope: { type: 'domains', domains: ['example.org', 'example.net'] },
    })
    const wrapper = await mountHome(reseller)
    expect(wrapper.findAll('[data-scope] li').map((li) => li.text())).toEqual([
      'example.org',
      'example.net',
    ])
    const none = await mountHome({ ...reseller, scope: { type: 'domains', domains: [] } })
    expect(none.get('[data-scope]').text()).toContain('No domains are assigned to you.')
  })

  it('shows the mailbox address of a mailbox user', async () => {
    const wrapper = await mountHome(
      identity({
        username: 'alice@example.org',
        role: 'mailboxUser',
        scope: { type: 'mailbox', mailbox: 'alice@example.org', domain: 'example.org' },
        permissions: permissionFlags(false),
      }),
    )
    expect(wrapper.get('[data-scope]').text()).toContain('Your mailbox: alice@example.org')
  })

  it('offers shortcuts to the visible sections except home', async () => {
    const who = identity({ role: 'domainAdmin', scope: { type: 'domains', domains: [] } })
    const wrapper = await mountHome(who)
    const expected = visibleEntries(who)
      .filter((entry) => entry.id !== 'home')
      .map((entry) => entry.path)
    expect(wrapper.findAll('[data-shortcuts] a').map((a) => a.attributes('href'))).toEqual(
      expected.map((path) => `/ng${path}`),
    )
  })
})
