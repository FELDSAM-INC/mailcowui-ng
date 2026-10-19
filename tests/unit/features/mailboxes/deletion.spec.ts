// Deleting a mailbox (UI 003 T081, data-model §2 "DeletionImpact", §7.2): the impact of the
// preview (non-zero counts, present settings, retention in days, hours or minutes, blockers), its
// views, and the flow: a fresh preview, blockers with "Check again", the deletion with the
// preview's version, an outdated deletion asking again with a notice, a vanished mailbox, a
// temporary failure and an unknown outcome.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { fetchMailbox } from '@/features/mailboxes/api'
import MailboxDeleteBlockers from '@/features/mailboxes/components/delete/MailboxDeleteBlockers.vue'
import MailboxDeleteImpact from '@/features/mailboxes/components/delete/MailboxDeleteImpact.vue'
import { useMailboxDeletion } from '@/features/mailboxes/composables/useMailboxDeletion'
import { deletionImpact, retentionOf } from '@/features/mailboxes/deletion'
import type { MailboxDeletionPreview } from '@/features/mailboxes/types'
import * as announcer from '@/shared/composables/useAnnouncer'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

afterEach(() => vi.restoreAllMocks())

const preview = (overrides: Partial<MailboxDeletionPreview> = {}): MailboxDeletionPreview => ({
  address: 'big@a.example',
  blockers: [],
  canProceed: true,
  counts: {
    appPasswords: 2,
    bccMaps: 0,
    oauthGrants: 0,
    passkeys: 1,
    quarantineItems: 0,
    recentLogins: 0,
    secondFactors: 0,
    senderPermissionsGranted: 0,
    senderPermissionsHeld: 0,
    sieveFilters: 0,
    spamFilterSettings: 0,
    syncJobs: 0,
    tags: 2,
    temporaryAliases: 0,
  },
  etag: '"v1"',
  exclusiveAliases: { addresses: ['info@a.example'], count: 1 },
  garbageRetentionMinutes: 7200,
  mail: { messageCount: 10_000, storageUsed: 2 * 1024 ** 3 },
  present: {
    pushNotificationSettings: false,
    rateLimit: null,
    taggedMailHandling: true,
    webmailData: true,
  },
  sharedAliases: { addresses: ['team@a.example'], count: 1 },
  ...overrides,
})

describe('deletionImpact', () => {
  it('keeps non-zero counts and present settings, in the listed order', () => {
    const impact = deletionImpact(preview())
    expect(impact.counts).toEqual([
      { kind: 'tags', count: 2 },
      { kind: 'appPasswords', count: 2 },
      { kind: 'passkeys', count: 1 },
    ])
    expect(impact.present).toEqual(['webmailData', 'taggedMailHandling'])
    expect(impact.etag).toBe('"v1"')
    expect(impact.retention).toEqual({ value: 5, unit: 'day' })
  })

  it('gives the retention in days, hours or minutes', () => {
    expect(retentionOf(1440)).toEqual({ value: 1, unit: 'day' })
    expect(retentionOf(120)).toEqual({ value: 2, unit: 'hour' })
    expect(retentionOf(90)).toEqual({ value: 90, unit: 'minute' })
    expect(retentionOf(0)).toEqual({ value: 0, unit: 'minute' })
  })
})

describe('MailboxDeleteImpact', () => {
  it('shows legacy’s confirmation text with the item, the mail, the removals and the aliases', () => {
    const wrapper = mountWithApp(MailboxDeleteImpact, {
      props: { impact: deletionImpact(preview()), readable: 'big@a.example', notice: 'Changed' },
    })
    const text = wrapper.text()
    expect(text).toContain('Please confirm your changes to the following object id')
    expect(wrapper.get('[data-delete-item]').text()).toBe('big@a.example')
    expect(wrapper.get('[data-impact="mail"]').text()).toBe(
      'The mail (2 GiB in 10,000 messages) is moved to the garbage area and purged after 5 days.',
    )
    expect(wrapper.get('[data-impact="passkeys"]').text()).toBe('Passkeys: 1')
    expect(wrapper.get('[data-impact="webmailData"]').text()).toContain('Webmail data')
    expect(wrapper.find('[data-impact="rateLimit"]').exists()).toBe(false)
    expect(wrapper.get('[data-impact="exclusiveAliases"]').text()).toContain('info@a.example')
    expect(wrapper.get('[data-impact="sharedAliases"]').text()).toContain(
      'Aliases that keep their other recipients: 1',
    )
    expect(wrapper.get('[role="status"]').text()).toBe('Changed')
  })

  it('names the blockers', () => {
    const wrapper = mountWithApp(MailboxDeleteBlockers, {
      props: {
        impact: deletionImpact(
          preview({ canProceed: false, blockers: [{ dependency: 'mailStore', detail: 'down' }] }),
        ),
        readable: 'big@a.example',
      },
    })
    expect(wrapper.text()).toContain('big@a.example cannot be removed now:')
    expect(wrapper.get('[data-blocker]').text()).toBe('The mail store is unreachable.')
  })
})

