// Client state of the language and theme preferences (data-model §4, research R10, R15, R16).
// Server data (enabled languages, session state) is passed in; saving to the profile arrives with
// US6 (sync.ts).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Language, Preferences, SessionState, Theme } from '@/api'
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/locales'

import {
  applyLocale,
  canSavePreferences,
  rememberedLocale,
  resolveAvailableLocales,
  resolvePreSignInLocale,
  resolveSignedInLocale,
  showLanguageChoice as hasChoice,
} from './locale'
import { applyTheme, rememberedTheme } from './theme'

export const usePreferencesStore = defineStore('preferences', () => {
  const locale = ref<AppLocale>(DEFAULT_LOCALE)
  const theme = ref<Theme>('system')
  const chosenOnSignIn = ref({ locale: false, theme: false })
  /** `null` until the public configuration is known, or when it could not be loaded. */
  const serverLanguages = ref<Language[] | null>(null)
  const serverDefault = ref<string | null>(null)
  const sessionState = ref<SessionState | null>(null)

  const availableLocales = computed(() => resolveAvailableLocales(serverLanguages.value))
  const showLanguageChoice = computed(() => hasChoice(availableLocales.value))
  const canSave = computed(() => canSavePreferences(sessionState.value, availableLocales.value))

  const signedIn = () => sessionState.value === 'active' || sessionState.value === 'restricted'

  function setServerLanguages(languages: Language[] | null, defaultLanguage: string | null = null) {
    serverLanguages.value = languages
    serverDefault.value = defaultLanguage
  }

  function setSessionState(state: SessionState | null) {
    sessionState.value = state
  }

  /** Applies a language. Languages the server does not offer are ignored (FR-060). */
  async function setLocale(next: AppLocale, options: { chosen?: boolean } = {}) {
    const allowed = availableLocales.value
    const target = allowed.length === 0 ? DEFAULT_LOCALE : allowed.includes(next) ? next : null
    if (!target) return
    await applyLocale(target)
    locale.value = target
    if (options.chosen && !signedIn()) chosenOnSignIn.value.locale = true
  }

  function setTheme(next: Theme, options: { chosen?: boolean } = {}) {
    applyTheme(next)
    theme.value = next
    if (options.chosen && !signedIn()) chosenOnSignIn.value.theme = true
  }

  /** Before sign-in: the language and theme last applied on this device, or the fallbacks. */
  async function initialise(browserLanguages: readonly string[] = navigator.languages ?? []) {
    await setLocale(
      resolvePreSignInLocale({
        remembered: rememberedLocale(),
        browserLanguages,
        serverDefault: serverDefault.value,
        available: availableLocales.value,
      }),
    )
    setTheme(rememberedTheme() ?? 'system')
  }

  /**
   * After sign-in: the profile preferences apply, except a choice made on the sign-in screen during
   * this visit, which is kept. The result says which fields should be saved to the profile.
   */
  async function applyProfile(
    profile: Preferences,
    browserLanguages: readonly string[] = navigator.languages ?? [],
  ): Promise<{ saveLocale: boolean; saveTheme: boolean }> {
    const resolved = resolveSignedInLocale({
      remembered: rememberedLocale(),
      browserLanguages,
      serverDefault: serverDefault.value,
      available: availableLocales.value,
      profile: profile.language,
      chosenOnSignIn: chosenOnSignIn.value.locale ? locale.value : null,
      current: locale.value,
    })
    await setLocale(resolved.locale)
    const keepTheme = chosenOnSignIn.value.theme
    if (!keepTheme) setTheme(profile.theme)
    return {
      saveLocale: resolved.saveToProfile && canSave.value.locale,
      saveTheme: keepTheme && theme.value !== profile.theme && canSave.value.theme,
    }
  }

  return {
    locale,
    theme,
    chosenOnSignIn,
    serverLanguages,
    sessionState,
    availableLocales,
    showLanguageChoice,
    canSave,
    setServerLanguages,
    setSessionState,
    setLocale,
    setTheme,
    initialise,
    applyProfile,
  }
})
