// The quarantine settings (UI 006 US7, data-model §3, FR-059 to FR-064). Administrators read every
// member; others read the public subset (whether the quarantine is active, the retention and the
// maximum size) that the quarantine list's status notice shows. One key serves both (the read lives
// in `api.ts`), because a caller only ever reads its own visibility. A save sends the changed
// members as a merge patch with `If-Match` and writes the response to the cache.
import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  ApiProblem,
  api,
  queryKeys,
  requireData,
  runMutation,
  type QuarantineSettings,
  type QuarantineSettingsPatch,
} from '@/api'

import { fetchQuarantineSettings, quarantineSettingsOptions } from './api'

export { fetchQuarantineSettings, quarantineSettingsOptions }

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

/** The settings as the caller may read them; `enabled` false keeps the query idle. */
export function useQuarantineSettings(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery(computed(() => ({ ...quarantineSettingsOptions(), enabled: toValue(enabled) })))
}

export function updateQuarantineSettings(
  client: QueryClient,
  patch: QuarantineSettingsPatch,
  ifMatch: string,
): Promise<QuarantineSettings> {
  return runMutation<QuarantineSettings, QuarantineSettingsPatch>(
    client,
    {
      mutationFn: async (body) => {
        const data = requireData(
          await api.PATCH('/quarantine/settings', {
            params: { header: { 'If-Match': ifMatch } },
            body,
            headers: MERGE_PATCH,
          }),
        ).data
        // Only `validateOnly`, which the app never sends, answers without the settings.
        if (!('etag' in data)) throw ApiProblem.fromParts({ kind: 'problem', status: 500 })
        return data
      },
      onSuccess: async (saved) => {
        client.setQueryData(queryKeys.quarantine.settings(), saved)
        await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    patch,
  )
}
