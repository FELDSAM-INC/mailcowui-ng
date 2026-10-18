// The return from the provider (UI 012 research R6, FR-046 to FR-049). The captured code and state
// are submitted once, directly to the client, and never kept beyond this page. A provider error is
// reported with its code and state only, or the pending sign-in is cancelled when it cannot be
// reported; the message does not depend on that request. A code or a state alone, or an over-long
// value, cancels the pending sign-in and says that it expired. Without parameters the page opens
// the app for a session and the sign-in screen otherwise. After a completed sign-in the kept
// address opens, or the home screen. "Try again" starts a new single sign-on; it never resends the
// old code.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'

import { ApiProblem, isApiProblem, queryKeys } from '@/api'
import { isSignedIn, sessionQuery } from '@/app/session/queries'

import {
  acceptSingleSignOnSession,
  cancelSingleSignOn,
  completeSingleSignOn,
  reportSingleSignOnProviderError,
} from '../api'
import { takeCapturedSingleSignOnReturn } from '../sso/capture'
import { classifyReturn } from '../sso/return-classify'
import { takeKeptReturnTo } from '../sso/return-to'
import { useSingleSignOnStart } from './useSingleSignOnStart'

export type SingleSignOnOutcome =
  { kind: 'cancelled' } | { kind: 'problem'; problem: ApiProblem; canRetry: boolean }

const asProblem = (error: unknown) =>
  isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'network', cause: error })

/** The "expired or already completed" outcome for a return the app refuses itself. */
const stateInvalid = () =>
  ApiProblem.fromParts({
    kind: 'problem',
    status: 401,
    type: '/api/v2/problems/sign-in-state-invalid',
  })

export function useSingleSignOnReturn(options: { navigate?: (url: string) => void } = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const outcome = shallowRef<SingleSignOnOutcome | null>(null)
  const working = ref(true)
  // Taken at once: a second mount, or a reload, finds nothing (edge case "reload").
  const captured = takeCapturedSingleSignOnReturn()
  const kept = takeKeptReturnTo(router)
  const retryStart = useSingleSignOnStart({ returnTo: () => kept, navigate: options.navigate })

  function show(next: SingleSignOnOutcome) {
    working.value = false
    outcome.value = next
  }

  async function ignoreFailure(request: () => Promise<void>) {
    try {
      await request()
    } catch {
      // The message does not depend on the outcome of this request (FR-048).
    }
  }

  async function complete(code: string, state: string) {
    try {
      const session = await completeSingleSignOn({ code, state })
      await acceptSingleSignOnSession(session, kept ?? { name: 'home' })
    } catch (error) {
      const problem = asProblem(error)
      const notAvailable = problem.is('single-sign-on-not-available')
      if (notAvailable) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.publicConfig() })
      }
      show({ kind: 'problem', problem, canRetry: !notAvailable })
    }
  }

  async function withoutParameters() {
    try {
      const session = await queryClient.fetchQuery(sessionQuery())
      await router.replace(isSignedIn(session) ? { name: 'home' } : { name: 'sign-in' })
    } catch {
      await router.replace({ name: 'sign-in' })
    }
  }

  async function run() {
    const classified = classifyReturn(captured)
    switch (classified.kind) {
      case 'complete':
        return complete(classified.code, classified.state)
      case 'providerError':
        await ignoreFailure(() =>
          reportSingleSignOnProviderError({ error: classified.error, state: classified.state }),
        )
        return show({ kind: 'cancelled' })
      case 'providerErrorUnreportable':
        await ignoreFailure(cancelSingleSignOn)
        return show({ kind: 'cancelled' })
      case 'malformed':
        await ignoreFailure(cancelSingleSignOn)
        return show({ kind: 'problem', problem: stateInvalid(), canRetry: true })
      case 'empty':
        return withoutParameters()
    }
  }

  onMounted(() => void run())

  return {
    working,
    outcome,
    /** A new single sign-on with the kept address (FR-048). */
    retry: () => retryStart.start(),
    retrying: retryStart.pending,
    retryProblem: retryStart.problem,
    /** "Back to sign-in" keeps the requested page. */
    backTo: computed<RouteLocationRaw>(() =>
      kept ? { name: 'sign-in', query: { returnTo: kept } } : { name: 'sign-in' },
    ),
  }
}
