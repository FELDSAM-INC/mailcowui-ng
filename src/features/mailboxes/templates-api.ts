// Mailbox template queries (research R14, data-model §3): the list, all templates for the create
// form (one request at the API's largest page, sorted by name, the Default template first), and one
// template seeded from a cached list. US7 adds the mutations below.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { api, queryKeys, requireData, type ListMeta, type MailboxTemplateListParams } from '@/api'

import type { MailboxTemplate } from './types'

export interface TemplatePage {
  data: MailboxTemplate[]
  meta: ListMeta
}

export async function fetchTemplates(params: MailboxTemplateListParams): Promise<TemplatePage> {
  return requireData(await api.GET('/mailbox-templates', { params: { query: params } }))
}

export function templateListOptions(params: MailboxTemplateListParams) {
  return queryOptions({
    queryKey: queryKeys.mailboxTemplates.list(params),
    queryFn: () => fetchTemplates(params),
    staleTime: 30_000,
  })
}

const defaultFirst = (templates: MailboxTemplate[]) => [
  ...templates.filter((item) => item.isDefault),
  ...templates.filter((item) => !item.isDefault),
]

/** Every template for the create form's choice, the Default template first. */
export function allTemplatesOptions(maxPageSize: number) {
  return queryOptions({
    queryKey: queryKeys.mailboxTemplates.everything(),
    queryFn: async (): Promise<TemplatePage> => {
      const page = await fetchTemplates({
        sort: 'name',
        order: 'asc',
        limit: maxPageSize,
        offset: 0,
      })
      return { ...page, data: defaultFirst(page.data) }
    },
    staleTime: 30_000,
  })
}

export function cachedTemplate(
  client: QueryClient,
  id: number,
): { template: MailboxTemplate; updatedAt: number } | undefined {
  for (const [key, page] of client.getQueriesData<TemplatePage>({
    queryKey: queryKeys.mailboxTemplates.lists(),
  })) {
    const template = page?.data.find((item) => item.id === id)
    if (template) return { template, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export async function fetchTemplate(id: number): Promise<MailboxTemplate> {
  return requireData(
    await api.GET('/mailbox-templates/{mailboxTemplateId}', {
      params: { path: { mailboxTemplateId: id } },
    }),
  ).data
}

export function templateOptions(client: QueryClient, id: number) {
  return queryOptions({
    queryKey: queryKeys.mailboxTemplates.detail(id),
    queryFn: () => fetchTemplate(id),
    staleTime: 30_000,
    initialData: () => cachedTemplate(client, id)?.template,
    initialDataUpdatedAt: () => cachedTemplate(client, id)?.updatedAt,
  })
}

export function useTemplate(id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(computed(() => templateOptions(client, toValue(id))))
}
