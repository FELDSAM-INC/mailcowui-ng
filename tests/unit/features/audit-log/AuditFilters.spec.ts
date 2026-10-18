// T137: the audit filters (FR-073, data-model §6): the actor is at most 255 characters, the address
// at most 49 characters and an IP address or prefix; valid filters are applied as one change.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import AuditFilters from '@/features/audit-log/components/AuditFilters.vue'
import type { AuditFilterValues } from '@/features/audit-log/list-state'

import { mountWithApp } from '../../support/mount'

const empty: AuditFilterValues = {
  range: undefined,
  from: undefined,
  to: undefined,
  event: [],
  outcome: undefined,
  actor: undefined,
  address: undefined,
  targetType: undefined,
  targetId: undefined,
}

function mountFilters(filters: Partial<AuditFilterValues> = {}, problem: ApiProblem | null = null) {
  return mountWithApp(AuditFilters, {
    props: { filters: { ...empty, ...filters }, problem, defaultOpen: true },
    attachTo: document.body,
  })
}

const field = (wrapper: ReturnType<typeof mountFilters>, label: string) => {
  const id = wrapper
    .findAll('label')
    .find((l) => l.text().startsWith(label))
    ?.attributes('for')
  return wrapper.get<HTMLInputElement>(`#${id}`)
}

const exactField = (wrapper: ReturnType<typeof mountFilters>, label: string) => {
  const id = wrapper
    .findAll('label')
    .find((l) => l.text().trim() === label)
    ?.attributes('for')
  return wrapper.get<HTMLInputElement>(`#${id}`)
}

describe('AuditFilters', () => {
  it('limits the actor and the address to the contract lengths', () => {
    const wrapper = mountFilters()
    expect(field(wrapper, 'User or API key').attributes('maxlength')).toBe('255')
    expect(field(wrapper, 'Client address').attributes('maxlength')).toBe('49')
  })

  it('refuses an actor longer than 255 characters', async () => {
    const wrapper = mountFilters()
    const actor = field(wrapper, 'User or API key')
    actor.element.value = 'a'.repeat(256)
    await actor.trigger('input')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter at most 255 characters.')
    expect(actor.attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('checks the address with isIpNetwork before applying', async () => {
    const wrapper = mountFilters()
    const address = field(wrapper, 'Client address')
    await address.setValue('192.0.2.300')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter an IPv4 or IPv6 address or network')
    expect(document.activeElement).toBe(address.element)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('applies valid filters as one change, with the address trimmed', async () => {
    const wrapper = mountFilters({ outcome: 'failure' })
    await field(wrapper, 'Client address').setValue(' 2001:db8::/32 ')
    await field(wrapper, 'User or API key').setValue('alice@example.org')
    await wrapper.get('input[type="checkbox"][value="signIn"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({
      address: '2001:db8::/32',
      actor: 'alice@example.org',
      event: ['signIn'],
      outcome: 'failure',
      range: undefined,
      from: undefined,
      to: undefined,
    })
  })

  it('applies a custom range in UTC and refuses an inverted one', async () => {
    const wrapper = mountFilters()
    await field(wrapper, 'Time range').setValue('custom')
    await field(wrapper, 'From').setValue('2026-10-02T10:00')
    await field(wrapper, 'To').setValue('2026-10-01T10:00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('The end must be after the start.')
    await field(wrapper, 'To').setValue('2026-10-03T10:00')
    await wrapper.get('form').trigger('submit')
    const applied = wrapper.emitted('apply')?.[0]?.[0] as Partial<AuditFilterValues>
    expect(applied.range).toBe('custom')
    expect(applied.from).toBe(new Date('2026-10-02T10:00').toISOString())
    expect(applied.to).toBe(new Date('2026-10-03T10:00').toISOString())
  })

  it('shows server field errors on the matching filter', async () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      status: 422,
      type: '/api/v2/problems/validation-failed',
      fieldErrors: new Map([
        [
          'clientAddress',
          [{ code: 'invalidFormat', params: { format: 'ipNetwork' }, message: '' }],
        ],
      ]),
    })
    const wrapper = mountFilters({}, problem)
    await flushPromises()
    expect(field(wrapper, 'Client address').attributes('aria-invalid')).toBe('true')
  })

  it('clears every filter', async () => {
    const wrapper = mountFilters({ outcome: 'success', actor: 'admin' })
    const clear = wrapper.findAll('button').find((b) => b.text() === 'Clear filters')
    await clear!.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('UI 002 T098 offers the labelled target types, classic names included, and a target ID', async () => {
    const wrapper = mountFilters()
    const type = field(wrapper, 'Target type')
    const options = type.findAll('option').map((option) => option.text())
    expect(options).toEqual(
      expect.arrayContaining(['API key', 'Domain', 'Domain wide footer', 'Domain template']),
    )
    expect(options).not.toContain('Unknown (mailbox)')
    expect(exactField(wrapper, 'Target').attributes('maxlength')).toBe('255')
    await type.setValue('domain')
    await exactField(wrapper, 'Target').setValue(' example.org ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({
      targetType: 'domain',
      targetId: 'example.org',
    })
  })

  it('UI 002 T098 refuses a target ID longer than 255 characters', async () => {
    const wrapper = mountFilters()
    const target = exactField(wrapper, 'Target')
    target.element.value = 'x'.repeat(256)
    await target.trigger('input')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter at most 255 characters.')
    expect(target.attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
})
