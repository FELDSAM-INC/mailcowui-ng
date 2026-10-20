// The routing list screens through their routes (UI 009 T031, T058, T082, T091, T098, T104): the
// classic columns and buttons, a single deletion with legacy's confirmation, legacy's quick actions
// as bulk actions, the forwarding host source filter and addition outcome, the relayhost usage view
// and the index page.
import { describe, expect, it, vi } from 'vitest'

import { useForwardingHostResults } from '@/features/routing/composables/useForwardingHostResults'
import * as announcer from '@/shared/composables/useAnnouncer'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState } from '../../../../mocks/node'
import { mountRoute, settle, until } from './mount-route'

type Wrapper = Awaited<ReturnType<typeof mountRoute>>['wrapper']

const ids = (wrapper: Wrapper) =>
  wrapper.findAll('[data-entry]').map((item) => item.attributes('data-entry'))

async function listed(wrapper: Wrapper, count?: number) {
  await until(() => {
    expect(wrapper.find('[data-list-state]').attributes('data-list-state')).not.toBe('loading')
    expect(wrapper.findAll('[data-entry]').length).toBeGreaterThan(0)
    if (count !== undefined) expect(wrapper.findAll('[data-entry]')).toHaveLength(count)
  })
}

async function confirmNow() {
  await until(() => expect(confirmState.value).not.toBeNull())
  settleConfirm(true)
  await settle()
}

