import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { loadFeatureMessages } from '@/i18n'
import RuleForm from '@/features/system-settings/components/spam/RuleForm.vue'
import { mockRspamdRule } from '../../../mocks/scenarios/settings-rspamd-rules'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

beforeEach(() => {
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
async function setup(scenario = 'rspamd-rules-empty', edit = false) {
  useScenario(scenario)
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: RuleForm, props: edit ? { stored: mockRspamdRule(1) } : {} }],
  })
  await router.push('/')
  await router.isReady()
  return mountWithApp(RouterView, { global: { plugins: [router] } }).findComponent(RuleForm)
}
const writes = () =>
  mockState().requests.filter((row) =>
    ['createRspamdSettingsRule', 'updateRspamdSettingsRule'].includes(row.operationId ?? ''),
  )
describe('RuleForm (T109/T113)', () => {
  it('starts active with legacy order, and required fields focus a summary without a request', async () => {
    const wrapper = await setup()
    expect((wrapper.get('#rule-active').element as HTMLInputElement).checked).toBe(true)
    expect(
      wrapper
        .findAll('input,textarea')
        .map((field) => field.attributes('id'))
        .filter(Boolean),
    ).toEqual(['rule-description', 'rule-content', 'rule-active'])
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Please provide all values')
    expect(wrapper.text()).toContain('Map content cannot be empty')
    expect(writes()).toHaveLength(0)
  })
  it('checks structure without saving, marks the returned line, and clears obsolete marks when edited', async () => {
    const wrapper = await setup()
    await wrapper.get('#rule-description').setValue('Test')
    await wrapper.get('#rule-content').setValue('# header\napply {')
    await wrapper.get('[data-rule-check]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Unclosed brace'))
    expect(wrapper.text()).toContain('Go to line 2')
    expect(wrapper.get('#rule-content').attributes('aria-invalid')).toBe('true')
    expect(writes()).toHaveLength(1)
    expect(writes()[0]?.path).toContain('validateOnly=true')
    await wrapper.get('#rule-content').setValue('apply { symbols=["{"]; }')
    expect(wrapper.text()).not.toContain('Unclosed brace')
    await wrapper.get('[data-rule-check]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-rule-checked]').exists()).toBe(true))
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('saves a valid active rule and exposes the map refresh note', async () => {
    const wrapper = await setup()
    await wrapper.get('#rule-description').setValue('Test')
    await wrapper.get('#rule-content').setValue('priority=10;')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({
        description: 'Test',
        active: true,
      }),
    )
    expect(wrapper.text()).toContain('next refresh')
  })
  it('preserves a conflicting draft and requires an explicit fresh-version save', async () => {
    const wrapper = await setup('rspamd-rules-outdated', true)
    await wrapper.get('#rule-description').setValue('My draft')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-rule-outdated]').exists()).toBe(true))
    expect((wrapper.get('#rule-description').element as HTMLInputElement).value).toBe('My draft')
    expect(wrapper.text()).toContain('Changed by another administrator')
    expect(wrapper.emitted('saved')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ description: 'My draft' }),
    )
  })
  it('rejects overlong descriptions and oversized UTF-8 content before a request', async () => {
    const wrapper = await setup()
    await wrapper.get('#rule-description').setValue('x'.repeat(256))
    await wrapper.get('#rule-content').setValue('😀'.repeat(262145))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('255')
    expect(wrapper.get('#rule-content').attributes('aria-invalid')).toBe('true')
    expect(writes()).toHaveLength(0)
  })
})
