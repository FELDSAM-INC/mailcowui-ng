import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'
import { fetchIdentity } from '@/app/session/queries'
import MailboxAccountLinks from '@/features/account/components/layout/MailboxAccountLinks.vue'
import MailboxContextHeader from '@/features/account/components/layout/MailboxContextHeader.vue'
import MailboxAccountLayout from '@/features/account/components/layout/MailboxAccountLayout.vue'
import { useAccountContext } from '@/features/account/composables/useAccountContext'

import { useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { mountWithApp, testPlugins } from '../../support/mount'

const Stub = defineComponent({ setup: () => () => h('p', 'Section content') })
async function setup(
  scenario = 'account-admin',
  path = '/mailboxes/ANNA@example.org/app-passwords',
) {
  useScenario(scenario)
  testPlugins().queryClient.setQueryData(queryKeys.identity(), await fetchIdentity())
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/account', name: 'account', component: Stub },
      { path: '/mailboxes/:address', name: 'mailbox-detail', component: Stub },
      {
        path: '/mailboxes/:address/app-passwords',
        name: 'mailbox-app-passwords',
        component: Stub,
        meta: { accountSection: 'appPasswords' },
      },
      { path: '/mailboxes/:address/mail-settings', name: 'mailbox-mail-settings', component: Stub },
      { path: '/audit-log', name: 'audit-log', component: Stub },
    ],
  })
  await router.push(path)
  return router
}

describe('mailbox context and its action areas (D6)', () => {
  it('resolves own identity or the lower-cased route mailbox', async () => {
    const router = await setup('account-mailbox', '/account')
    const { result } = withSetup(useAccountContext, { router })
    expect(result.kind.value).toBe('own')
    expect(result.mailbox.value).toBe('anna@example.org')
    await router.push('/mailboxes/ANNA@example.org/app-passwords')
    expect(result.kind.value).toBe('mailbox')
    expect(result.mailbox.value).toBe('anna@example.org')
  })

  it('names the mailbox below the section heading and links admins to all its history', async () => {
    const router = await setup()
    const wrapper = mountWithApp(MailboxContextHeader, {
      props: { title: 'App passwords' },
      global: { plugins: [router] },
    })
    expect(wrapper.get('h1').text()).toBe('App passwords')
    expect(wrapper.text()).toContain('anna@example.org')
    expect(wrapper.get('a').attributes('href')).toBe('/ng/audit-log?targetId=anna@example.org')
  })

  it.each(['account-domain-admin', 'account-mailbox'])(
    'offers no history for %s',
    async (scenario) => {
      const router = await setup(scenario, scenario === 'account-mailbox' ? '/account' : undefined)
      const wrapper = mountWithApp(MailboxContextHeader, {
        props: { title: 'App passwords', targetType: 'appPassword' },
        global: { plugins: [router] },
      })
      expect(wrapper.find('a').exists()).toBe(false)
    },
  )

  it('filters object history by type plus mailbox, never by its object identifier', async () => {
    const router = await setup()
    const wrapper = mountWithApp(MailboxContextHeader, {
      props: { title: 'Phone', targetType: 'appPassword' },
      global: { plugins: [router] },
    })
    expect(wrapper.get('a').attributes('href')).toBe(
      '/ng/audit-log?targetType=appPassword&targetId=anna@example.org',
    )
  })

  it('offers only registered links and hides groupware settings when disabled', async () => {
    const router = await setup('account-groupware-disabled')
    const wrapper = mountWithApp(MailboxAccountLinks, {
      props: { address: 'anna@example.org' },
      global: { plugins: [router] },
    })
    await flushPromises()
    // A mailbox user has no mailbox-context navigation even if a route exists.
    expect(wrapper.findAll('a')).toHaveLength(0)
    useScenario('account-admin', { selfService: { groupwareEnabled: false } })
    testPlugins().queryClient.setQueryData(queryKeys.identity(), await fetchIdentity())
    await testPlugins().queryClient.invalidateQueries({
      queryKey: queryKeys.capabilities.selfService(),
    })
    await flushPromises()
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual(['App passwords'])
  })

  it('names the missing domain administrator flag in the read-only notice', async () => {
    const router = await setup('account-domain-admin-no-flags')
    const wrapper = mountWithApp(MailboxAccountLayout, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.get('[data-acl-note]').text()).toContain('Prohibited by ACL')
    expect(wrapper.get('[data-acl-note]').text()).toContain('Manage app passwords')
  })
})
