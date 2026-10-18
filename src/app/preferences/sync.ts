// Saving language and theme to the profile (FR-059–FR-061, data-model §3 and §4, research R20).
// A choice applies at once and, when the session may save that field, is sent as a JSON Merge
// Patch with the version tag that was read. After a 412 the reloaded server value applies and the
// user is told that the preferences changed elsewhere (a single immediate choice: no kept input).
// Any other failure restores the previous setting with a message. In a restricted session, or for
// a language when no server language is translated, the change stays on this device.
import { ref } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  type Identity,
  type Preferences,
  type PreferencesPatch,
  type Theme,
  type Writable,
} from '@/api'
import { i18n } from '@/i18n'
import type { AppLocale } from '@/i18n/locales'
import { announce } from '@/shared/composables/useAnnouncer'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'

import { sessionContext } from '../session/context'
import { cachedIdentity, identityQuery } from '../session/queries'
import { usePreferencesStore } from './store'

export async function savePreferences(
  patch: Writable<PreferencesPatch>,
  ifMatch: string,
): Promise<Preferences> {
  const result = await api.PATCH('/me/preferences', {
    params: { header: { 'If-Match': ifMatch } },
    headers: { 'Content-Type': 'application/merge-patch+json' },
    body: patch,
  })
  return requireData(result).data
}

function writeIdentityPreferences(preferences: Preferences): void {
  const { queryClient } = sessionContext()
  queryClient.setQueryData<Identity>(queryKeys.identity(), (identity) =>
    identity ? { ...identity, preferences } : identity,
  )
}

/**
 * After a sign-in: the profile applies, except a language or theme chosen on the sign-in screen
 * during this visit, which is kept and saved (FR-061).
 */
export async function applyProfileAfterSignIn(identity: Identity): Promise<void> {
  const prefs = usePreferencesStore()
  const profile = identity.preferences
  if (!profile) return
  const fields = await prefs.applyProfile(profile)
  prefs.resetChosenOnSignIn()
  const patch: Writable<PreferencesPatch> = {}
  if (fields.saveLocale) patch.language = prefs.locale
  if (fields.saveTheme) patch.theme = prefs.theme
  if (Object.keys(patch).length === 0) return
  try {
    writeIdentityPreferences(await savePreferences(patch, profile.etag))
  } catch {
    // The choice still applies on this device; the next explicit change saves again.
  }
}

/** Language and theme choices of the user menu, the sign-in screens and the pending actions. */
export function usePreferenceChoice() {
  const prefs = usePreferencesStore()
  const saving = ref(false)

  async function save(patch: Writable<PreferencesPatch>, restore: () => Promise<void> | void) {
    const ctx = sessionContext()
    const saver = useVersionedSave<Preferences>({
      current: () => cachedIdentity(ctx.queryClient)?.preferences,
      refetch: async () =>
        (await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })).preferences,
    })
    saving.value = true
    prefs.saveMessage = null
    try {
      const result = await saver.save(patch, savePreferences)
      if (result.status === 'saved') {
        writeIdentityPreferences(result.result)
        announce(i18n.global.t('preferences.saved'))
      } else if (result.status === 'outdated') {
        const latest = result.latest
        if (latest) {
          await prefs.setLocale(latest.language as AppLocale)
          prefs.setTheme(latest.theme)
        }
        prefs.saveMessage = 'changedElsewhere'
        announce(i18n.global.t('preferences.changedElsewhere'), { assertive: true })
      } else {
        await restore()
        prefs.saveMessage = 'notSaved'
        announce(i18n.global.t('preferences.notSaved'), { assertive: true })
      }
    } finally {
      saving.value = false
    }
  }

  async function chooseLocale(locale: AppLocale): Promise<void> {
    const previous = prefs.locale
    await prefs.setLocale(locale, { chosen: true })
    if (prefs.locale === previous || !prefs.canSave.locale) return
    await save({ language: prefs.locale }, () => prefs.setLocale(previous))
  }

  async function chooseTheme(theme: Theme): Promise<void> {
    const previous = prefs.theme
    prefs.setTheme(theme, { chosen: true })
    if (theme === previous || !prefs.canSave.theme) return
    await save({ theme }, () => prefs.setTheme(previous))
  }

  return { chooseLocale, chooseTheme, saving }
}
