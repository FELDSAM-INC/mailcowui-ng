// The shared mailbox picker (UI 003, used by UI 004 and UI 008): a search-as-you-type picker over
// `listMailboxes` (through the generated client, so the contract validator checks every request),
// single or multiple, with an optional domain filter, the search `q` and pages of 25. It is UI 004's
// `DomainPicker` with a mailbox source: the readable address (Unicode domain), and the ASCII address
// below it when it differs.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'

import { GIB, mockDomain } from '../../../mocks/factories/domain'
import { generateMailboxes, mockMailbox, seedMailboxes } from '../../../mocks/factories/mailbox'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

function seed() {
  const state = useScenario('admin-active', { signedInAs: 'admin' })
  state.domains = [
    mockDomain({ name: 'a.example', domainQuota: 100 * GIB, maxMailboxes: 100 }),
    mockDomain({ name: 'xn--bcher-kva.example', domainQuota: 100 * GIB }),
  ]
  state.mailboxes = []
  seedMailboxes(state, [
    ...generateMailboxes('a.example', 30, 7),
    mockMailbox({ localPart: 'dora', domain: 'xn--bcher-kva.example', displayName: 'Dora' }),
  ])
}

const listRequests = () =>
  mockState().requests.filter((request) => request.operationId === 'listMailboxes')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

async function settle() {
  vi.advanceTimersByTime(300)
  await flushPromises()
  await vi.waitFor(() => undefined)
  await flushPromises()
}

describe('MailboxSearchPicker', () => {
  it('lists the mailboxes in pages of 25 and loads more', async () => {
    seed()
    const wrapper = mountWithApp(MailboxSearchPicker, {
      props: { id: 'm', label: 'Mailbox', modelValue: null },
    })
    await wrapper.get('input').trigger('focus')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(25))
    expect(listRequests().at(-1)?.path).toContain('limit=25')
    await wrapper.get('[data-load-more]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(31))
  })

  it('searches with q 300 ms after typing and filters by domain', async () => {
    seed()
    const wrapper = mountWithApp(MailboxSearchPicker, {
      props: { id: 'm', label: 'Mailbox', modelValue: null, domain: 'bücher.example' },
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('do')
    await settle()
    await vi.waitFor(() => expect(listRequests().at(-1)?.path).toContain('q=do'))
    expect(decodeURIComponent(listRequests().at(-1)!.path)).toContain('domain=bücher.example')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(1))
    const option = wrapper.get('[role="option"]')
    expect(option.text()).toContain('dora@bücher.example')
    expect(option.text()).toContain('dora@xn--bcher-kva.example')
    await option.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['dora@xn--bcher-kva.example'])
  })

  it('chooses several mailboxes as removable chips in multiple mode', async () => {
    seed()
    const wrapper = mountWithApp(MailboxSearchPicker, {
      props: {
        id: 'm',
        label: 'Mailboxes',
        modelValue: ['dora@xn--bcher-kva.example'],
        multiple: true,
        labels: { 'dora@xn--bcher-kva.example': 'dora@bücher.example' },
      },
    })
    expect(wrapper.get('[data-picker-chips]').text()).toContain('dora@bücher.example')
    await wrapper.get('[data-picker-chips] button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })
})
