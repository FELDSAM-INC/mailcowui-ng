// LegacyText shows one of mailcow's own strings by its legacy key (constitution IV 1.3.0): plain
// values as text, values with markup through the legacy sanitiser, arguments always as text, and
// placeholders that a caller fills with its own content (DataTables' `_MENU_`).
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import { loadLegacy, resetLegacy } from '@/i18n/legacy'
import LegacyText from '@/shared/components/LegacyText.vue'

import { server } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

beforeEach(async () => {
  await loadLegacy('en-gb')
})

afterEach(() => {
  resetLegacy()
})

describe('LegacyText', () => {
  it('renders a plain value as text in a span', () => {
    const wrapper = mountWithApp(LegacyText, { props: { k: 'login.forgot_password' } })
    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.text()).toBe('> Forgot Password?')
    expect(wrapper.html()).not.toContain('<b')
  })

  it('renders in the element it is given', () => {
    const wrapper = mountWithApp(LegacyText, { props: { k: 'login.login_admin', as: 'h1' } })
    expect(wrapper.element.tagName).toBe('H1')
    expect(wrapper.text()).toBe('Administrator Login')
  })

  it('renders a value with markup through the sanitiser', () => {
    const wrapper = mountWithApp(LegacyText, { props: { k: 'footer.restart_container_info' } })
    expect(wrapper.find('b').text()).toBe('Important:')
    expect(wrapper.text()).toBe(
      'Important: A graceful restart may take a while to complete, please wait for it to finish.',
    )
  })

  it('keeps links of a value safe', () => {
    const wrapper = mountWithApp(LegacyText, { props: { k: 'admin.api_info' } })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/api')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('fills placeholders, escaping the arguments in a value with markup', async () => {
    server.use(
      http.get('*/lang/lang.en-gb.json', () =>
        HttpResponse.json({ login: { delayed: 'Wait <b>%s</b> seconds.' } }),
      ),
    )
    resetLegacy()
    await loadLegacy('en-gb')
    const wrapper = mountWithApp(LegacyText, {
      props: { k: 'login.delayed', args: ['<img src=x onerror=alert(1)>'] },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('b').text()).toBe('<img src=x onerror=alert(1)>')
  })

  it('renders slot content in place of a named placeholder', () => {
    const wrapper = mountWithApp(LegacyText, {
      props: { k: 'datatables.lengthMenu' },
      slots: { _MENU_: () => h('select', { 'data-menu': '' }) },
    })
    expect(wrapper.text()).toBe('Show  entries')
    expect(wrapper.find('select[data-menu]').exists()).toBe(true)
    expect(wrapper.html()).toMatch(/Show <select data-menu=""><\/select> entries/)
  })

  it('follows a language change', async () => {
    const wrapper = mountWithApp(LegacyText, { props: { k: 'login.password' } })
    expect(wrapper.text()).toBe('Password')
    await loadLegacy('cs-cz')
    await nextTick()
    expect(wrapper.text()).toBe('Heslo')
  })
})
