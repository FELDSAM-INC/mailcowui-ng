// The "Allow to send as" and "External sender addresses" fields (T073; legacy form map part 3,
// item 1): legacy's labels and subtexts, removal where permitted, the blocked aliases and the
// server's candidates as options (`*` for administrators only), the hints, the patch on save, and
// the external field's legacy placeholder and help.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import type { Identity } from '@/api'
import {
  ExternalSenderField,
  SenderAclField,
  useSenderSettings,
  type SenderSettingsState,
} from '@/features/sender-settings'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { permissionFlags } from '../../../mocks/scenarios/accounts'
import { SENDER_004 } from '../../../mocks/scenarios/sender-settings'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const identity = (role: Identity['role'], flags: Partial<Identity['permissions']> = {}) =>
  ({
    username: role === 'admin' ? 'admin' : 'reseller',
    role,
    authentication: { method: 'password' },
    scope:
      role === 'admin'
        ? { type: 'allDomains' }
        : { type: 'domains', domains: ['example.org', 'example.com'] },
    permissions: permissionFlags(role === 'admin', flags),
    pendingActions: [],
  }) as unknown as Identity

let state!: SenderSettingsState

function harness(who: Identity) {
  return defineComponent({
    setup() {
      state = useSenderSettings({ mailbox: SENDER_004.mailbox, editing: true, identity: who })
      return () =>
        h('div', [
          h(SenderAclField, { state }),
          state.permissions.value.canEditExternalSenderAddresses
            ? h(ExternalSenderField, { state })
            : null,
        ])
    },
  })
}

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('SenderAclField', () => {
  it('shows the selected entries with legacy labels and subtexts, removable where permitted', async () => {
    useScenario('sender-settings')
    const wrapper = mountWithApp(harness(identity('admin')), { attachTo: document.body })
    await flushPromises()
    const domain = wrapper.get(`[data-sender-entry="${SENDER_004.explicitDomain}"]`)
    expect(domain.text()).toContain('Disable sender check for domain example.com (+ alias domains)')
    expect(
      wrapper.get(`[data-sender-entry="${SENDER_004.allowedAlias}"] [data-subtext]`).text(),
    ).toBe('Alias (allowed)')
    expect(wrapper.find(`[data-sender-entry="${SENDER_004.allowedAlias}"] button`).exists()).toBe(
      false,
    )
    expect(wrapper.get(`[data-sender-entry="${SENDER_004.stale}"] [data-subtext]`).text()).toBe(
      'No longer exists',
    )
    expect(wrapper.text()).toContain('This behaviour does not apply to alias addresses.')
    await domain.get('button').trigger('click')
    expect(state.dirty.value).toBe(true)
    expect(wrapper.find(`[data-sender-entry="${SENDER_004.explicitDomain}"]`).exists()).toBe(false)
    wrapper.unmount()
  })

  it('offers the blocked aliases and the candidates, with "*" for administrators only', async () => {
    useScenario('sender-settings')
    const admin = mountWithApp(harness(identity('admin')), { attachTo: document.body })
    await flushPromises()
    await admin.get('[role="combobox"]').trigger('focus')
    await new Promise((resolve) => setTimeout(resolve, 350))
    await flushPromises()
    const options = admin.findAll('[role="option"]').map((option) => option.text())
    expect(
      options.some(
        (text) => text.includes(SENDER_004.receiveOnlyAlias) && text.includes('Alias (blocked)'),
      ),
    ).toBe(true)
    expect(options.some((text) => text.includes('domain * (+ alias domains)'))).toBe(true)
    admin.unmount()

    useScenario('sender-settings-da')
    const domainAdmin = mountWithApp(harness(identity('domainAdmin')), { attachTo: document.body })
    await flushPromises()
    await domainAdmin.get('[role="combobox"]').trigger('focus')
    await new Promise((resolve) => setTimeout(resolve, 350))
    await flushPromises()
    expect(
      domainAdmin.findAll('[role="option"]').some((option) => option.text().includes('domain * ')),
    ).toBe(false)
    expect(domainAdmin.find('#section-mailbox-externalSenderAddresses').exists()).toBe(false)
    domainAdmin.unmount()
  })

  it("asks for the page's mailbox's candidates while its settings are still loading", async () => {
    useScenario('sender-settings', { delays: { getMailboxSenderSettings: 600 } })
    const wrapper = mountWithApp(harness(identity('admin')), { attachTo: document.body })
    await wrapper.get('[role="combobox"]').trigger('focus')
    await new Promise((resolve) => setTimeout(resolve, 350))
    await flushPromises()
    const mailboxes = mockState()
      .requests.filter((request) => request.operationId === 'listSenderPermissionCandidates')
      .map((request) => new URL(request.path, location.origin).searchParams.get('mailbox'))
    expect(mailboxes.length).toBeGreaterThan(0)
    expect(new Set(mailboxes)).toEqual(new Set([SENDER_004.mailbox]))
    wrapper.unmount()
  })

  it('saves the changed set with If-Match and shows "*" as the disabled sender check', async () => {
    useScenario('sender-settings')
    const wrapper = mountWithApp(harness(identity('admin')), { attachTo: document.body })
    await flushPromises()
    state.add({
      value: '*',
      valueUnicode: '*',
      type: 'anyAddress',
      kind: 'anyAddress',
      changeable: true,
      stale: false,
    })
    await flushPromises()
    expect(wrapper.get('[data-sender-check-disabled]').text()).toBe('Sender check is disabled')
    expect(await state.save()).toBe('saved')
    const request = mockState().requests.find(
      (item) => item.operationId === 'updateMailboxSenderSettings',
    )!
    expect(request.body).toEqual({ explicitPermissions: ['*'] })
    expect(request.headers['if-match']).toBeTruthy()
    wrapper.unmount()
  })
})

describe('ExternalSenderField', () => {
  it('has legacy placeholder and help, and marks a refused entry', async () => {
    useScenario('sender-settings')
    const wrapper = mountWithApp(harness(identity('admin')), { attachTo: document.body })
    await flushPromises()
    const input = wrapper.get('#section-mailbox-externalSenderAddresses')
    expect(input.attributes('placeholder')).toBe(
      'user1@example.com, user2@example.org, @example.com, ...',
    )
    expect(wrapper.text()).toContain(
      'Remember to add this server to the corresponding SPF TXT record.',
    )
    await input.setValue(`news@mailer.example, ${SENDER_004.localExternal}`)
    expect(await state.save()).toBe('failed')
    await flushPromises()
    expect(wrapper.text()).toContain(
      `${SENDER_004.localExternal}: External sender "example.net" uses an invalid domain`,
    )
    wrapper.unmount()
  })
})
