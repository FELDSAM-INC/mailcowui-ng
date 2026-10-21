import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type * as ConfirmModule from '@/shared/composables/useConfirm'
import { loadFeatureMessages } from '@/i18n'
import GlobalSieveFilterForm from '@/features/system-settings/components/mail-filtering/GlobalSieveFilterForm.vue'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
const approve = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/shared/composables/useConfirm', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfirmModule>()),
  useConfirm: () => approve,
}))
beforeEach(() => {
  approve.mockResolvedValue(true)
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 8, 24)
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
async function setup(scenario = 'global-sieve-default') {
  useScenario(scenario)
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: GlobalSieveFilterForm,
        props: {
          filter: structuredClone(mockState().settings.globalFilters[0]!),
          maxBytes: 1_048_576,
        },
      },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mountWithApp(RouterView, { global: { plugins: [router] } }).findComponent(
    GlobalSieveFilterForm,
  )
}
const writes = () =>
  mockState().requests.filter((request) => request.operationId === 'replaceGlobalSieveFilter')

it('quotes untrusted parser messages visibly and clears obsolete marks after editing', async () => {
  const wrapper = await setup()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Edit')!
    .trigger('click')
  mockState().failures.replaceGlobalSieveFilter = {
    status: 422,
    type: 'validation-failed',
    times: 1,
    errors: {
      script: [
        {
          code: 'sieveSyntax',
          message: 'Invalid',
          params: { line: 2, message: '<img src=x>\u202E parser detail' },
        },
      ],
    },
  }
  await wrapper.get('textarea').setValue('# Comment\nkeep')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Validate')!
    .trigger('click')
  await vi.waitFor(() => expect(wrapper.text()).toContain('[U+202E]'))
  expect(wrapper.text()).toContain('<img src=x>')
  expect(wrapper.find('img').exists()).toBe(false)
  const diagnostic = wrapper.get('q[lang="en"]')
  expect(diagnostic.text()).toBe('<img src=x>[U+202E] parser detail')
  expect(diagnostic.text()).not.toContain('Sieve parser error')
  expect(diagnostic.element.parentElement?.textContent).toContain('Sieve parser error:')
  expect(wrapper.text()).toContain('Go to line 2')
  await wrapper.get('textarea').setValue('keep;')
  expect(wrapper.text()).not.toContain('parser detail')
  expect(wrapper.find('q').exists()).toBe(false)
})

it('keeps a draft after cancelling confirmation and blocks oversized UTF-8 before requests', async () => {
  approve.mockResolvedValue(false)
  const wrapper = await setup()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Edit')!
    .trigger('click')
  await wrapper.get('textarea').setValue('# My draft\nkeep;')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Save changes')!
    .trigger('click')
  await vi.waitFor(() => expect(approve).toHaveBeenCalled())
  expect(writes()).toHaveLength(0)
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toContain('My draft')
  await wrapper.get('textarea').setValue('😀'.repeat(262145))
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Validate')!
    .trigger('click')
  expect(writes()).toHaveLength(0)
  expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
})

for (const scenario of ['global-sieve-default', 'global-sieve-restart-fails'])
  it(`reports saved script outcome for ${scenario}`, async () => {
    const wrapper = await setup(scenario)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit')!
      .trigger('click')
    await wrapper.get('textarea').setValue('# changed\nkeep;')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save changes')!
      .trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Filter was successfully written to file'),
    )
    expect(wrapper.text()).toContain(
      scenario.endsWith('fails')
        ? 'takes effect at the next restart'
        : 'Dovecot was restarted successfully',
    )
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
  })
