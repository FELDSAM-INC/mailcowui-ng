import { queryOptions } from '@tanstack/vue-query'
import {
  api,
  queryKeys,
  requireData,
  type QuotaNotificationSettingsPatch,
  type QuotaNotificationRecipientsPatch,
} from '@/api'
export function quotaNotificationOptions() {
  return queryOptions({
    queryKey: queryKeys.systemSettings.quotaNotification(),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/settings/quota-notification', { signal })).data,
  })
}
export async function updateQuotaNotification(
  body: QuotaNotificationSettingsPatch,
  ifMatch: string,
) {
  return requireData(
    await api.PATCH('/settings/quota-notification', {
      body,
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
    }),
  ).data
}
export function quotaCopiesOptions(domain: string) {
  return queryOptions({
    queryKey: queryKeys.quotaNotificationRecipients(domain),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/domains/{domain}/quota-notification-recipients', {
          params: { path: { domain } },
          signal,
        }),
      ).data,
  })
}
export async function updateQuotaCopies(
  domain: string,
  body: QuotaNotificationRecipientsPatch,
  ifMatch: string,
) {
  return requireData(
    await api.PATCH('/domains/{domain}/quota-notification-recipients', {
      params: { path: { domain } },
      body,
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
    }),
  ).data
}
