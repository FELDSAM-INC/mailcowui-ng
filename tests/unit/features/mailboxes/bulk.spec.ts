// Mailbox mass actions (UI 003 T097, data-model §7.4): the definitions and confirmations, the
// request with each mailbox's version, the flow (no confirmation to activate, one to deactivate,
// the typed count to delete), the per-item rows with the retained selection, a whole-request
// refusal and a lost connection, and the menus.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { fetchMailboxes } from '@/features/mailboxes/api'
import { bulkRequest, confirmationOf, protocolHeader } from '@/features/mailboxes/bulk'
import MailboxBulkActions from '@/features/mailboxes/components/list/MailboxBulkActions.vue'
import { useMailboxBulk } from '@/features/mailboxes/composables/useMailboxBulk'
import type { Mailbox } from '@/features/mailboxes/types'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

afterEach(() => vi.restoreAllMocks())

describe('bulk definitions', () => {
  it('asks nothing to activate, once to take away and a typed count to delete', () => {
    expect(confirmationOf({ action: 'activate' })).toBe('none')
    expect(confirmationOf({ action: 'allowProtocol', protocol: 'imap' })).toBe('none')
    expect(confirmationOf({ action: 'deactivate' })).toBe('confirm')
    expect(confirmationOf({ action: 'disableLogin' })).toBe('confirm')
    expect(confirmationOf({ action: 'disallowProtocol', protocol: 'dav' })).toBe('confirm')
    expect(confirmationOf({ action: 'delete' })).toBe('typed')
    expect(protocolHeader('activeSync')).toBe('ActiveSync (EAS)')
  })

  it('sends each mailbox with its version, and the protocol only for protocol actions', () => {
    const boxes = [{ address: 'a@x.example', etag: '"v1"' }]
    expect(bulkRequest({ action: 'deactivate' }, boxes)).toEqual({
      action: 'deactivate',
      targets: [{ id: 'a@x.example', version: '"v1"' }],
    })
    expect(bulkRequest({ action: 'allowProtocol', protocol: 'pop3' }, boxes)).toMatchObject({
      action: 'allowProtocol',
      protocol: 'pop3',
    })
  })
})

describe('useMailboxBulk', () => {
  async function setup(scenario = 'admin-bulk') {
    useScenario(scenario)
    const entries: Mailbox[] = (await fetchMailboxes({ limit: 100, offset: 0 })).data
    let bulk!: ReturnType<typeof useMailboxBulk>
    let selection!: ReturnType<typeof useBulkSelection>
    mountWithApp(
      defineComponent({
        setup: () => {
          selection = useBulkSelection({ limit: 100 })
          bulk = useMailboxBulk({ selection, entries: () => entries })
          return () => h('div')
        },
      }),
    )
    selection.enter()
    return { bulk: () => bulk, selection: () => selection, entries }
  }

  const requests = () =>
    mockState().requests.filter((r) => r.operationId === 'applyMailboxBulkAction')

  it('activates without asking and reports one row per mailbox', async () => {
    const { bulk, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm')
    selection().selectPage(['box001@bulk.example', 'box002@bulk.example'])
    await bulk().run({ action: 'activate' })
    expect(ask).not.toHaveBeenCalled()
    expect(bulk().rows.value.map((row) => row.outcome)).toEqual(['done', 'done'])
    expect(selection().count.value).toBe(0)
  })

  it('confirms a deactivation, keeps the failed and outdated ones selected and retries them', async () => {
    const { bulk, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    mockState().mailboxes.find((m) => m.localPart === 'box002')!.displayName = 'Changed'
    selection().selectPage(['box001@bulk.example', 'box002@bulk.example', 'box003@bulk.example'])
    await bulk().run({ action: 'deactivate' })
    expect(ask.mock.calls[0]?.[0].title).toBe('Deactivate the selected mailboxes (3)?')
    expect(ask.mock.calls[0]?.[0].confirmLabel).toBe('Deactivate')
    expect(bulk().rows.value.map((row) => [row.id, row.outcome])).toEqual([
      ['box001@bulk.example', 'done'],
      ['box002@bulk.example', 'outdated'],
      ['box003@bulk.example', 'failed'],
    ])
    expect([...selection().ids.value]).toEqual(['box002@bulk.example', 'box003@bulk.example'])
    expect(bulk().canRetry.value).toBe(true)
    const body = requests()[0]?.body as { targets: { version: string }[] }
    expect(body.targets[0]?.version).toMatch(/^".+"$/)
  })

  it('needs the count typed to delete and lists the addresses', async () => {
    const { bulk, selection } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    selection().selectPage(['box001@bulk.example', 'box002@bulk.example'])
    await bulk().run({ action: 'delete' })
    const request = ask.mock.calls[0]?.[0]
    expect(request?.title).toBe('Confirm deletion')
    expect(request?.requireTyped?.accepted).toEqual(['2'])
    expect(request?.content?.props).toMatchObject({
      addresses: ['box001@bulk.example', 'box002@bulk.example'],
    })
    expect(requests()).toHaveLength(0)
  })

  it('shows a whole-request refusal once and keeps the selection', async () => {
    const { bulk, selection } = await setup('domain-admin-no-protocol')
    vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    selection().selectPage(['box001@bulk.example'])
    await bulk().run({ action: 'disallowProtocol', protocol: 'imap' })
    expect(bulk().problem.value?.is('permission-flag-required')).toBe(true)
    expect(bulk().rows.value).toEqual([])
    expect(selection().count.value).toBe(1)
  })

  it('reports a lost connection as outcome unknown and clears the selection', async () => {
    const { bulk, selection } = await setup()
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    selection().selectPage(['box001@bulk.example'])
    await bulk().run({ action: 'activate' })
    await flushPromises()
    expect(bulk().rows.value.map((row) => row.outcome)).toEqual(['unknown'])
    expect(selection().count.value).toBe(0)
  })
})

describe('MailboxBulkActions', () => {
  it('offers legacy’s groups and leaves out the protocols without the flag', async () => {
    const wrapper = mountWithApp(MailboxBulkActions, { attachTo: document.body })
    expect(wrapper.findAll('[data-bulk-menu]').map((menu) => menu.text())).toEqual([
      'Mailbox',
      'Allowed protocols',
    ])
    await wrapper.get('[data-bulk-menu="mailbox"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.body.querySelectorAll('[data-bulk-action]')].map((item) =>
      item.textContent?.trim(),
    )
    expect(items).toEqual([
      'Activate',
      'Disallow login (incoming mail is still accepted)',
      'Deactivate',
      'Remove',
    ])
    ;(document.body.querySelector('[data-bulk-action="deactivate"]') as HTMLElement).click()
    await flushPromises()
    expect(wrapper.emitted('run')?.[0]).toEqual([{ action: 'deactivate' }])
    wrapper.unmount()
    const limited = mountWithApp(MailboxBulkActions, { props: { protocols: false } })
    expect(limited.findAll('[data-bulk-menu]')).toHaveLength(1)
  })
})
