// UI 011 T138 (FR-075, research R18, API gap 8): the details of this feature's records are shown
// as stored, in the generic view (UI 004's lines of text): objects as JSON text, short lists joined,
// lists longer than 10 items one per line and collapsed behind "Show all <n>", and never as markup.
import { describe, expect, it } from 'vitest'

import AuditEventDetails from '@/features/audit-log/components/AuditEventDetails.vue'

import { auditEvent } from '../../../mocks/factories/audit-event'
import { mountWithApp } from '../../support/mount'

function details(values: Record<string, unknown>) {
  return mountWithApp(AuditEventDetails, {
    props: {
      event: auditEvent({
        eventType: 'containerRestart',
        target: { type: 'container', id: 'sogo-mailcow', name: null },
        details: values,
      }),
      variant: 'list',
    },
  })
}

describe('AuditEventDetails with UI 011 records', () => {
  it('shows the state before and after as stored', () => {
    const wrapper = details({
      stateBefore: { state: 'running', startedAt: '2026-10-19T08:00:00Z' },
      stateAfter: { state: 'running', startedAt: '2026-10-19T08:05:00Z' },
    })
    expect(wrapper.text()).toContain('stateBefore')
    expect(wrapper.text()).toContain('"startedAt":"2026-10-19T08:05:00Z"')
  })

  it('collapses lists longer than ten items behind "Show all <n>"', async () => {
    const results = Array.from({ length: 400 }, (_, index) => ({
      id: `A${index.toString(16).toUpperCase()}`,
      outcome: 'done',
    }))
    const wrapper = details({ results, allowlistAdded: ['192.0.2.0/24', '198.51.100.0/24'] })
    expect(wrapper.text()).toContain('192.0.2.0/24, 198.51.100.0/24')
    const row = wrapper.findAll('dd').find((dd) => dd.text().includes('"id":"A0"'))!
    expect(row.findAll('span')).toHaveLength(10)
    const showAll = row.get('button')
    expect(showAll.text()).toBe('Show all 400')
    await showAll.trigger('click')
    expect(row.findAll('span')).toHaveLength(400)
    expect(row.find('button').exists()).toBe(false)
  })

  it('renders values as text only', () => {
    const wrapper = details({ serviceMessage: '<img src=x onerror=alert(1)>' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('links the target to its container card', () => {
    const wrapper = details({})
    expect(wrapper.text()).toContain('sogo-mailcow')
  })
})
