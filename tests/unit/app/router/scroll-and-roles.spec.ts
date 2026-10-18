// Scroll restoration on return (UI 002 T020, research D9, FR-013) and the route roles check
// (research D4).
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { queryKeys, type Identity, type Session } from '@/api'
import ShellLayout from '@/app/layouts/ShellLayout.vue'
import { focusPageHeading, noteScrollRestored } from '@/app/router/focus'
import { appScrollBehavior } from '@/app/router'

import { publicConfig } from '../../../mocks/scenarios/public-config'
import { installMatchMedia } from '../../support/media'
import { mountWithApp, testPlugins } from '../../support/mount'

const route = (path: string, query: Record<string, string> = {}, hash = '') =>
  ({ path, query, hash, fullPath: path }) as unknown as RouteLocationNormalized

describe('scroll behaviour', () => {
  it('returns the saved position on history navigation and the top otherwise', () => {
    expect(
      appScrollBehavior(route('/domains'), route('/domains/a.example'), { left: 0, top: 640 }),
    ).toEqual({
      left: 0,
      top: 640,
    })
    expect(appScrollBehavior(route('/domains/a.example'), route('/domains'), null)).toEqual({
      top: 0,
    })
  })

  it('keeps the position for query-only changes on the same page, except a new page number', () => {
    expect(appScrollBehavior(route('/domains', { q: 'cust' }), route('/domains'), null)).toBe(false)
    expect(appScrollBehavior(route('/domains', { page: '2' }), route('/domains'), null)).toEqual({
      top: 0,
    })
  })

  it('focuses the heading without scrolling when a saved position was restored', () => {
    document.body.innerHTML = '<main><h1>Domains</h1></main>'
    const heading = document.querySelector('h1')!
    const focus = vi.spyOn(heading, 'focus')
    noteScrollRestored(true)
    focusPageHeading()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    noteScrollRestored(false)
    focusPageHeading()
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: false })
  })
})

describe('route roles (meta.roles)', () => {
  it('renders NoAccessState without mounting the route component when the role is not listed', async () => {
    installMatchMedia({ '(min-width: 1024px)': true })
    const { queryClient } = testPlugins()
    const identity: Identity = {
      username: 'reseller',
      role: 'domainAdmin',
      authentication: { method: 'password' },
      scope: { type: 'domains', domains: ['example.org'] },
      permissions: {} as Identity['permissions'],
      pendingActions: [],
      preferences: { language: 'en-gb', theme: 'system', etag: '"1"' },
    }
    const session: Session = {
      state: 'active',
      username: 'reseller',
      role: 'domainAdmin',
      authMethod: 'password',
      signedInAt: '2026-10-18T10:00:00Z',
      pendingActions: [],
      idleTimeout: 10800,
    }
    queryClient.setQueryData(queryKeys.publicConfig(), publicConfig('default'))
    queryClient.setQueryData(queryKeys.identity(), identity)
    queryClient.setQueryData(queryKeys.session(), session)
    const Create = defineComponent({ name: 'CreateStub', setup: () => () => h('h1', 'Create') })
    const router = createRouter({
      history: createMemoryHistory('/ng/'),
      routes: [
        { path: '/', component: { render: () => null } },
        {
          path: '/domains/-/new',
          component: Create,
          meta: { layout: 'shell', access: 'session', navEntry: 'domains', roles: ['admin'] },
        },
      ],
    })
    await router.push('/domains/-/new')
    const wrapper = mountWithApp(ShellLayout, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.get('main h1').text()).toBe('No access')
    expect(wrapper.findComponent({ name: 'CreateStub' }).exists()).toBe(false)
    wrapper.unmount()
  })
})
