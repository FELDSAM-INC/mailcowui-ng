// The application shell (FR-042, FR-045, FR-046, FR-048, FR-049, FR-080, research R16, R19, R21).
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { type Router } from 'vue-router'

import { queryKeys, type Identity, type PublicConfig, type Session } from '@/api'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import ShellLayout from '@/app/layouts/ShellLayout.vue'
import { installFocusManagement } from '@/app/router/focus'
import { installTitle } from '@/app/router/title'
import { i18n } from '@/i18n'

import { publicConfig } from '../../../mocks/scenarios/public-config'
import { installMatchMedia } from '../../support/media'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

const LG = '(min-width: 1024px)'

function identity(role: Identity['role'], username: string): Identity {
  return {
    username,
    role,
    authentication: { method: 'password' },
    scope:
      role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['example.org'] },
    permissions: Object.fromEntries(
      ['spamAlias', 'syncjobs', 'bccMaps', 'spamScore', 'spamPolicy'].map((flag) => [
        flag,
        role === 'admin',
      ]),
    ) as unknown as Identity['permissions'],
    pendingActions: [],
    preferences: { language: 'en-gb', theme: 'system', etag: '"1"' },
  }
}

const session = (username: string, role: Identity['role']): Session => ({
  state: 'active',
  username,
  role,
  authMethod: 'password',
  signedInAt: '2026-10-18T10:00:00Z',
  pendingActions: [],
  idleTimeout: 10800,
})

async function mountShell(
  options: {
    path?: string
    role?: Identity['role']
    username?: string
    config?: Partial<PublicConfig>
    wide?: boolean
    layout?: 'shell' | 'auth'
  } = {},
): Promise<{ wrapper: VueWrapper; router: Router }> {
  installMatchMedia({ [LG]: options.wide ?? false })
  const { queryClient } = testPlugins()
  const role = options.role ?? 'admin'
  const username = options.username ?? 'admin'
  queryClient.setQueryData(queryKeys.publicConfig(), {
    ...publicConfig('default'),
    ...options.config,
  })
  queryClient.setQueryData(queryKeys.identity(), identity(role, username))
  queryClient.setQueryData(queryKeys.session(), session(username, role))
  const router = createTestRouter()
  await router.push(options.path ?? '/domains')
  await router.isReady()
  const Layout = options.layout === 'auth' ? AuthLayout : ShellLayout
  const wrapper = mountWithApp(Layout, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  document.title = ''
})

describe('skip link', () => {
  it('leads to the main content', async () => {
    const { wrapper } = await mountShell()
    const skip = wrapper.get('a[href="#main"]')
    expect(skip.text()).toBe('Skip to main content')
    const main = wrapper.get('main#main')
    expect(main.attributes('tabindex')).toBe('-1')
    await skip.trigger('click')
    expect(document.activeElement).toBe(main.element)
    wrapper.unmount()
  })
})

