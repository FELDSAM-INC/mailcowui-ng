// A feature's own strings, loaded with its routes (UI 002 T104, docs/conventions.md "New
// strings"): merged key by key into the app's strings, in en-gb and the language in use, and loaded
// again for a language chosen later.
import { describe, expect, it } from 'vitest'

import { createAppI18n, loadFeatureMessages, loadLocale } from '@/i18n'

describe('loadFeatureMessages', () => {
  it('adds the domain strings to en-gb and keeps the shared ones of the same group', async () => {
    const i18n = createAppI18n()
    expect(i18n.global.te('domains.list.actionsFor', 'en-gb')).toBe(false)
    expect(i18n.global.te('domains.tags.remove', 'en-gb')).toBe(true)
    await loadFeatureMessages('domains', i18n, 'en-gb')
    expect(i18n.global.t('domains.list.actionsFor', { name: 'a.example' })).toBe(
      'Actions for a.example',
    )
    expect(i18n.global.te('domains.tags.remove', 'en-gb')).toBe(true)
    expect(i18n.global.te('domainTemplates.default', 'en-gb')).toBe(true)
  })

  it('loads them for a language chosen later, with the app strings of that language', async () => {
    const i18n = createAppI18n()
    await loadFeatureMessages('domains', i18n, 'en-gb')
    await loadLocale(i18n, 'cs-cz')
    expect(i18n.global.te('domains.list.actionsFor', 'cs-cz')).toBe(true)
    expect(i18n.global.te('domains.tags.remove', 'cs-cz')).toBe(true)
    expect(i18n.global.te('home.title', 'cs-cz') || i18n.global.te('nav.home', 'cs-cz')).toBe(true)
  })

  it('loads the language in use together with en-gb', async () => {
    const i18n = createAppI18n()
    await loadLocale(i18n, 'sk-sk')
    await loadFeatureMessages('domains', i18n, 'sk-sk')
    expect(i18n.global.te('domains.list.actionsFor', 'sk-sk')).toBe(true)
    expect(i18n.global.te('domains.list.actionsFor', 'en-gb')).toBe(true)
  })
})
