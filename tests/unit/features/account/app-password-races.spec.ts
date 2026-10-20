import { flushPromises } from '@vue/test-utils'
import { beforeAll, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { AppPasswordResult } from '@/api'
import * as requests from '@/features/account/api/app-passwords'
import AppPasswordForm from '@/features/account/components/app-passwords/AppPasswordForm.vue'
import AppPasswordDetailPage from '@/features/account/pages/AppPasswordDetailPage.vue'
import { loadLegacy } from '@/i18n/legacy'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))
function deferred<T>() {
  let resolve!: (value: T) => void
  return {
    promise: new Promise<T>((done) => {
      resolve = done
    }),
    resolve: (value: T) => resolve(value),
  }
}

it('does not present a created secret after the mailbox context changed', async () => {
  useScenario('account-admin')
  const answer = await requests.createAppPassword('anna@example.org', {
    name: 'Pending',
    active: true,
  })
  const pending = deferred<AppPasswordResult>()
  vi.spyOn(requests, 'createAppPassword').mockReturnValue(pending.promise)
  const wrapper = mountWithApp(AppPasswordForm, {
    props: { mailbox: 'anna@example.org', canChange: true },
  })
  await wrapper.get('input[name="name"]').setValue('Pending')
  await wrapper.get('form').trigger('submit')
  await wrapper.setProps({ mailbox: 'alice@example.org' })
  pending.resolve(answer)
  await flushPromises()
  expect(wrapper.emitted('saved')).toBeUndefined()
})

it.each([false, true])(
  'does not present a renewed password after leaving its route (return=%s)',
  async (returnToOriginal) => {
    useScenario('account-mailbox')
    const original = await requests.fetchAppPassword('anna@example.org', 1)
    const answer = await requests.regenerateAppPassword(
      original.mailbox,
      original.id,
      original.etag,
    )
    const pending = deferred<AppPasswordResult>()
    vi.spyOn(requests, 'regenerateAppPassword').mockReturnValue(pending.promise)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/account/app-passwords/:appPasswordId', component: AppPasswordDetailPage }],
    })
    await router.push('/account/app-passwords/1')
    await router.isReady()
    const wrapper = mountWithApp(
      { render: () => h(RouterView) },
      { global: { plugins: [router] }, attachTo: document.body },
    )
    await vi.waitFor(() => expect(wrapper.find('[data-app-password-form]').exists()).toBe(true))
    const button = wrapper.findAll('button').find((button) => button.text() === 'generate')!
    await button.trigger('click')
    expect(confirmState.value).not.toBeNull()
    settleConfirm(true)
    await flushPromises()
    await router.push('/account/app-passwords/2')
    if (returnToOriginal) await router.push('/account/app-passwords/1')
    pending.resolve(answer)
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.get('h1').text()).toContain(returnToOriginal ? 'Laptop' : 'Phone'),
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  },
)
