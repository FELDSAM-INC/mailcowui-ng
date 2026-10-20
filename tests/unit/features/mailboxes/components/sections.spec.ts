// The sections of the mailbox page (UI 003 T072, T088 under the forms rule): the "Mailbox" tab's
// read-only values and form in legacy order with the gates and sources, the custom attributes
// table, the ACL multi-select and the read-only Pushover tab (the Rate limit tab is UI 006's
// section).
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Identity } from '@/api'
import { setSessionContext } from '@/app/session/context'
import { fetchMailbox } from '@/features/mailboxes/api'
import AclSection from '@/features/mailboxes/components/sections/AclSection.vue'
import AttributesSection from '@/features/mailboxes/components/sections/AttributesSection.vue'
import MailboxSection from '@/features/mailboxes/components/sections/MailboxSection.vue'
import ManagedSections from '@/features/mailboxes/components/sections/ManagedSections.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { permissionFlags } from '../../../../mocks/scenarios/accounts'
import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const identity = (role: Identity['role'], flags: Partial<Identity['permissions']> = {}) =>
  ({
    username: role,
    role,
    authentication: { method: 'password' },
    scope: role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['a.example'] },
    permissions: permissionFlags(role === 'admin', flags),
    pendingActions: [],
  }) as unknown as Identity

// The relayhost field's History link (UI 009 US9) asks the router for the audit log route.
const withRouter = () => ({ plugins: [createTestRouter()] })

afterEach(() => setSessionContext(null))

async function load(address = 'anna@a.example') {
  useScenario('admin-edit')
  return fetchMailbox(address)
}

describe('MailboxSection', () => {
  it('shows the values in legacy order, with the relayhost for administrators', async () => {
    const mailbox = await load()
    const wrapper = mountWithApp(MailboxSection, {
      props: { mailbox, identity: identity('admin') },
      global: withRouter(),
    })
    await flushPromises()
    const labels = wrapper.findAll('dt').map((item) => item.text())
    expect(labels).toEqual([
      'Identity Provider',
      'Full name',
      'Tags',
      'Quota (MiB)',
      // UI 004: "Allow to send as" and the external sender addresses in their legacy positions.
      'Allow to send as',
      'Sender-dependent transports',
      'Set handling for tagged mail',
      'Quarantine notifications',
      'Quarantine notification category',
      'Encryption policy',
      'Password recovery email',
      'External sender addresses',
      'Allowed protocols for direct user access (does not affect app password protocols)',
      'Status',
      'Force password update at next login',
      'Force 2FA enrollment at login',
      'Direct forwarding to SOGo',
    ])
    expect(wrapper.text()).toContain('2 GiB')
    expect(wrapper.text()).toContain('ID 2')
  })

  it('opens the legacy form: password fields for the built-in source, protocols locked without the flag', async () => {
    const mailbox = await load()
    const wrapper = mountWithApp(MailboxSection, {
      props: {
        mailbox,
        editing: true,
        identity: identity('domainAdmin', { protocolAccess: false, sogoAccess: true }),
      },
      global: withRouter(),
    })
    await flushPromises()
    expect(wrapper.find('#section-mailbox-password').exists()).toBe(true)
    expect(wrapper.find('#section-mailbox-password2').exists()).toBe(true)
    expect(wrapper.find('[data-locked="section-mailbox-protocols"]').text()).toContain(
      'Prohibited by ACL',
    )
    expect(wrapper.get('#section-mailbox-webmailRedirect').attributes('disabled')).toBeUndefined()
  })

  it('has no password or recovery e-mail for an external source, and hides SOGo access without the groupware', async () => {
    const mailbox = await load('dana@a.example')
    const wrapper = mountWithApp(MailboxSection, {
      props: {
        mailbox,
        editing: true,
        identity: identity('admin'),
        capabilities: { ...mockState().mailboxCapabilities, groupwareEnabled: false },
      },
      global: withRouter(),
    })
    await flushPromises()
    expect(wrapper.find('#section-mailbox-password').exists()).toBe(false)
    expect(wrapper.find('#section-mailbox-recoveryEmail').exists()).toBe(false)
    expect(wrapper.find('#section-mailbox-webmailRedirect').exists()).toBe(false)
    expect(wrapper.get('#section-mailbox-forcePasswordChange').attributes('disabled')).toBeDefined()
  })
})

describe('AttributesSection', () => {
  it('lists the attributes, adds and removes rows', async () => {
    const mailbox = await load()
    const view = mountWithApp(AttributesSection, { props: { mailbox } })
    expect(view.text()).toContain('old')
    const wrapper = mountWithApp(AttributesSection, { props: { mailbox, editing: true } })
    await flushPromises()
    expect(wrapper.findAll('[data-attribute-row]')).toHaveLength(1)
    await wrapper.get('#section-attributes-add').trigger('click')
    expect(wrapper.findAll('[data-attribute-row]')).toHaveLength(2)
    await wrapper.findAll('[data-attribute-row] button')[0]!.trigger('click')
    expect(wrapper.findAll('[data-attribute-row]')).toHaveLength(1)
  })

  it('says "No record" without attributes', async () => {
    const mailbox = await load('carl@a.example')
    expect(mountWithApp(AttributesSection, { props: { mailbox } }).text()).toContain('No record')
  })
})

describe('AclSection and Pushover', () => {
  it('offers the present permissions in legacy order with the acl labels', async () => {
    const mailbox = await load()
    const wrapper = mountWithApp(AclSection, { props: { mailbox, editing: true } })
    await flushPromises()
    const options = wrapper.findAll('option').map((option) => option.text())
    expect(options[0]).toBe('Temporary aliases')
    expect(options).toHaveLength(15)
    expect(options).toContain('Allow to reset mailcow user password')
  })

  // UI 006: the "Rate limit" tab is the rate limit area's section (tests/unit/features/rate-limits).
  it('shows Pushover read-only', async () => {
    const state = useScenario('domain-admin-edit')
    state.accounts.find((account) => account.username === 'reseller')!.permissions.pushover = false
    const mailbox = await fetchMailbox('anna@a.example')
    const router = createTestRouter()
    await router.push('/mailboxes/anna@a.example')
    setSessionContext({
      queryClient: testPlugins().queryClient,
      router,
      channel: createAppChannel('test'),
    })
    const pushover = mountWithApp(ManagedSections, {
      props: { mailbox, section: 'pushover' },
      global: { plugins: [router] },
    })
    await vi.waitFor(() => expect(pushover.text()).toContain('Pushover'))
    await vi.waitFor(() => expect(pushover.find('input[name="token"]').exists()).toBe(true))
    expect(pushover.get('input[name="token"]').attributes('disabled')).toBeDefined()
    expect(pushover.find('button[type="submit"]').exists()).toBe(false)
  })
})
