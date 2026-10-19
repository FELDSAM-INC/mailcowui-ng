// The routing add and edit pages through their routes (UI 009 T031, T058, T082, T091, T098, T104):
// what each form sends, legacy's refusals at their fields, the write-only passwords, the read-only
// BCC map without the permission, and the forwarding host outcomes.
import { describe, expect, it, vi } from 'vitest'

import * as announcer from '@/shared/composables/useAnnouncer'

import { mockState } from '../../../../mocks/node'
import { mountRoute, settle, until } from './mount-route'

type Wrapper = Awaited<ReturnType<typeof mountRoute>>['wrapper']

async function field(wrapper: Wrapper, id: string) {
  await until(() => wrapper.get(`#${id}`))
  return wrapper.find<HTMLInputElement>(`#${id}`)
}

async function fill(wrapper: Wrapper, values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) await (await field(wrapper, id)).setValue(value)
}

async function submit(wrapper: Wrapper) {
  await wrapper.get('form[data-entry-form]').trigger('submit')
  await settle()
}

const requestsOf = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

describe('routing forms', { timeout: 60_000 }, () => {
  it('adds a relayhost with credentials, after refusing an empty host', async () => {
    const announce = vi.spyOn(announcer, 'announce')
    const { wrapper, router } = await mountRoute('/routing/relayhosts/new')
    await field(wrapper, 'relayhost-add-host')
    await submit(wrapper)
    expect(wrapper.find('#relayhost-add-host-error').exists()).toBe(true)
    expect(requestsOf('createRelayhost')).toHaveLength(0)
    await fill(wrapper, {
      'relayhost-add-host': '[new.example]:587',
      'relayhost-add-username': 'new-user',
      'relayhost-add-password': 'New-Secret-1',
    })
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-relayhosts'))
    expect(mockState().routing.relayhosts.some((r) => r.host === '[new.example]:587')).toBe(true)
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('[new.example]:587'))
  })

  it('refuses an invalid relayhost host with legacy’s message at the field', async () => {
    const { wrapper } = await mountRoute('/routing/relayhosts/new')
    await fill(wrapper, { 'relayhost-add-host': 'bad host!' })
    await submit(wrapper)
    await until(() =>
      expect(wrapper.find('#relayhost-add-host-error').text()).toContain('bad host!'),
    )
    expect((await field(wrapper, 'relayhost-add-password')).element.value).toBe('')
  })

  it('edits a relayhost and removes its stored password', async () => {
    const { wrapper, router } = await mountRoute('/routing/relayhosts/1')
    const username = await field(wrapper, 'relayhost-edit-username')
    await until(() => expect(username.element.value).not.toBe(''))
    expect((await field(wrapper, 'relayhost-edit-password')).element.value).toBe('')
    const remove = wrapper.findAll('button').find((item) => item.text() === 'Remove password')!
    await remove.trigger('click')
    await settle()
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-relayhosts'))
    expect(mockState().routing.relayhosts.find((r) => r.id === 1)?.password ?? null).toBeNull()
  })

  it('changes a relayhost’s host and active state', async () => {
    const { wrapper, router } = await mountRoute('/routing/relayhosts/2')
    const host = await field(wrapper, 'relayhost-edit-host')
    await until(() => expect(host.element.value).toBe('relay.example.com'))
    await host.setValue('relay2.example.com')
    await (await field(wrapper, 'relayhost-edit-active')).setValue(false)
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-relayhosts'))
    expect(mockState().routing.relayhosts.find((r) => r.id === 2)).toMatchObject({
      host: 'relay2.example.com',
      active: false,
    })
  })

  it('adds a transport per destination with one outcome each', async () => {
    const { wrapper, router } = await mountRoute('/routing/transports/new')
    await fill(wrapper, {
      'transport-add-destination': 'one.example, two.example',
      'transport-add-nextHop': '[relay.partner.example]:25',
      'transport-add-username': 'partner',
      'transport-add-password': 'Partner-Secret-2',
    })
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-transports'))
    const destinations = mockState().routing.transports.map((t) => t.destination)
    expect(destinations).toEqual(expect.arrayContaining(['one.example', 'two.example']))
    expect(requestsOf('createTransport')).toHaveLength(2)
  })

  it('keeps refused transport destinations in the field with their messages', async () => {
    const { wrapper } = await mountRoute('/routing/transports/new')
    await fill(wrapper, {
      'transport-add-destination': 'good.example bad_dest!!',
      'transport-add-nextHop': '[relay.partner.example]:25',
    })
    await submit(wrapper)
    await until(() =>
      expect((wrapper.get('#transport-add-destination').element as HTMLInputElement).value).toBe(
        'bad_dest!!',
      ),
    )
    expect(wrapper.text()).toContain('bad_dest!!')
  })

  it('changes a shared transport password and names the other transports', async () => {
    const announce = vi.spyOn(announcer, 'announce')
    const { wrapper, router } = await mountRoute('/routing/transports/1')
    const destination = await field(wrapper, 'transport-edit-destination')
    await until(() => expect(destination.element.value).toBe('a.example'))
    await fill(wrapper, { 'transport-edit-password': 'Changed-Secret-3' })
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-transports'))
    expect(announce.mock.calls.map((call) => call[0]).join(' ')).toContain('b.example')
  })

  it('edits a BCC map', async () => {
    const { wrapper, router } = await mountRoute('/routing/bcc-maps/2')
    const destination = await field(wrapper, 'bcc-edit-bccDestination')
    await until(() => expect(destination.element.value).toBe('alice-copy@archive.example'))
    await destination.setValue('alice-new@archive.example')
    await (await field(wrapper, 'bcc-edit-type')).setValue('rcpt')
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-bcc-maps'))
    expect(mockState().routing.bccMaps.find((m) => m.id === 2)).toMatchObject({
      bccDestination: 'alice-new@archive.example',
      type: 'recipient',
    })
  })

  it('shows a BCC map read-only without the permission', async () => {
    const readonly = await mountRoute('/routing/bcc-maps/2', { scenario: 'routing-da-readonly' })
    await until(() => expect(readonly.wrapper.text()).toContain('alice-copy@archive.example'))
    expect(readonly.wrapper.find('input[type="text"]').exists()).toBe(false)
  })

  it('refuses an empty BCC map form at its fields', async () => {
    const { wrapper } = await mountRoute('/routing/bcc-maps/new')
    await field(wrapper, 'bcc-add-bccDestination')
    await submit(wrapper)
    await until(() => expect(wrapper.find('#bcc-add-bccDestination-error').text()).toContain('BCC'))
    expect(requestsOf('createBccMap')).toHaveLength(0)
  })

  it('adds and edits a TLS policy map, and refuses a duplicate destination', async () => {
    const { wrapper, router } = await mountRoute('/routing/tls-policy-maps/new')
    await fill(wrapper, { 'tls-form-destination': 'Bücher.example' })
    await (await field(wrapper, 'tls-form-policy')).setValue('dane-only')
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-tls-policy-maps'))
    expect(
      mockState().routing.tlsPolicyMaps.some((m) => m.destination === 'xn--bcher-kva.example'),
    ).toBe(true)

    // The add and edit routes share one page component.
    await router.push('/routing/tls-policy-maps/1')
    await until(() =>
      expect((wrapper.get('#tls-form-destination').element as HTMLInputElement).value).toBe(
        'none.example',
      ),
    )
    await (await field(wrapper, 'tls-form-parameters')).setValue('protocols=!SSLv2')
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-tls-policy-maps'))
    expect(mockState().routing.tlsPolicyMaps.find((m) => m.id === 1)?.parameters).toBe(
      'protocols=!SSLv2',
    )
    await router.push('/routing/tls-policy-maps/new')
    await settle()
    await fill(wrapper, { 'tls-form-destination': 'none.example' })
    await submit(wrapper)
    await until(() =>
      expect(wrapper.find('#tls-form-destination-error').text()).toContain('none.example'),
    )
  })

  it('adds and edits a recipient map, and refuses a duplicate original recipient', async () => {
    const { wrapper, router } = await mountRoute('/routing/recipient-maps/new')
    await fill(wrapper, {
      'recipient-form-originalDestination': 'old@new.example',
      'recipient-form-newDestination': 'new@new.example',
    })
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-recipient-maps'))
    expect(
      mockState().routing.recipientMaps.some((m) => m.originalDestination === 'old@new.example'),
    ).toBe(true)

    await router.push('/routing/recipient-maps/1')
    await until(() =>
      expect(
        (wrapper.get('#recipient-form-originalDestination').element as HTMLInputElement).value,
      ).toBe('@old.example'),
    )
    await (await field(wrapper, 'recipient-form-newDestination')).setValue('changed@new.example')
    await (await field(wrapper, 'recipient-form-active')).setValue(false)
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.name).toBe('routing-recipient-maps'))
    expect(mockState().routing.recipientMaps.find((m) => m.id === 1)).toMatchObject({
      newDestination: 'changed@new.example',
      active: false,
    })
    await router.push('/routing/recipient-maps/new')
    await settle()
    await fill(wrapper, {
      'recipient-form-originalDestination': 'old@new.example',
      'recipient-form-newDestination': 'other@new.example',
    })
    await submit(wrapper)
    await until(() =>
      expect(wrapper.find('#recipient-form-originalDestination-error').text()).toContain(
        'old@new.example',
      ),
    )
  })

  it('adds a forwarding host and hands its outcome to the list', async () => {
    const { wrapper, router } = await mountRoute('/routing/forwarding-hosts/new')
    await fill(wrapper, { 'fwdhost-add-host': 'forwarder.example' })
    await (await field(wrapper, 'fwdhost-add-spamFilter')).setValue('0')
    await submit(wrapper)
    await until(() => expect(router.currentRoute.value.query.source).toBe('forwarder.example'))
    await until(() =>
      expect(wrapper.get('[data-forwarding-results]').text()).toContain('198.51.100.8'),
    )
  })

  it('shows a name without addresses at the field and a DNS outage with a retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { wrapper } = await mountRoute('/routing/forwarding-hosts/new')
      await submit(wrapper)
      expect(wrapper.find('#fwdhost-add-host-error').exists()).toBe(true)
      await fill(wrapper, { 'fwdhost-add-host': 'nothing.example' })
      await submit(wrapper)
      await until(() =>
        expect(wrapper.find('#fwdhost-add-host-error').text()).toContain('nothing.example'),
      )
      await fill(wrapper, { 'fwdhost-add-host': 'dns-down.example' })
      await submit(wrapper)
      await until(() => expect(wrapper.text()).toContain('temporarily unavailable'))
      expect(wrapper.text()).not.toContain('Try again')
      await vi.advanceTimersByTimeAsync(6000)
      await settle()
      await until(() => expect(wrapper.text()).toContain('Try again'))
    } finally {
      vi.useRealTimers()
    }
  })
})
