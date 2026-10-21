import { beforeAll, describe, expect, it, vi } from 'vitest'
import { resetActiveSyncCache, resetGroupwareProfile } from '@/features/account/api/groupware'
import GroupwareResets from '@/features/account/components/groupware/GroupwareResets.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { loadLegacy } from '@/i18n/legacy'
import { useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))
const mailbox = 'anna@example.org'
describe('groupware resets', () => {
  it('resets the mailbox caches and enforces mailbox scope', async () => {
    const client = testPlugins().queryClient
    useScenario('account-mailbox')
    await expect(resetActiveSyncCache(client, mailbox)).resolves.toBeUndefined()
    await expect(resetGroupwareProfile(client, mailbox)).resolves.toBeUndefined()
    await expect(resetActiveSyncCache(client, 'other@outside.example')).rejects.toMatchObject({
      status: 404,
    })
  })

  it('requires the individual reset flags', async () => {
    const client = testPlugins().queryClient
    useScenario('account-mailbox-no-flags')
    await expect(resetActiveSyncCache(client, mailbox)).rejects.toMatchObject({ status: 403 })
    await expect(resetGroupwareProfile(client, mailbox)).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a reset when groupware is disabled', async () => {
    const client = testPlugins().queryClient
    useScenario('account-groupware-disabled')
    await expect(resetActiveSyncCache(client, mailbox)).rejects.toMatchObject({ status: 403 })
  })

  it('confirms a reset and requires the calendar/contact acknowledgement for SOGo', async () => {
    useScenario('account-mailbox')
    const wrapper = mountWithApp(GroupwareResets, {
      props: { mailbox, enabled: true, activeSync: true, profile: true },
    })
    await wrapper.get('[data-reset-activesync]').trigger('click')
    expect(confirmState.value?.description).toContain(mailbox)
    expect(confirmState.value?.acknowledge).toBeUndefined()
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toContain(mailbox))
    await wrapper.get('[data-reset-groupware]').trigger('click')
    expect(confirmState.value?.acknowledge?.label).toContain('contacts and calendars')
    settleConfirm(false)
  })

  it('does not submit a confirmation after the component is disposed or its permission is removed', async () => {
    useScenario('account-mailbox')
    const client = testPlugins().queryClient
    const execute = vi.spyOn(client.getMutationCache(), 'build')
    const wrapper = mountWithApp(GroupwareResets, {
      props: { mailbox, enabled: true, activeSync: true, profile: true },
    })
    await wrapper.get('[data-reset-activesync]').trigger('click')
    await wrapper.setProps({ activeSync: false })
    settleConfirm(true)
    await Promise.resolve()
    expect(execute).not.toHaveBeenCalled()
    await wrapper.get('[data-reset-groupware]').trigger('click')
    wrapper.unmount()
    settleConfirm(true)
    await Promise.resolve()
    expect(execute).not.toHaveBeenCalled()
  })

  it('hides unavailable actions', () => {
    useScenario('account-mailbox')
    const wrapper = mountWithApp(GroupwareResets, {
      props: { mailbox, enabled: false, activeSync: true, profile: true },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
