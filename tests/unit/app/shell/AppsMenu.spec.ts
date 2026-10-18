// T095: the apps menu of the header (FR-001a, FR-042): the operator's order and label, safe
// addresses only, `%u` encoded, and no menu without links.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppsMenu from '@/app/shell/AppsMenu.vue'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const link = (name: string, signedInUrl: string) => ({
  name,
  url: signedInUrl,
  signedInUrl,
  description: null,
  showOnLoginPage: false,
  source: 'operator' as const,
})

async function mountMenu(username = 'alice@example.org') {
  const wrapper = mountWithApp(AppsMenu, { props: { username }, attachTo: document.body })
  await vi.waitFor(() => expect(wrapper.html()).not.toBe('<!--v-if-->'))
  return wrapper
}

async function open(wrapper: Awaited<ReturnType<typeof mountMenu>>) {
  await wrapper.get('button').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return [...document.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')]
}

describe('AppsMenu', () => {
  it('lists the links in order under the operator label, with %u encoded', async () => {
    useScenario('anonymous-default', {
      publicConfig: {
        appsLabel: 'Our services',
        appLinks: [link('Webmail', '/SOGo/so'), link('Helpdesk', 'https://help.example/?u=%u')],
      },
    })
    const wrapper = await mountMenu()
    expect(wrapper.get('button').attributes('aria-label')).toBe('Our services menu')
    const items = await open(wrapper)
    expect(items.map((item) => [item.textContent?.trim(), item.getAttribute('href')])).toEqual([
      ['Webmail', '/SOGo/so'],
      ['Helpdesk', 'https://help.example/?u=alice%40example.org'],
    ])
    expect(items[1]?.getAttribute('rel')).toBe('noopener noreferrer')
    wrapper.unmount()
  })

  it('drops unsafe addresses and uses the default label', async () => {
    useScenario('anonymous-default', {
      publicConfig: {
        appsLabel: null,
        appLinks: [link('Evil', 'javascript:alert(1)'), link('Help', 'https://help.example/')],
      },
    })
    const wrapper = await mountMenu()
    expect(wrapper.get('button').attributes('aria-label')).toBe('Apps menu')
    expect((await open(wrapper)).map((item) => item.textContent?.trim())).toEqual(['Help'])
    wrapper.unmount()
  })

  it('renders nothing without links', async () => {
    useScenario('anonymous-default', { publicConfig: { appLinks: [] } })
    const wrapper = mountWithApp(AppsMenu, { props: { username: 'admin' } })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
