// The quarantine notification settings of a mailbox, singly and in bulk (UI 006 US3, data-model §3,
// FR-039 to FR-041, FR-086). The values also live on UI 003's mailbox (`quarantineNotification`,
// `quarantineCategory`), so every change refreshes the mailbox detail and list keys as well, and
// the audit log.
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type QuarantineNotificationBulkRequest,
  type QuarantineNotificationSettings,
  type QuarantineNotificationSettingsPatch,
} from '@/api'

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

export async function fetchNotificationSettings(
  mailbox: string,
): Promise<QuarantineNotificationSettings> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/quarantine-notification-settings', {
      params: { path: { mailbox } },
    }),
  ).data
}

export function notificationSettingsOptions(mailbox: string) {
  return queryOptions({
    queryKey: queryKeys.quarantine.notificationSettings(mailbox),
    queryFn: () => fetchNotificationSettings(mailbox),
    staleTime: 30_000,
  })
}

/** The notification settings of a mailbox; `enabled` false keeps the query idle. */
export function useNotificationSettings(
  mailbox: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  return useQuery(
    computed(() => ({
      ...notificationSettingsOptions(toValue(mailbox)),
      enabled: toValue(enabled) && !!toValue(mailbox),
    })),
  )
}

/** The mailbox reads of UI 003 that show the two values, and the audit log. */
function refreshDependants(client: QueryClient, mailbox?: string): Promise<unknown> {
  return Promise.all([
    mailbox
      ? client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(mailbox) })
      : client.invalidateQueries({ queryKey: queryKeys.mailboxes.details() }),
    client.invalidateQueries({ queryKey: queryKeys.mailboxes.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

/** Sends only the changed members with the version tag that was read. */
export function updateNotificationSettings(
  client: QueryClient,
  mailbox: string,
  patch: QuarantineNotificationSettingsPatch,
  ifMatch: string,
): Promise<QuarantineNotificationSettings> {
  return runMutation<QuarantineNotificationSettings, QuarantineNotificationSettingsPatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/mailboxes/{mailbox}/quarantine-notification-settings', {
            params: { path: { mailbox }, header: { 'If-Match': ifMatch } },
            body,
            headers: MERGE_PATCH,
          }),
        ).data,
      onSuccess: async (saved) => {
        client.setQueryData(queryKeys.quarantine.notificationSettings(mailbox), saved)
        await refreshDependants(client, mailbox)
      },
      onError: (error) => {
        if (!isApiProblem(error)) return
        if (error.is('attribute-not-permitted') || error.is('permission-flag-required')) {
          void client.invalidateQueries({ queryKey: queryKeys.identity() })
        }
        if (error.status === 404) {
          client.removeQueries({ queryKey: queryKeys.quarantine.notificationSettings(mailbox) })
        }
      },
    },
    patch,
  )
}

/** The mailbox list's mass action: targets without a version (research R16). */
export function applyNotificationBulk(
  client: QueryClient,
  request: QuarantineNotificationBulkRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, QuarantineNotificationBulkRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/quarantine-notification-settings/bulk-actions', { body }))
          .data,
      onSuccess: () =>
        Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.quarantine.notificationSettingsAll() }),
          refreshDependants(client),
        ]),
    },
    request,
  )
}
