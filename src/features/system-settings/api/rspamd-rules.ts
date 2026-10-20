import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type RspamdRuleListParams,
  type RspamdSettingsRule,
  type RspamdSettingsRuleCreateRequest,
  type RspamdSettingsRulePatch,
  type SettingsValidationResult,
} from '@/api'
export async function fetchRules(params: RspamdRuleListParams) {
  return requireData(await api.GET('/settings/rspamd-rules', { params: { query: params } }))
}
export async function fetchRule(id: number) {
  return requireData(
    await api.GET('/settings/rspamd-rules/{ruleId}', { params: { path: { ruleId: id } } }),
  ).data
}
export async function fetchEffectiveMap() {
  return requireData(await api.GET('/settings/rspamd-settings-map')).data
}
export function rulesOptions(params: RspamdRuleListParams, client?: QueryClient) {
  return queryOptions({
    queryKey: queryKeys.rspamdRules.list(params),
    queryFn: async () => {
      const result = await fetchRules(params)
      for (const item of result.data)
        client?.setQueryData(queryKeys.rspamdRules.detail(item.id), item)
      return result
    },
    staleTime: 30_000,
  })
}
export function useRules(params: MaybeRefOrGetter<RspamdRuleListParams>, client: QueryClient) {
  return useQuery(computed(() => rulesOptions(toValue(params), client)))
}
export function ruleOptions(id: number) {
  return queryOptions({
    queryKey: queryKeys.rspamdRules.detail(id),
    queryFn: () => fetchRule(id),
    enabled: Number.isSafeInteger(id) && id > 0,
    staleTime: 30_000,
  })
}
export function effectiveMapOptions() {
  return queryOptions({
    queryKey: queryKeys.rspamdSettingsMap(),
    queryFn: fetchEffectiveMap,
    staleTime: 30_000,
  })
}
function changed(client: QueryClient, item?: RspamdSettingsRule) {
  if (item) client.setQueryData(queryKeys.rspamdRules.detail(item.id), item)
  void client.invalidateQueries({ queryKey: queryKeys.rspamdRules.lists() })
  void client.invalidateQueries({ queryKey: queryKeys.rspamdSettingsMap() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
export async function validateNewRule(
  body: RspamdSettingsRuleCreateRequest,
): Promise<SettingsValidationResult> {
  const result = requireData(
    await api.POST('/settings/rspamd-rules', { params: { query: { validateOnly: true } }, body }),
  ).data
  if (!('valid' in result)) throw new Error('Expected rule validation result')
  return result
}
export async function validateRule(
  item: RspamdSettingsRule,
  body: RspamdSettingsRulePatch,
): Promise<SettingsValidationResult> {
  const result = requireData(
    await api.PATCH('/settings/rspamd-rules/{ruleId}', {
      params: {
        path: { ruleId: item.id },
        header: { 'If-Match': item.etag },
        query: { validateOnly: true },
      },
      body,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  ).data
  if (!('valid' in result)) throw new Error('Expected rule validation result')
  return result
}
export function createRule(client: QueryClient, body: RspamdSettingsRuleCreateRequest) {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        const result = requireData(await api.POST('/settings/rspamd-rules', { body })).data
        if (!('id' in result)) throw new Error('Expected stored rule')
        return result
      },
      onSuccess: (item) => changed(client, item),
    },
    undefined,
  )
}
export function updateRule(
  client: QueryClient,
  item: RspamdSettingsRule,
  body: RspamdSettingsRulePatch,
) {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        const result = requireData(
          await api.PATCH('/settings/rspamd-rules/{ruleId}', {
            params: { path: { ruleId: item.id }, header: { 'If-Match': item.etag } },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data
        if (!('id' in result)) throw new Error('Expected stored rule')
        return result
      },
      onSuccess: (updated) => changed(client, updated),
    },
    undefined,
  )
}
export function deleteRule(client: QueryClient, item: RspamdSettingsRule): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/settings/rspamd-rules/{ruleId}', {
          params: { path: { ruleId: item.id }, header: { 'If-Match': item.etag } },
        })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.rspamdRules.detail(item.id) })
        changed(client)
      },
    },
    undefined,
  )
}
