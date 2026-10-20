import { beforeEach, describe, expect, it } from 'vitest'
import AppLinkList from '@/features/system-settings/components/branding/AppLinkList.vue'
import { loadFeatureMessages } from '@/i18n'
import { mountWithApp } from '../../../../support/mount'
const rows = () =>
  Array.from({ length: 3 }, (_, i) => ({
    name: `App ${i + 1}`,
    url: `/app-${i + 1}`,
    signedInUrl: null,
    showOnLoginPage: true,
  }))
beforeEach(() => loadFeatureMessages('system-settings'))
describe('AppLinkList', () => {
  it('emits ordered edits, removal and an empty new row', async () => {
    const wrapper = mountWithApp(AppLinkList, {
      props: { modelValue: rows(), editable: true, username: 'admin' },
    })
    for (const button of wrapper.findAll('[data-move-up], [data-move-down]'))
      expect(button.attributes('aria-label')).toContain(button.text())
    await wrapper.get('[data-move-up="2"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject([
      { name: 'App 1' },
      { name: 'App 3' },
      { name: 'App 2' },
    ])
    await wrapper.get('[data-move-down="0"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]?.[0]).toMatchObject([
      { name: 'App 2' },
      { name: 'App 1' },
      { name: 'App 3' },
    ])
    await wrapper.get('[data-remove="1"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[2]?.[0]).toMatchObject([
      { name: 'App 1' },
      { name: 'App 3' },
    ])
    await wrapper.get('[data-add-link]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[3]?.[0]).toHaveLength(4)
    wrapper.unmount()
  })
  it('disables adding at 50 and all editing actions during a save', async () => {
    const wrapper = mountWithApp(AppLinkList, {
      props: {
        modelValue: Array.from({ length: 50 }, () => rows()[0]!),
        editable: true,
        username: 'admin',
      },
    })
    expect(wrapper.get('[data-add-link]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('50')
    await wrapper.setProps({ disabled: true })
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
    wrapper.unmount()
  })
  it('shows stored names as text and encoded signed-in previews without actions when read-only', () => {
    const wrapper = mountWithApp(AppLinkList, {
      props: {
        modelValue: [{ ...rows()[0]!, name: '<b>Help</b>', signedInUrl: '/help?u=%u' }],
        username: 'a+b@example.org',
      },
    })
    expect(wrapper.text()).toContain('<b>Help</b>')
    expect(wrapper.text()).toContain('/help?u=a%2Bb%40example.org')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})
