import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { ApiProblem } from '@/api'
import { loadFeatureMessages, lt } from '@/i18n'
import * as mailApi from '@/features/system-settings/api/mass-mail'
import MassMailSendPage from '@/features/system-settings/pages/mass-mail/MassMailSendPage.vue'
import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState, useScenario } from '../../../mocks/node'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

vi.mock('@/shared/composables/useConfirm', () => ({
  useConfirm: () => () => Promise.resolve(true),
}))
const mounted: VueWrapper[] = []
beforeEach(() => {
  installMatchMedia()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})
async function setup(include = false) {
  useScenario('mass-mail-120')
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: MassMailSendPage, props: { capabilities: settingsCapabilities() } },
      {
        path: '/jobs',
        name: 'system-settings-mass-mail-jobs',
        component: { template: '<p>Jobs</p>' },
      },
      {
        path: '/jobs/:jobId',
        name: 'system-settings-mass-mail-job',
        component: { template: '<p>Job</p>' },
      },
      { path: '/audit', name: 'audit-log', component: { template: '<p>Audit</p>' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  mounted.push(wrapper)
  if (include) {
    await wrapper.get('#mass-list-mode').setValue('include')
    await wrapper.get('#mass-paste').setValue('user001@example.org')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Add addresses')!
      .trigger('click')
  }
  const next = () => wrapper.get('[data-compose-step-actions] button:last-child')
  await next().trigger('click')
  await wrapper.get('#mass-sender').setValue('noreply@localhost')
  await wrapper.get('#mass-subject').setValue('Draft notice')
  await wrapper.get('#mass-textBody').setValue('Preserve this body')
  await next().trigger('click')
  await vi.waitFor(() => expect(wrapper.find('[data-recipient-count]').exists()).toBe(true))
  await next().trigger('click')
  return { wrapper, send: wrapper.findAll('button').find((button) => button.text() === 'Send')! }
}
describe('mobile compose API errors (T020/T033)', () => {
  it('reveals and focuses a single refused message field instead of the recipients step', async () => {
    const { wrapper, send } = await setup()
    ;(send.element as HTMLButtonElement).focus()
    await send.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('#mass-sender-error').exists()).toBe(true))
    expect(wrapper.get('#mass-sender-error').isVisible()).toBe(true)
    expect(wrapper.get('#mass-sender-error').text()).toContain(lt('danger.from_invalid'))
    expect(document.activeElement).toBe(wrapper.get('#mass-sender').element)
    expect(wrapper.get('[data-recipient-selection]').isVisible()).toBe(false)
    expect((wrapper.get('#mass-textBody').element as HTMLTextAreaElement).value).toBe(
      'Preserve this body',
    )
    expect(mockState().massMail.jobs).toHaveLength(0)
  })

  it('opens the corresponding step before following mixed-error summary links', async () => {
    const { wrapper, send } = await setup(true)
    mockState().failures.createMassMailJob = {
      status: 422,
      type: 'validation-failed',
      times: 1,
      errors: {
        sender: [
          { code: 'invalidFormat', params: { format: 'email' }, message: 'Private diagnostic' },
        ],
        'selection.include.0': [
          {
            code: 'notEligible',
            params: { reason: 'notReceiving' },
            message: 'Private diagnostic',
          },
        ],
      },
    }
    ;(send.element as HTMLButtonElement).focus()
    await send.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('a[href="#mass-sender"]').exists()).toBe(true))
    expect(wrapper.get('[data-recipient-selection]').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('This mailbox cannot receive mail.')
    await wrapper.get('a[href="#mass-sender"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('#mass-sender-error').isVisible()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('#mass-sender').element)
    await wrapper.get('a[href="#mass-mailboxes"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-picker-item-errors]').isVisible()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('#mass-mailboxes').element)
    expect(wrapper.text()).not.toContain('Private diagnostic')
    expect(mockState().massMail.jobs).toHaveLength(0)
  })

  it('keeps an intentional focus move when a late refusal reveals its field', async () => {
    const { wrapper, send } = await setup()
    let reject!: (reason: unknown) => void
    vi.spyOn(mailApi, 'createJob').mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    ;(send.element as HTMLButtonElement).focus()
    await send.trigger('click')
    await vi.waitFor(() => expect(send.attributes('disabled')).toBeDefined())
    const outside = wrapper.get<HTMLAnchorElement>('a[href="/jobs"]')
    outside.element.focus()
    reject(
      ApiProblem.fromParts({
        kind: 'problem',
        status: 422,
        type: '/api/v2/problems/validation-failed',
        fieldErrors: new Map([
          [
            'sender',
            [{ code: 'invalidFormat', params: { format: 'email' }, message: 'Private diagnostic' }],
          ],
        ]),
      }),
    )
    await vi.waitFor(() => expect(wrapper.find('#mass-sender-error').exists()).toBe(true))
    expect(wrapper.get('#mass-sender-error').isVisible()).toBe(true)
    expect(document.activeElement).toBe(outside.element)
  })
})
