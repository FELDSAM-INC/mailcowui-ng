import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useMailSettingsEditor } from '@/features/account/composables/useMailSettingsEditor'
import { loadLegacy } from '@/i18n/legacy'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
beforeAll(() => loadLegacy('en-gb'))

async function setup() {
  useScenario('account-admin')
  const allowed = ref(true)
  let editor!: ReturnType<typeof useMailSettingsEditor>
  mountWithApp(
    defineComponent({
      setup() {
        editor = useMailSettingsEditor({
          mailbox: () => 'anna@example.org',
          canChange: () => allowed.value,
        })
        return () => null
      },
    }),
  )
  await vi.waitFor(() => expect(editor.query.data.value).toBeDefined())
  editor.companion.open()
  return { editor, allowed }
}
describe('mail settings in the mailbox edit section', () => {
  it('keeps changes local until the section saves and discards without sending', async () => {
    const { editor } = await setup()
    const original = editor.values.value!.taggedMailHandling
    editor.choose('taggedMailHandling', 'subject')
    expect(editor.companion.dirty()).toBe(true)
    expect(
      mockState().mailboxes.find((item) => item.localPart === 'anna')?.taggedMailHandling,
    ).toBe(original)
    editor.companion.discard()
    expect(editor.values.value?.taggedMailHandling).toBe(original)
    editor.choose('taggedMailHandling', 'subject')
    await expect(editor.companion.save()).resolves.toBe('saved')
    expect(
      mockState().mailboxes.find((item) => item.localPart === 'anna')?.taggedMailHandling,
    ).toBe('subject')
    expect(editor.companion.dirty()).toBe(false)
  })
  it('keeps a draft on 412 and only saves it when the user explicitly retries', async () => {
    const { editor } = await setup()
    editor.choose('taggedMailHandling', 'subject')
    const mailbox = mockState().mailboxes.find((item) => item.localPart === 'anna')!
    mailbox.taggedMailHandling = 'subfolder'
    await expect(editor.companion.save()).resolves.toBe('outdated')
    expect(editor.values.value?.taggedMailHandling).toBe('subject')
    expect(editor.companion.outdated()).toMatchObject([{ field: 'taggedMailHandling' }])
    expect(mailbox.taggedMailHandling).toBe('subfolder')
    await expect(editor.companion.save()).resolves.toBe('saved')
    expect(mailbox.taggedMailHandling).toBe('subject')
  })
  it('retains drafts after a network/service failure and stops sending when permission changes', async () => {
    const { editor, allowed } = await setup()
    editor.choose('tlsEnforceOutbound', true)
    mockState().selfService.outages.sharedStore = true
    await expect(editor.companion.save()).resolves.toBe('failed')
    expect(editor.values.value?.tlsEnforceOutbound).toBe(true)
    expect(editor.companion.failure()).toBeTruthy()
    allowed.value = false
    await expect(editor.companion.save()).resolves.toBe('unchanged')
  })
})
