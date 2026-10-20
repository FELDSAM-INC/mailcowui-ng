import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ref, defineComponent } from 'vue'
import { queryKeys, type MailboxMailSettings } from '@/api'
import { fetchMailSettings, updateMailSettings } from '@/features/account/api/mail-settings'
import { useMailSettingChange } from '@/features/account/composables/useMailSettingChange'
import { loadLegacy } from '@/i18n/legacy'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))
const address = 'anna@example.org'

describe('mail settings: flags, scope and concurrency', () => {
  it('saves only the requested setting and rejects an outdated version', async () => {
    useScenario('account-mailbox')
    const client = testPlugins().queryClient
    const original = await fetchMailSettings(address)
    const changed = await updateMailSettings(
      client,
      address,
      { taggedMailHandling: 'subject' },
      original.etag,
    )
    expect(changed).toMatchObject({
      taggedMailHandling: 'subject',
      tlsEnforceInbound: original.tlsEnforceInbound,
    })
    expect(client.getQueryData(queryKeys.selfService.mailSettings(address))).toEqual(changed)
    await expect(
      updateMailSettings(client, address, { tlsEnforceOutbound: true }, original.etag),
    ).rejects.toMatchObject({ status: 412 })
  })

  it('allows unchanged restricted values but rejects changes without the individual flag', async () => {
    useScenario('account-mailbox-no-flags')
    const original = await fetchMailSettings(address)
    const client = testPlugins().queryClient
    await expect(
      updateMailSettings(
        client,
        address,
        { taggedMailHandling: original.taggedMailHandling },
        original.etag,
      ),
    ).resolves.toEqual(original)
    await expect(
      updateMailSettings(client, address, { taggedMailHandling: 'subject' }, original.etag),
    ).rejects.toMatchObject({ status: 403, requiredFlags: ['delimiterAction'] })
    await expect(
      updateMailSettings(
        client,
        address,
        { tlsEnforceOutbound: !original.tlsEnforceOutbound },
        original.etag,
      ),
    ).rejects.toMatchObject({ status: 403, requiredFlags: ['tlsPolicy'] })
    await expect(fetchMailSettings('other@outside.example')).rejects.toMatchObject({ status: 404 })
  })

  it('allows domain administrators to change tagging and TLS without user flags', async () => {
    useScenario('account-domain-admin-no-flags')
    const original = await fetchMailSettings(address)
    await expect(
      updateMailSettings(
        testPlugins().queryClient,
        address,
        { tlsEnforceOutbound: true },
        original.etag,
      ),
    ).resolves.toMatchObject({ tlsEnforceOutbound: true })
  })

  it('reports a shared-store outage without changing a stored setting', async () => {
    useScenario('account-mailbox')
    const original = await fetchMailSettings(address)
    mockState().selfService.outages.sharedStore = true
    await expect(
      updateMailSettings(
        testPlugins().queryClient,
        address,
        { taggedMailHandling: 'subject' },
        original.etag,
      ),
    ).rejects.toMatchObject({ status: 503, dependency: 'sharedStore' })
    expect(
      mockState().mailboxes.find((item) => item.localPart === 'anna')?.taggedMailHandling,
    ).toBe(original.taggedMailHandling)
  })
})

describe('single-setting saves', () => {
  async function setup() {
    useScenario('account-mailbox')
    const stored = ref<MailboxMailSettings>(await fetchMailSettings(address))
    const allowed = ref(true)
    const reload = vi.fn(async () => {
      stored.value = await fetchMailSettings(address)
    })
    let change!: ReturnType<typeof useMailSettingChange>
    const wrapper = mountWithApp(
      defineComponent({
        setup() {
          change = useMailSettingChange({
            stored: () => stored.value,
            canChange: () => allowed.value,
            reload,
          })
          return () => null
        },
      }),
    )
    return { stored, allowed, reload, change, wrapper }
  }

  it('announces a successful change and blocks duplicate or no-longer-permitted submissions', async () => {
    const { change, allowed } = await setup()
    const promise = change.save({ taggedMailHandling: 'subject' })
    expect(change.pending.value).toBe(true)
    await change.save({ taggedMailHandling: 'subfolder' })
    await promise
    expect(change.pending.value).toBe(false)
    expect(change.notice.value).toContain(address)
    expect(
      mockState().mailboxes.find((item) => item.localPart === 'anna')?.taggedMailHandling,
    ).toBe('subject')
    allowed.value = false
    await change.save({ taggedMailHandling: 'subfolder' })
    expect(
      mockState().mailboxes.find((item) => item.localPart === 'anna')?.taggedMailHandling,
    ).toBe('subject')
  })

  it('reloads a conflict without automatically resending the choice', async () => {
    const { stored, reload, change } = await setup()
    const row = mockState().mailboxes.find((item) => item.localPart === 'anna')!
    row.taggedMailHandling = 'subfolder'
    await change.save({ taggedMailHandling: 'subject' })
    expect(reload).toHaveBeenCalledOnce()
    expect(stored.value.taggedMailHandling).toBe('subfolder')
    expect(change.outdated.value).toBe(true)
    expect(row.taggedMailHandling).toBe('subfolder')
  })

  it('leaves the stored value intact after a refusal and exposes its problem', async () => {
    const { stored, change } = await setup()
    mockState().selfService.outages.sharedStore = true
    const original = stored.value.taggedMailHandling
    await change.save({ taggedMailHandling: 'subject' })
    expect(change.problem.value?.status).toBe(503)
    expect(stored.value.taggedMailHandling).toBe(original)
    expect(change.notice.value).toBe('')
  })
})
