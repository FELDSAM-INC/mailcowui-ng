// T137: one audit record (FR-072, FR-084): the outcome in text, the actor variants and the
// expandable details.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { AuditEvent } from '@/api'
import AuditEventItem from '@/features/audit-log/components/AuditEventItem.vue'

import { mountWithApp } from '../../support/mount'

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: '01JB3K4M5N6P7Q8R9S0TVWXYZA',
    occurredAt: '2026-10-18T10:00:00Z',
    eventType: 'signIn',
    outcome: 'success',
    actor: { username: 'admin', role: 'admin', apiKeyId: null },
    target: { type: 'session', id: null, name: null },
    clientAddress: '192.0.2.10',
    userAgent: 'Mozilla/5.0',
    authMethod: 'password',
    failureReason: null,
    requestId: '0123456789abcdef0123456789abcdef',
    details: { requestedRole: 'admin', changedFields: ['language', 'theme'] },
    ...overrides,
  }
}

const mountItem = (overrides: Partial<AuditEvent> = {}) =>
  mountWithApp(AuditEventItem, { props: { event: event(overrides) }, attachTo: document.body })

describe('AuditEventItem', () => {
  it('names the event, the outcome in text, the time, address and method', () => {
    const wrapper = mountItem()
    expect(wrapper.get('h3').text()).toBe('Sign-in')
    expect(wrapper.text()).toContain('Success')
    expect(wrapper.text()).toContain('192.0.2.10')
    expect(wrapper.text()).toContain('Password')
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-18T10:00:00.000Z')
  })

  it('shows a failure with its reason', () => {
    const wrapper = mountItem({ outcome: 'failure', failureReason: 'throttled' })
    expect(wrapper.text()).toContain('Failure')
    expect(wrapper.text()).toContain('Too many attempts')
  })

  it.each([
    [{ username: 'admin', role: 'admin', apiKeyId: null }, 'success', 'admin (Administrator)'],
    [
      { username: 'alice@example.org', role: null, apiKeyId: null },
      'failure',
      'alice@example.org (attempted)',
    ],
    [{ username: 'admin', role: 'admin', apiKeyId: 'KEY1' }, 'success', 'API key KEY1 of admin'],
    [{ username: null, role: null, apiKeyId: 'KEY2' }, 'success', 'API key KEY2'],
    [{ username: null, role: null, apiKeyId: null }, 'failure', 'Unknown actor'],
  ] as const)('shows the actor %j', (actor, outcome, text) => {
    const wrapper = mountItem({ actor: { ...actor }, outcome })
    expect(wrapper.text()).toContain(text)
  })

  it('expands the target, user agent, request ID and details as text', async () => {
    const wrapper = mountItem({
      eventType: 'apiKeyCreation',
      target: { type: 'apiKey', id: 'K1', name: '<b>Billing</b>' },
    })
    expect(wrapper.text()).not.toContain('Request ID')
    const toggle = wrapper.findAll('button').find((b) => b.text() === 'Show details')!
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const text = wrapper.text()
    expect(text).toContain('Request ID')
    expect(text).toContain('0123456789abcdef0123456789abcdef')
    expect(text).toContain('Mozilla/5.0')
    expect(text).toContain('API key: <b>Billing</b> (K1)')
    expect(text).toContain('requestedRole')
    expect(text).toContain('language, theme')
    expect(wrapper.find('b').exists()).toBe(false)
  })
})
