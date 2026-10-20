import { describe, expect, it } from 'vitest'
import {
  buildSettingsIndex,
  normalizeSettingsSearch,
  searchSettings,
} from '@/features/system-settings/search'
import { settingsPages, type SettingsPage } from '@/features/system-settings/catalogue'
import { legacy, type TextRef } from '@/i18n'
import { settingsCapabilities } from '../../../mocks/factories/settings'

const resolve = (ref: TextRef) => (typeof ref === 'string' ? ref : ref.legacy)
const options = {
  locale: 'en-gb',
  capabilities: settingsCapabilities(),
  resolve,
  english: resolve,
  hasRoute: () => true,
}
function page(id: string, extra: Partial<SettingsPage> = {}): SettingsPage {
  return {
    id,
    routeName: id,
    group: 'integrations',
    title: id,
    description: 'description',
    auditTarget: 'ipCheck',
    visible: () => true,
    ...extra,
  }
}

describe('settings catalogue search (T042)', () => {
  it('normalizes Czech/Slovak accents, case and whitespace', () => {
    expect(normalizeSettingsSearch('  ÚPRAVA\n  příliš ŽLUŤOUČKÝ ', 'cs-cz')).toBe(
      'uprava prilis zlutoucky',
    )
    expect(normalizeSettingsSearch('ĽÚBIŤ mäkké dĺžne', 'sk-sk')).toBe('lubit makke dlzne')
  })
  it('requires every token and combines page and field labels', () => {
    const index = buildSettingsIndex(
      [
        page('Password settings', {
          sections: [{ id: 'reset', title: 'Recovery', fields: ['Sender address', 'Subject'] }],
        }),
      ],
      options,
    )
    expect(searchSettings(index, 'password sender', 'en-gb')).toMatchObject([
      { section: { id: 'reset' } },
    ])
    expect(searchSettings(index, 'password missing', 'en-gb')).toEqual([])
    expect(searchSettings(index, '   ', 'en-gb')).toEqual([])
  })
  it('ranks title prefix, title substring, section, field, description and legacy name in order', () => {
    const pages = [
      page('legacy', { legacyNames: ['mail'] }),
      page('description', { description: 'mail details' }),
      page('field', { fields: ['mail address'] }),
      page('section', { sections: [{ id: 'delivery', title: 'mail delivery' }] }),
      page('substring', { title: 'Domain mail' }),
      page('prefix', { title: 'Mailbox' }),
    ]
    expect(
      searchSettings(buildSettingsIndex(pages, options), 'mail', 'en-gb').map(
        (item) => item.page.id,
      ),
    ).toEqual(['prefix', 'substring', 'section', 'field', 'description', 'legacy'])
  })
  it('groups duplicate field matches by page and keeps catalogue order for ties', () => {
    const pages = [
      page('a', {
        sections: [
          { id: 'first', title: 'One', fields: ['Sender'] },
          { id: 'second', title: 'Two', fields: ['Sender'] },
        ],
      }),
      page('b', { fields: ['Sender'] }),
    ]
    expect(searchSettings(buildSettingsIndex(pages, options), 'sender', 'en-gb')).toMatchObject([
      { page: { id: 'a' }, section: { id: 'first' } },
      { page: { id: 'b' } },
    ])
  })
  it('finds English legacy names in Czech and rebuilds displayed/indexed text for a new locale', () => {
    const pages = [page('branding', { title: 'title', legacyNames: [legacy('admin.customize')] })]
    const czech = buildSettingsIndex(pages, {
      ...options,
      locale: 'cs-cz',
      resolve: (ref) => (typeof ref === 'string' ? 'Úprava vzhledu' : 'Přizpůsobit'),
      english: (ref) => (typeof ref === 'string' ? 'Appearance' : 'Customize'),
    })
    expect(searchSettings(czech, 'uprava', 'cs-cz')[0]?.title).toBe('Úprava vzhledu')
    expect(searchSettings(czech, 'Customize', 'cs-cz')[0]?.title).toBe('Úprava vzhledu')
    const slovak = buildSettingsIndex(pages, {
      ...options,
      locale: 'sk-sk',
      resolve: () => 'Zmena vzhľadu',
    })
    expect(searchSettings(slovak, 'zmena', 'sk-sk')[0]?.title).toBe('Zmena vzhľadu')
    expect(searchSettings(slovak, 'uprava', 'sk-sk')).toEqual([])
  })
  it('excludes capability-hidden License and unregistered destinations', () => {
    const index = buildSettingsIndex(settingsPages, {
      ...options,
      capabilities: settingsCapabilities({ licenseVerificationEnabled: false }),
      hasRoute: (name) => name !== 'system-settings-cors',
    })
    expect(index.some((entry) => entry.page.id === 'license')).toBe(false)
    expect(index.some((entry) => entry.page.id === 'cors')).toBe(false)
  })
  it('searches the full static catalogue within 5 ms after index construction', () => {
    const index = buildSettingsIndex(settingsPages, options)
    const samples = Array.from({ length: 50 }, () => {
      const start = performance.now()
      searchSettings(index, 'password', 'en-gb')
      return performance.now() - start
    }).sort((a, b) => a - b)
    expect(samples[25]).toBeLessThan(5)
  })
})
