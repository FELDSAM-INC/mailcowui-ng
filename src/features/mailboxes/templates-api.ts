// Mailbox template queries (research R14, data-model §3): the list, all templates for the create
// form (one request at the API's largest page, sorted by name, the Default template first), and one
// template seeded from a cached list. The mutations (US7) refresh the template lists, the create
// form's choice included, and the audit log.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type ListMeta,
  type MailboxTemplateBulkActionRequest,
  type MailboxTemplateCreateRequest,
  type MailboxTemplateListParams,
  type MailboxTemplatePatch,
  type Writable,
} from '@/api'

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

export type TemplateCreateBody = Writable<MailboxTemplateCreateRequest>
export type TemplatePatch = Writable<MailboxTemplatePatch>

function afterChange(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.mailboxTemplates.all() }),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

function forgetOnNotFound(client: QueryClient, id: number, error: unknown) {
  if (isApiProblem(error) && error.status === 404) {
    client.removeQueries({ queryKey: queryKeys.mailboxTemplates.detail(id) })
    void client.invalidateQueries({ queryKey: queryKeys.mailboxTemplates.lists() })
  }
}

export function createTemplate(
  client: QueryClient,
  body: TemplateCreateBody,
): Promise<MailboxTemplate> {
  return runMutation<MailboxTemplate, TemplateCreateBody>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/mailbox-templates', { body: request })).data,
      onSuccess: async (template) => {
        client.setQueryData(queryKeys.mailboxTemplates.detail(template.id), template)
        await afterChange(client)
      },
    },
    body,
  )
}

export function updateTemplate(
  client: QueryClient,
  id: number,
  patch: TemplatePatch,
  ifMatch: string,
): Promise<MailboxTemplate> {
  return runMutation<MailboxTemplate, TemplatePatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/mailbox-templates/{mailboxTemplateId}', {
            params: { path: { mailboxTemplateId: id }, header: { 'If-Match': ifMatch } },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: async (template) => {
        client.setQueryData(queryKeys.mailboxTemplates.detail(template.id), template)
        await afterChange(client)
      },
      onError: (error) => forgetOnNotFound(client, id, error),
    },
    patch,
  )
}

export function deleteTemplate(client: QueryClient, id: number, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailbox-templates/{mailboxTemplateId}', {
          params: { path: { mailboxTemplateId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.mailboxTemplates.detail(id) })
        await afterChange(client)
      },
      onError: (error) => forgetOnNotFound(client, id, error),
    },
    undefined,
  )
}

/** Deletes several templates with the API's bulk operation (gap G39), each with its version tag. */
export function deleteTemplates(
  client: QueryClient,
  request: MailboxTemplateBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, MailboxTemplateBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/mailbox-templates/bulk-actions', { body })).data,
      onSuccess: async (result) => {
        for (const item of result.results) {
          if (item.outcome === 'done' || item.outcome === 'notFound') {
            client.removeQueries({ queryKey: queryKeys.mailboxTemplates.detail(Number(item.id)) })
          }
        }
        await afterChange(client)
      },
    },
    request,
  )
}
