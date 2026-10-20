import { beforeEach, describe, expect, it } from 'vitest'
import AppLinkEntryForm from '@/features/system-settings/components/branding/AppLinkEntryForm.vue'
import { loadFeatureMessages } from '@/i18n'
import { mountWithApp } from '../../../../support/mount'
beforeEach(() => loadFeatureMessages('system-settings'))
describe('AppLinkEntryForm', () => {
  it('inverts the classic hide flag and clears an optional signed-in URL to null', async () => {
    const wrapper = mountWithApp(AppLinkEntryForm, {
      props: {
        modelValue: {
          name: 'Help',
          url: '/help',
          signedInUrl: '/help?u=%u',
          showOnLoginPage: true,
        },
        index: 0,
        username: 'admin',
      },
    })
    await wrapper.get('#app-link-0-showOnLoginPage').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ showOnLoginPage: false })
    await wrapper.get('#app-link-0-signedInUrl').setValue('')
    expect(wrapper.emitted('update:modelValue')?.[1]?.[0]).toMatchObject({ signedInUrl: null })
    wrapper.unmount()
  })
  it('associates per-index server errors and refuses a multiline pasted name', async () => {
    const wrapper = mountWithApp(AppLinkEntryForm, {
      props: {
        modelValue: { name: 'Help', url: '/help', signedInUrl: null, showOnLoginPage: true },
        index: 2,
        username: 'admin',
        errorsFor: (path: string) => (path === 'links.2.url' ? ['Invalid URL'] : []),
      },
    })
    expect(wrapper.get('#app-link-2-url').attributes('aria-invalid')).toBe('true')
    await wrapper
      .get('#app-link-2-name')
      .trigger('paste', { clipboardData: { getData: () => 'Two\nlines' } })
    expect(wrapper.emitted('invalidPaste')?.[0]).toEqual(['links.2.name'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
