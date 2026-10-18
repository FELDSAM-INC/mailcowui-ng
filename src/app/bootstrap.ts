// The start sequence (research R11), run before the router resolves its first navigation:
//   1. GET /csrf-token alone: it starts the anonymous session and sets the cookie;
//   2. then GET /session and GET /public-config in parallel;
//   3. then GET /me for an active or restricted session.
// A network error or any 5xx (including nginx's HTML 502 while the API is down) shows the
// "service unavailable" page with a retry. A failed public configuration alone uses the FR-003
// defaults. Language and theme are applied from the device, the server and the profile (R15, R16).
import type { QueryClient } from '@tanstack/vue-query'
import { readonly, ref } from 'vue'

import { isApiProblem, refreshCsrfToken } from '@/api'

import { brandingFrom, publicConfigQuery } from './branding/public-config'
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
  preferences.setServerLanguages(branding.languages, branding.defaultLanguage)
  await preferences.initialise()
  const profile = signedIn
    ? ctx.queryClient.getQueryData(identityQuery().queryKey)?.preferences
    : undefined
  if (profile) await preferences.applyProfile(profile)
}

export async function runBootstrap(ctx: BootstrapContext): Promise<BootstrapStatus> {
  context = ctx
  if (status.value === 'ready') {
    ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
  }
  status.value = 'pending'
  try {
    await refreshCsrfToken()
    const [session] = await Promise.all([
      ctx.queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 }),
      ctx.queryClient.fetchQuery(publicConfigQuery()).catch(() => undefined),
    ])
    const signedIn = isSignedIn(session)
    if (signedIn) {
      try {
        await ctx.queryClient.fetchQuery(identityQuery())
      } catch (error) {
        // A refused identity (for example an account deactivated meanwhile) is left to the guard
        // and the session reactions; only an unreachable API stops the start.
        if (notReady(error)) throw error
      }
    }
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
