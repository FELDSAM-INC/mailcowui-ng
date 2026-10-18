// T118: preference sync (FR-059–FR-061, data-model §3 and §4): the profile versus a choice on the
// sign-in screen, saving per field, If-Match, a 412 that applies the reloaded value, restoring the
// previous setting on other failures, device-only changes in a restricted session, and an
// untranslated profile language that is neither applied nor overwritten.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { queryKeys, type Identity, type Session } from '@/api'
import { setSessionContext } from '@/app/session/context'
import { usePreferencesStore } from '@/app/preferences/store'
import { applyProfileAfterSignIn, usePreferenceChoice } from '@/app/preferences/sync'
import { i18n } from '@/i18n'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => setSessionContext(null))

const LANGUAGES = [
  { code: 'en-gb', name: 'English' },
  { code: 'cs-cz', name: 'Čeština' },
  { code: 'sk-sk', name: 'Slovenčina' },
]

function identity(preferences: Identity['preferences']): Identity {
  return {
    username: 'admin',
    role: 'admin',
    authentication: { method: 'password' },
    scope: { type: 'allDomains' },
    permissions: {} as Identity['permissions'],
    pendingActions: [],
    preferences,
  }
}

async function setup(state: Session['state'] = 'active', languages = LANGUAGES) {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  const prefs = usePreferencesStore()
  prefs.setServerLanguages(languages, 'en-gb')
  prefs.setSessionState(state)
  await prefs.setLocale('en-gb')
  prefs.setTheme('system')
  const who = identity({ language: 'en-gb', theme: 'system', etag: '"pref-1"' })
  queryClient.setQueryData(queryKeys.identity(), who)
  return { prefs, queryClient, who }
}

const saves = () => mockState().requests.filter((r) => r.operationId === 'updatePreferences')

describe('applyProfileAfterSignIn', () => {
  it('applies the profile when nothing was chosen on the sign-in screen', async () => {
    useScenario('admin-active')
    const { prefs } = await setup()
    await applyProfileAfterSignIn(identity({ language: 'cs-cz', theme: 'dark', etag: '"pref-1"' }))
    expect(prefs.locale).toBe('cs-cz')
    expect(prefs.theme).toBe('dark')
    expect(saves()).toEqual([])
  })

  it('keeps and saves a choice made on the sign-in screen, field by field', async () => {
    useScenario('admin-active')
    const { prefs } = await setup()
    prefs.setSessionState('anonymous')
    await prefs.setLocale('sk-sk', { chosen: true })
    prefs.setSessionState('active')
    await applyProfileAfterSignIn(identity({ language: 'en-gb', theme: 'dark', etag: '"pref-1"' }))
    expect(prefs.locale).toBe('sk-sk')
    expect(prefs.theme).toBe('dark')
    expect(saves().map((r) => [r.body, r.headers['if-match']])).toEqual([
      [{ language: 'sk-sk' }, '"pref-1"'],
    ])
    expect(prefs.chosenOnSignIn).toEqual({ locale: false, theme: false })
  })

  it('neither applies nor overwrites a profile language that mailcow does not ship', async () => {
    useScenario('admin-active')
    const { prefs } = await setup('active', [...LANGUAGES, { code: 'en-us', name: 'English (US)' }])
    await applyProfileAfterSignIn(identity({ language: 'en-us', theme: 'system', etag: '"p"' }))
    expect(prefs.locale).toBe('en-gb')
    expect(saves()).toEqual([])
  })
})

describe('usePreferenceChoice', () => {
  it('applies at once and saves with If-Match, updating the identity', async () => {
    useScenario('admin-active')
    const { prefs, queryClient } = await setup()
    const { result } = withSetup(() => usePreferenceChoice())
    await result.chooseLocale('cs-cz')
    expect(prefs.locale).toBe('cs-cz')
    expect(i18n.global.locale.value).toBe('cs-cz')
    expect(document.documentElement.lang).toBe('cs-CZ')
    expect(saves().map((r) => [r.body, r.headers['if-match']])).toEqual([
      [{ language: 'cs-cz' }, '"pref-1"'],
    ])
    const cached = queryClient.getQueryData<Identity>(queryKeys.identity())
    expect(cached?.preferences?.language).toBe('cs-cz')
    expect(cached?.preferences?.etag).not.toBe('"pref-1"')
  })

  it('applies the reloaded server value after a 412 and says so', async () => {
    useScenario('admin-active', {
      accounts: { admin: { preferences: { language: 'sk-sk', theme: 'dark', etag: '"else"' } } },
    })
    const { prefs } = await setup()
    const { result } = withSetup(() => usePreferenceChoice())
    await result.chooseLocale('cs-cz')
    await flushPromises()
    expect(prefs.locale).toBe('sk-sk')
    expect(prefs.saveMessage).toBe('changedElsewhere')
  })

  it('restores the previous setting when saving fails', async () => {
    useScenario('preferences-save-fails')
    const { prefs } = await setup()
    const { result } = withSetup(() => usePreferenceChoice())
    await result.chooseTheme('dark')
    expect(prefs.theme).toBe('system')
    expect(prefs.saveMessage).toBe('notSaved')
  })

  it('changes only this device in a restricted session', async () => {
    useScenario('forced-password-change')
    const { prefs } = await setup('restricted')
    const { result } = withSetup(() => usePreferenceChoice())
    await result.chooseLocale('cs-cz')
    await result.chooseTheme('dark')
    expect(prefs.locale).toBe('cs-cz')
    expect(prefs.theme).toBe('dark')
    expect(saves()).toEqual([])
  })

  it('saves the theme but no language when no server language is translated', async () => {
    useScenario('admin-active')
    const { prefs } = await setup('active', [{ code: 'de-de', name: 'Deutsch' }])
    const { result } = withSetup(() => usePreferenceChoice())
    await result.chooseLocale('cs-cz')
    await result.chooseTheme('dark')
    expect(prefs.locale).toBe('en-gb')
    expect(saves().map((r) => r.body)).toEqual([{ theme: 'dark' }])
  })
})