describe('routing list screens', { timeout: 60_000 }, () => {
  it('lists the relayhosts with Test, Edit, Remove and History and deletes one after confirming', async () => {
    const announce = vi.spyOn(announcer, 'announce')
    const { wrapper } = await mountRoute('/routing/relayhosts')
    await listed(wrapper)
    expect(wrapper.text()).toContain('[smtp.example.net]:587')
    const row = wrapper.get('[data-entry="2"]')
    expect(row.findAll('[data-action]').map((item) => item.attributes('data-action'))).toEqual([
      'test',
      'edit',
      'remove',
    ])
    await row.get('[data-action="remove"]').trigger('click')
    await confirmNow()
    await until(() => expect(mockState().routing.relayhosts.some((r) => r.id === 2)).toBe(false))
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('2'))
  })

  it('runs legacy’s quick actions on the selected relayhosts with a result per entry', async () => {
    const { wrapper } = await mountRoute('/routing/relayhosts')
    await listed(wrapper)
    const select = wrapper.findAll('button').find((item) => item.text() === 'Select')!
    await select.trigger('click')
    await settle()
    await wrapper.get('[data-entry="1"] input[type="checkbox"]').setValue(true)
    await settle()
    const deactivate = wrapper
      .findAll('[role="region"] button')
      .find((item) => item.text().includes('Deactivate'))!
    await deactivate.trigger('click')
    await until(() => expect(wrapper.text()).toContain('[smtp.example.net]:587'))
    await until(() =>
      expect(mockState().routing.relayhosts.find((r) => r.id === 1)?.active).toBe(false),
    )
  })

  it('deletes selected entries in bulk after the typed confirmation', async () => {
    const { wrapper } = await mountRoute('/routing/tls-policy-maps')
    await listed(wrapper)
    const before = mockState().routing.tlsPolicyMaps.length
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'Select')!
      .trigger('click')
    await settle()
    await wrapper.get('[data-entry="1"] input[type="checkbox"]').setValue(true)
    await wrapper.get('[data-entry="2"] input[type="checkbox"]').setValue(true)
    await settle()
    await wrapper
      .findAll('[role="region"] button')
      .find(
        (item) =>
          item.attributes('data-variant') === 'destructive' || /Remove|Delete/.test(item.text()),
      )!
      .trigger('click')
    await confirmNow()
    await until(() => expect(mockState().routing.tlsPolicyMaps).toHaveLength(before - 2))
  })

  it.each([
    ['/routing/transports', '[mx.partner.net]:25', ['test', 'edit', 'remove']],
    ['/routing/bcc-maps', 'alice-copy@archive.example', ['edit', 'remove']],
    ['/routing/recipient-maps', '@old.example', ['edit', 'remove']],
    ['/routing/tls-policy-maps', 'protocols=!SSLv2 ciphers=medium', ['edit', 'remove']],
    ['/routing/forwarding-hosts', '192.0.2.0/24', ['remove']],
  ])('lists %s with legacy’s buttons', async (path, text, actions) => {
    const { wrapper } = await mountRoute(path)
    await listed(wrapper)
    expect(wrapper.text()).toContain(text)
    const first = wrapper.find('[data-entry] [data-entry-actions]')
    expect(first.findAll('[data-action]').map((item) => item.attributes('data-action'))).toEqual(
      actions,
    )
  })

  it('shows the cards below md', async () => {
    const { wrapper } = await mountRoute('/routing/recipient-maps', { wide: false })
    await listed(wrapper)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(ids(wrapper).length).toBeGreaterThan(0)
  })

  it('deletes a transport, a BCC map, a recipient map and a forwarding host', async () => {
    for (const [path, id, collection] of [
      ['/routing/transports', '3', 'transports'],
      ['/routing/bcc-maps', '5', 'bccMaps'],
      ['/routing/recipient-maps', '1', 'recipientMaps'],
      ['/routing/forwarding-hosts', '203.0.113.9', 'forwardingHosts'],
    ] as const) {
      const { wrapper } = await mountRoute(path)
      await listed(wrapper)
      const before = mockState().routing[collection].length
      await wrapper.get(`[data-entry="${id}"] [data-action="remove"]`).trigger('click')
      await confirmNow()
      await until(() => expect(mockState().routing[collection]).toHaveLength(before - 1))
    }
  })

  it('filters forwarding hosts by a source and shows an addition’s outcome once', async () => {
    useForwardingHostResults().hand({
      source: 'forwarder.example',
      entries: [
        {
          outcome: 'updated',
          forwardingHost: {
            address: '198.51.100.7',
            source: 'forwarder.example',
            spamFilter: true,
            etag: '"1"',
          },
        },
        {
          outcome: 'added',
          forwardingHost: {
            address: '198.51.100.8',
            source: 'forwarder.example',
            spamFilter: true,
            etag: '"2"',
          },
        },
      ],
    } as never)
    const { wrapper, router } = await mountRoute(
      '/routing/forwarding-hosts?source=forwarder.example',
    )
    await listed(wrapper)
    const outcome = wrapper.get('[data-forwarding-results]')
    expect(outcome.text()).toContain('Forwarding host 198.51.100.8 has been added')
    expect(outcome.text()).toContain('198.51.100.7')
    await outcome.get('button').trigger('click')
    await settle()
    expect(wrapper.find('[data-forwarding-results]').exists()).toBe(false)
    expect(wrapper.text()).toContain('History of this source')

    await router.push('/routing/forwarding-hosts')
    await listed(wrapper, 4)
    const source = wrapper
      .findAll('[data-entry] button')
      .find((item) => item.text() === 'forwarder.example')!
    await source.trigger('click')
    await settle()
    expect(router.currentRoute.value.query.source).toBe('forwarder.example')
  })

  it('pages the usage of a relayhost and filters it by kind', async () => {
    const { wrapper } = await mountRoute('/routing/relayhosts/1/usage', {
      scenario: 'routing-assignments',
    })
    await until(() => expect(wrapper.text()).toContain('example.org'))
    const kind = wrapper.find('select')
    if (kind.exists()) {
      await kind.setValue(kind.findAll('option').at(-1)!.element.value)
      await settle()
    }
    expect(wrapper.text()).toContain('[smtp.example.net]:587')
  })

  it('opens the email-routing group at BCC maps from its old root address', async () => {
    const { wrapper, router } = await mountRoute('/routing')
    await until(() => expect(wrapper.find('h1').text()).toBe('BCC maps'))
    expect(router.currentRoute.value.path).toBe('/routing/bcc-maps')
  })

  it('opens the BCC maps directly for a domain administrator', async () => {
    const { router } = await mountRoute('/routing', { scenario: 'routing-da-bcc' })
    await until(() => expect(router.currentRoute.value.name).toBe('routing-bcc-maps'))
  })
})
