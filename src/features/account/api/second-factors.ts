// The own second factors (UI 005 data-model §3, research R9 to R11, R13). The list and the removal
// of one entry are TanStack operations; the TOTP start, the enrolments and the removal of all
// entries carry codes, keys or the current password, so callers run them through
// `useSecretRequest`. After every change the list and the capabilities are invalidated; in a
// restricted session the pending-actions screen reads the session and the identity again.
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type ApiProblem,
  type OwnSecondFactor,
  type OwnSecondFactorEnrolmentRequest,
  type OwnSecondFactorWebAuthnOptions,
  type OwnTotpEnrolment,
  type Writable,
} from '@/api'
import { computeSkew } from '@/shared/composables/useCountdown'

/** Legacy lists every entry; accounts have only a few. */
export const SECOND_FACTOR_LIST = { limit: 100, offset: 0, sort: 'id' } as const

export async function fetchOwnSecondFactors(): Promise<OwnSecondFactor[]> {
  return requireData(await api.GET('/me/second-factors', { params: { query: SECOND_FACTOR_LIST } }))
    .data
}

export function ownSecondFactorsOptions() {
  return queryOptions({
    queryKey: queryKeys.me.secondFactorList(SECOND_FACTOR_LIST),
    queryFn: fetchOwnSecondFactors,
    staleTime: 30_000,
  })
}

export function useOwnSecondFactors(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({ ...ownSecondFactorsOptions(), enabled: computed(() => toValue(enabled)) })
}

export function afterSecondFactorChange(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.me.secondFactors() })
  void client.invalidateQueries({ queryKey: queryKeys.capabilities.selfService() })
}

/** Removes one entry (no secret involved), through the mutation cache. */
export function deleteOwnSecondFactor(client: QueryClient, id: number): Promise<void> {
  return runMutation<void, number>(
    client,
    {
      // A refusal throws through the client's problem middleware; 204 has no body.
      mutationFn: async (secondFactorId) => {
        await api.DELETE('/me/second-factors/{secondFactorId}', {
          params: { path: { secondFactorId } },
        })
      },
      onSettled: () => afterSecondFactorChange(client),
    },
    id,
  )
}

/** A TOTP enrolment with the server clock skew of its answer. Use through `useSecretRequest`. */
export async function startTotpEnrolment(): Promise<{ enrolment: OwnTotpEnrolment; skew: number }> {
  const result = await api.POST('/me/second-factors/totp-enrolment')
  const date = result.response.headers.get('date')
  return {
    enrolment: requireData(result).data,
    skew: computeSkew(date ? new Date(date) : null),
  }
}

export async function createSecondFactorWebAuthnOptions(): Promise<OwnSecondFactorWebAuthnOptions> {
  return requireData(await api.POST('/me/second-factors/webauthn-registration-options')).data
}

/** Enrols a factor. Use through `useSecretRequest`: it carries codes, keys or passwords. */
export async function enrolSecondFactor(
  body: Writable<OwnSecondFactorEnrolmentRequest>,
): Promise<OwnSecondFactor> {
  return requireData(await api.POST('/me/second-factors', { body })).data
}

/** Removes every entry. Use through `useSecretRequest`: it carries the current password. */
export async function removeAllSecondFactors(currentPassword: string): Promise<void> {
  await api.POST('/me/second-factors/removal', { body: { currentPassword } })
}

export type { ApiProblem }