describe('useMailboxDeletion', () => {
  function setup(scenario = 'admin-delete') {
    useScenario(scenario)
    let deletion!: ReturnType<typeof useMailboxDeletion>
    const onDeleted = vi.fn()
    mountWithApp(
      defineComponent({
        setup: () => ((deletion = useMailboxDeletion({ onDeleted })), () => h('div')),
      }),
    )
    return { deletion: () => deletion, onDeleted }
  }

  it('stops when cancelled and deletes with the preview’s version when confirmed', async () => {
    const { deletion, onDeleted } = setup()
    const say = vi.spyOn(announcer, 'announce')
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValueOnce(false)
    const big = await fetchMailbox('big@a.example')
    expect(await deletion().start(big)).toBe('cancelled')
    expect(ask.mock.calls[0]?.[0]).toMatchObject({
      title: 'Confirm deletion',
      confirmLabel: 'Delete now',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    ask.mockResolvedValueOnce(true)
    expect(await deletion().start(big)).toBe('deleted')
    expect(say).toHaveBeenCalledWith('Mailbox big@a.example has been removed')
    expect(onDeleted).toHaveBeenCalledWith('Mailbox big@a.example has been removed')
    expect(mockState().mailboxes.some((mailbox) => mailbox.localPart === 'big')).toBe(false)
    const deletes = mockState().requests.filter((r) => r.operationId === 'deleteMailbox')
    expect(deletes[0]?.headers['if-match']).toBe(big.etag)
  })

  it('asks again with a notice when the mailbox changed after the preview', async () => {
    const { deletion } = setup()
    const big = await fetchMailbox('big@a.example')
    const ask = vi.spyOn(confirmModule, 'confirm')
    ask.mockImplementationOnce(() => {
      const state = mockState()
      state.mailboxes.find((mailbox) => mailbox.localPart === 'big')!.displayName = 'Changed'
      return Promise.resolve(true)
    })
    ask.mockResolvedValueOnce(false)
    expect(await deletion().start(big)).toBe('cancelled')
    const second = ask.mock.calls[1]?.[0]
    expect((second?.content?.props as { notice?: string }).notice).toBe(
      'The mailbox was changed in the meantime. Check the impact again.',
    )
  })

  it('offers "Check again" while a store is unreachable', async () => {
    const { deletion } = setup('delete-store-unreachable')
    const big = await fetchMailbox('big@a.example')
    const ask = vi.spyOn(confirmModule, 'confirm')
    ask.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(await deletion().start(big)).toBe('cancelled')
    expect(ask.mock.calls[0]?.[0].confirmLabel).toBe('Check again')
    expect(ask.mock.calls[1]?.[0].confirmLabel).toBe('Delete now')
  })

  it('reports a temporary failure, an unknown outcome and a vanished mailbox', async () => {
    const { deletion } = setup()
    const ask = vi.spyOn(confirmModule, 'confirm')
    const broken = await fetchMailbox('broken@a.example')
    ask.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(await deletion().start(broken)).toBe('failed')
    expect(ask.mock.calls[1]?.[0]).toMatchObject({
      title: 'broken@a.example was not removed',
      alertOnly: true,
    })
    expect(ask.mock.calls[1]?.[0].description).toContain('Nothing was deleted.')
    const slow = await fetchMailbox('slow@a.example')
    ask.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(await deletion().start(slow)).toBe('unknown')
    const anna = await fetchMailbox('anna@a.example')
    mockState().mailboxes = mockState().mailboxes.filter((mailbox) => mailbox.localPart !== 'anna')
    ask.mockResolvedValueOnce(false)
    expect(await deletion().start(anna)).toBe('gone')
    expect(ask.mock.calls.at(-1)?.[0].description).toBe('This mailbox no longer exists.')
    await flushPromises()
  })
})
