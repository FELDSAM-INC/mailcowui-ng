// The sub-navigation of "Identity providers and OAuth2" (T025, FR-001): the classic System ›
// Configuration tabs `admin.iam` and `admin.oauth2_apps`, only for registered routes, with the
// current one marked.
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import SectionNav from '@/features/identity-providers/components/SectionNav.vue'
import { lt } from '@/i18n'

import { mountWithApp, resetTestPlugins } from '../../support/mount'

const Page = defineComponent({ setup: () => () => h('div') })

function router(names: string[]) {
  const paths: Record<string, string> = {
    'identity-provider': '/identity-providers/provider',
    'oauth2-clients': '/identity-providers/oauth2-apps',
  }
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/', component: Page },
      ...names.map((name) => ({ path: paths[name]!, name, component: Page })),
    ],
  })
}

beforeEach(() => resetTestPlugins())

describe('SectionNav', () => {
  it('links both screens with the classic tab names and marks the current one', async () => {
    const r = router(['identity-provider', 'oauth2-clients'])
    await r.push('/identity-providers/oauth2-apps')
    const wrapper = mountWithApp(SectionNav, { global: { plugins: [r] } })
    await flushPromises()
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.text())).toEqual([lt('admin.iam'), lt('admin.oauth2_apps')])
    expect(links[0]!.attributes('aria-current')).toBeUndefined()
    expect(links[1]!.attributes('aria-current')).toBe('page')
    expect(wrapper.find('nav').attributes('aria-label')).toBeTruthy()
  })

  it('renders only the links whose route is registered', async () => {
    const r = router(['identity-provider'])
    await r.push('/identity-providers/provider')
    const wrapper = mountWithApp(SectionNav, { global: { plugins: [r] } })
    await flushPromises()
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.find('a').attributes('aria-current')).toBe('page')
  })
})