describe('navigation (FR-043, FR-046)', () => {
  it('is a static list from the lg breakpoint, with the catalogue entries', async () => {
    const { wrapper } = await mountShell({ wide: true })
    const nav = wrapper.get('nav[aria-label="Main navigation"]')
    const labels = nav.findAll('a').map((link) => link.text())
    expect(labels).toContain('Domains')
    expect(labels).toContain('API keys')
    expect(labels).not.toContain('Spam filter')
    expect(nav.get('a[aria-current="page"]').text()).toBe('Domains')
    expect(wrapper.find('button[aria-label="Toggle navigation"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens as a drawer from one header button below lg, closes with Escape and returns focus', async () => {
    const { wrapper } = await mountShell({ wide: false })
    expect(wrapper.find('nav[aria-label="Main navigation"]').exists()).toBe(false)
    const button = wrapper.get('button[aria-label="Toggle navigation"]')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.querySelector('nav[aria-label="Main navigation"]')).not.toBeNull()
    expect(dialog.contains(document.activeElement)).toBe(true)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(button.element))
    wrapper.unmount()
  })

  it('closes the drawer after a choice', async () => {
    const { wrapper, router } = await mountShell({ wide: false })
    await wrapper.get('button[aria-label="Toggle navigation"]').trigger('click')
    await flushPromises()
    const link = [...document.querySelectorAll('[role="dialog"] a')].find(
      (a) => a.textContent?.trim() === 'Mailboxes',
    ) as HTMLAnchorElement
    link.click()
    await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/mailboxes'))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    wrapper.unmount()
  })
})

describe('no access (FR-045)', () => {
  it('renders NoAccessState in place, without mounting the route component', async () => {
    const { wrapper, router } = await mountShell({
      path: '/api-keys/new',
      role: 'domainAdmin',
      username: 'reseller',
    })
    expect(router.currentRoute.value.fullPath).toBe('/api-keys/new')
    expect(wrapper.find('h1').text()).toBe('No access')
    expect(wrapper.findComponent({ name: 'RouteStub' }).exists()).toBe(false)
    expect(wrapper.get('main a[href="/ng/"]').text()).toBe('Go to the home screen')
    wrapper.unmount()
  })
})

describe('footer', () => {
  it('renders the operator footer sanitised', async () => {
    const { wrapper } = await mountShell({
      config: {
        footerHtml:
          '<p>Operated by <b>Us</b></p><script>alert(1)</script><img src=x onerror=alert(1)>',
      },
    })
    const footer = wrapper.get('footer')
    expect(footer.text()).toContain('Operated by Us')
    expect(footer.find('script').exists()).toBe(false)
    expect(footer.find('img').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('announcement (FR-048)', () => {
  const text = 'Maintenance on Sunday.'

  it.each(['shell', 'auth'] as const)(
    'is shown in the %s layout with its type in text',
    async (layout) => {
      const { wrapper } = await mountShell({
        layout,
        config: { announcement: { text, type: 'danger', active: true } },
      })
      const banner = wrapper.get('[data-announcement]')
      expect(banner.text()).toContain(text)
      // The classic announcement type name (`admin.ui_header_announcement_type_danger`).
      expect(banner.get('.sr-only').text()).toBe('Very important:')
      expect(banner.get('svg').attributes('aria-hidden')).toBe('true')
      wrapper.unmount()
    },
  )

  it('is hidden when inactive or without text', async () => {
    const inactive = await mountShell({
      config: { announcement: { text, type: 'info', active: false } },
    })
    expect(inactive.wrapper.find('[data-announcement]').exists()).toBe(false)
    inactive.wrapper.unmount()
    const empty = await mountShell({
      config: { announcement: { text: null, type: 'info', active: true } },
    })
    expect(empty.wrapper.find('[data-announcement]').exists()).toBe(false)
    empty.wrapper.unmount()
  })

  it('collapses for the visit, keyed by a hash of its text', async () => {
    const first = await mountShell({
      config: { announcement: { text, type: 'warning', active: true } },
    })
    await first.wrapper.get('button[aria-label="Hide announcement"]').trigger('click')
    await vi.waitFor(() =>
      expect(sessionStorage.getItem('mailcowui-ng.announcement-collapsed')).toMatch(
        /^[0-9a-f]{64}$/,
      ),
    )
    expect(first.wrapper.find('[data-announcement]').text()).not.toContain(text)
    first.wrapper.unmount()

    const again = await mountShell({
      config: { announcement: { text, type: 'warning', active: true } },
    })
    await vi.waitFor(() =>
      expect(again.wrapper.get('[data-announcement] button').text()).toBe(
        'Important – Show announcement',
      ),
    )
    again.wrapper.unmount()

    const changed = await mountShell({
      config: { announcement: { text: 'A new message.', type: 'warning', active: true } },
    })
    await flushPromises()
    expect(changed.wrapper.get('[data-announcement]').text()).toContain('A new message.')
    changed.wrapper.unmount()
  })
})

describe('user menu (FR-042)', () => {
  it('shows the username, the role, Passkeys and Sign out', async () => {
    const { wrapper } = await mountShell({ role: 'domainAdmin', username: 'reseller' })
    const trigger = wrapper.get('button[aria-label="Account menu of reseller"]')
    expect(trigger.text()).toContain('reseller')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    expect(menu).not.toBeNull()
    expect(menu.textContent).toContain('reseller')
    expect(menu.textContent).toContain('Domain administrator')
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map((item) =>
      item.textContent?.trim(),
    )
    expect(items).toEqual(['Passkeys', 'Sign out'])
    wrapper.unmount()
  })
})

describe('page title and focus (FR-049, FR-080)', () => {
  it('names the page followed by the configured page title, and focuses the heading', async () => {
    const { wrapper, router } = await mountShell({ wide: true })
    installTitle(router, {
      t: (key, named) => (named ? i18n.global.t(key, named) : i18n.global.t(key)),
      pageTitle: () => 'Example Mail',
      dependencies: [],
    })
    installFocusManagement(router)
    await router.push('/mailboxes')
    await flushPromises()
    expect(document.title).toBe('Mailboxes – Example Mail')
    await router.push('/aliases')
    await flushPromises()
    await nextTick()
    expect(document.title).toBe('Aliases – Example Mail')
    await vi.waitFor(() => expect(document.activeElement?.tagName).toBe('H1'))
    wrapper.unmount()
  })
})
