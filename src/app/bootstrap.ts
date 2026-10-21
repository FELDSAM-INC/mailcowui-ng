// The start sequence (research R11), run before the router resolves its first navigation:
//   1. GET /csrf-token alone: it starts the anonymous session and sets the cookie;
//   2. then GET /session and GET /public-config in parallel;
//   3. GET /me as soon as the session is active/restricted, alongside any pending public config.
// A network error or any 5xx (including nginx's HTML 502 while the API is down) shows the
// "service unavailable" page with a retry. A failed public configuration alone uses the FR-003
// defaults. Language and theme are applied from the device, the server and the profile (R15, R16).
// mailcow's language files are requested at the start, next to the API calls: en-gb and the
// language remembered on the device, so that applying the language rarely waits for them.
import type { QueryClient } from '@tanstack/vue-query'
import { readonly, ref } from 'vue'

import { isApiProblem, refreshCsrfToken } from '@/api'
import { prefetchLegacy } from '@/i18n'
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales'

import { installBrandColors } from './branding/brand-colors'
import { brandingFrom, publicConfigQuery } from './branding/public-config'
import { rememberedLocale } from './preferences/locale'
import { usePreferencesStore } from './preferences/store'
import { identityQuery, isSignedIn, sessionQuery } from './session/queries'

export type BootstrapStatus = 'pending' | 'ready' | 'unavailable'

export interface BootstrapContext {
  queryClient: QueryClient
}

const status = ref<BootstrapStatus>('pending')
export const bootstrapStatus = readonly(status)

let context: BootstrapContext | null = null
let resolveReady: () => void = () => {}
let ready = new Promise<void>((resolve) => {
  resolveReady = resolve
})

/** Resolves once a bootstrap has succeeded (the router guard waits for it). */
export function whenBootstrapped(): Promise<void> {
  return ready
}

/** Whether an error means the API is not reachable or not ready. */
function notReady(error: unknown): boolean {
  if (!isApiProblem(error)) return true
  return error.kind !== 'problem' || (error.status ?? 500) >= 500
}

async function applyPreferences(ctx: BootstrapContext, signedIn: boolean): Promise<void> {
  const preferences = usePreferencesStore()
  const branding = brandingFrom(ctx.queryClient.getQueryData(publicConfigQuery().queryKey))
  // Without the public configuration: mailcow's default language menu, a lazy chunk (FR-003).
  const languages =
    branding.languages ?? (await import('@/i18n/default-languages')).DEFAULT_LANGUAGES
  preferences.setServerLanguages([...languages], branding.defaultLanguage)
  await preferences.initialise()
  const profile = signedIn
    ? ctx.queryClient.getQueryData(identityQuery().queryKey)?.preferences
    : undefined
  if (profile) await preferences.applyProfile(profile)
}

export async function runBootstrap(ctx: BootstrapContext): Promise<BootstrapStatus> {
  context = ctx
  installBrandColors(ctx.queryClient)
  if (status.value === 'ready') {
    ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
  }
  status.value = 'pending'
  const remembered = rememberedLocale()
  prefetchLegacy(isAppLocale(remembered) ? remembered : DEFAULT_LOCALE)
  try {
    await refreshCsrfToken()
    const [session] = await Promise.all([
      ctx.queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 }).then(async (session) => {
        if (isSignedIn(session)) {
          try {
            await ctx.queryClient.fetchQuery(identityQuery())
          } catch (error) {
            // A refused identity is left to the guard/session reactions; only an unreachable
            // API stops startup. Public configuration need not delay this authenticated read.
            if (notReady(error)) throw error
          }
        }
        return session
      }),
      ctx.queryClient.fetchQuery(publicConfigQuery()).catch(() => undefined),
    ])
    const signedIn = isSignedIn(session)
    await applyPreferences(ctx, signedIn)
    status.value = 'ready'
    resolveReady()
  } catch (error) {
    status.value = 'unavailable'
  }
  return status.value
}

/** Runs the bootstrap again with the last context (the retry of ServiceUnavailablePage). */
export function retryBootstrap(): Promise<BootstrapStatus> {
  if (!context) return Promise.resolve(status.value)
  return runBootstrap(context)
}
