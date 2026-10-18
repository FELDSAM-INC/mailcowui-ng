// App links (FR-001a, data-model §2 AppLinkView, research R17).
import { describe, expect, it } from 'vitest'

import type { AppLink } from '@/api'
import { appsLabel, loginPageLinks, signedInLinks } from '@/app/branding/app-links'
import { loadLegacy, lt } from '@/i18n'

const link = (overrides: Partial<AppLink>): AppLink => ({
  name: 'Webmail',
  url: '/SOGo/so',
  signedInUrl: '/SOGo/so',
  description: null,
  showOnLoginPage: true,
  source: 'builtIn',
  ...overrides,
})

const links: AppLink[] = [
  link({ name: 'Webmail', description: 'Open the webmail' }),
  link({
    name: 'Helpdesk',
    url: 'https://help.example.org/',
    signedInUrl: 'https://help.example.org/?user=%u',
    source: 'operator',
  }),
  link({
    name: 'Hidden',
    url: 'https://hidden.example.org/',
    signedInUrl: 'https://hidden.example.org/',
    showOnLoginPage: false,
    source: 'operator',
  }),
  link({
    name: 'Evil',
    url: 'javascript:alert(1)',
    signedInUrl: 'javascript:alert(%u)',
    source: 'operator',
  }),
  link({ name: 'Wiki', url: '/wiki', signedInUrl: '/wiki/%u/%u', source: 'operator' }),
]

describe('login page links', () => {
  it('keep the configured order, skip hidden links and drop unsafe addresses', () => {
    expect(loginPageLinks(links)).toEqual([
      { name: 'Webmail', href: '/SOGo/so', description: 'Open the webmail' },
      { name: 'Helpdesk', href: 'https://help.example.org/', description: null },
      { name: 'Wiki', href: '/wiki', description: null },
    ])
  })

  it('are empty without links', () => {
    expect(loginPageLinks([])).toEqual([])
    expect(loginPageLinks([link({ showOnLoginPage: false })])).toEqual([])
  })
})

describe('signed-in links', () => {
  it('use the signed-in address with %u replaced by the encoded username, every link shown', () => {
    expect(signedInLinks(links, 'alice+x@example.org')).toEqual([
      { name: 'Webmail', href: '/SOGo/so', description: 'Open the webmail' },
      {
        name: 'Helpdesk',
        href: 'https://help.example.org/?user=alice%2Bx%40example.org',
        description: null,
      },
      { name: 'Hidden', href: 'https://hidden.example.org/', description: null },
      {
        name: 'Wiki',
        href: '/wiki/alice%2Bx%40example.org/alice%2Bx%40example.org',
        description: null,
      },
    ])
  })

  it('cannot be turned into another scheme by the username', () => {
    const [only] = signedInLinks([link({ signedInUrl: '%u' })], 'javascript:alert(1)')
    expect(only).toBeUndefined()
  })
})

describe('apps label', () => {
  it("is the operator label as plain text, or the classic interface's default", async () => {
    expect(appsLabel('<b>Tools</b>')).toBe('<b>Tools</b>')
    expect(appsLabel(null)).toBe('Apps')
    expect(appsLabel('')).toBe('Apps')
    await loadLegacy('cs-cz')
    expect(appsLabel(null)).toBe('Aplikace')
    expect(lt('header.apps')).toBe('Aplikace')
  })
})
