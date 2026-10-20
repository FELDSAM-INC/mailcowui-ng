import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createQueryClient } from '@/api'
import { useMassMailCompose } from '@/features/system-settings/composables/useMassMailCompose'
import { mockState, useScenario } from '../../../mocks/node'
import { mockMailbox } from '../../../mocks/factories/mailbox'

function setup() {
  useScenario('mass-mail-120')
  const client = createQueryClient(),
    scope = effectScope()
  const compose = scope.run(() =>
    useMassMailCompose({ client, sender: 'noreply@mail.example.org', allowed: () => true }),
  )!
  compose.draft.subject = 'Maintenance'
  compose.draft.textBody = 'A notice'
  return {
    compose,
    client,
    stop: () => {
      scope.stop()
      client.clear()
    },
  }
}
describe('mass mail compose transitions', () => {
  it('never sends until a current recipient preview is explicitly confirmed', async () => {
    const { compose, stop } = setup()
    expect(await compose.send()).toBeNull()
    await compose.preview()
    expect(compose.previewData.value?.meta.recipientCount).toBe(120)
    expect(mockState().massMail.jobs).toHaveLength(0)
    compose.confirm()
    const job = await compose.send()
    expect(job?.recipientCount).toBe(120)
    expect(compose.dirty.value).toBe(false)
    stop()
  })
  it('discards a preview and its confirmation as soon as the selection changes', async () => {
    const { compose, stop } = setup()
    await compose.preview()
    compose.confirm()
    compose.draft.listMode = 'include'
    compose.draft.mailboxes = ['user001@example.org']
    expect(compose.previewData.value).toBeNull()
    expect(compose.confirmation.value).toBeNull()
    expect(await compose.send()).toBeNull()
    expect(mockState().massMail.jobs).toHaveLength(0)
    stop()
  })
  it('changed recipient count refreshes the preview and requires a fresh confirmation', async () => {
    const { compose, stop } = setup()
    await compose.preview()
    compose.confirm()
    mockState().mailboxes.push(mockMailbox({ localPart: 'new', domain: 'example.org' }))
    expect(await compose.send()).toBeNull()
    expect(compose.countChanged.value).toBe(true)
    expect(compose.previewData.value?.meta.recipientCount).toBe(121)
    expect(compose.confirmation.value).toBeNull()
    expect(mockState().massMail.jobs).toHaveLength(0)
    compose.confirm()
    expect((await compose.send())?.recipientCount).toBe(121)
    stop()
  })
  it('refused entries return to recipients, and a running job keeps the draft and exposes its link', async () => {
    const { compose, stop } = setup()
    compose.draft.listMode = 'exclude'
    compose.draft.mailboxes = ['ghost@example.org']
    await compose.preview()
    expect(compose.problem.value?.fieldErrors.has('selection.exclude.0')).toBe(true)
    expect(compose.step.value).toBe(1)
    compose.draft.listMode = 'none'
    await compose.preview()
    compose.confirm()
    const job = await compose.send()
    compose.draft.subject = 'Second'
    compose.draft.textBody = 'Another notice'
    await compose.preview()
    compose.confirm()
    await compose.send()
    expect(compose.runningJobId.value).toBe(job?.id)
    expect(compose.draft.subject).toBe('Second')
    stop()
  })
  it('uses the newest preview search when an older response arrives after it', async () => {
    const { compose, client, stop } = setup()
    const first = {
      data: [{ address: 'old@example.org', domain: 'example.org' }],
      meta: { total: 120, recipientCount: 120, limit: 25, offset: 0 },
    }
    const second = {
      data: [{ address: 'user001@example.org', domain: 'example.org' }],
      meta: { total: 1, recipientCount: 120, limit: 25, offset: 0 },
    }
    let finish!: (value: typeof first) => void
    vi.spyOn(client, 'fetchQuery')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(second)
    const pending = compose.preview()
    await compose.preview({ q: 'user001@' })
    expect(compose.previewData.value).toEqual(second)
    finish(first)
    await pending
    expect(compose.previewData.value).toEqual(second)
    expect(compose.pending.value).toBe(false)
    stop()
  })
})
