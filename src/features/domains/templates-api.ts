// The domain template data layer (UI 002 research D6, data-model §3).
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  type BulkResult,
  type DomainTemplateBulkActionRequest,
  queryKeys,
  requireData,
  type DomainTemplate,
  type DomainTemplateCreateRequest,
  type DomainTemplatePatch,
  type ListMeta,
  type TemplateListParams,
} from '@/api'

import { runMutation } from './api'

export interface TemplatePage {
  data: DomainTemplate[]
  meta: ListMeta
}

export async function fetchTemplates(params: TemplateListParams): Promise<TemplatePage> {
  return requireData(await api.GET('/domain-templates', { params: { query: params } }))
}

export function templateListOptions(params: TemplateListParams) {
  return queryOptions({
    queryKey: queryKeys.domainTemplates.list(params),
    queryFn: () => fetchTemplates(params),
    staleTime: 30_000,
  })
}

/** Every template, by name, for the create form's template choice. */
export function allTemplatesOptions(maxPageSize: number) {
  return templateListOptions({ sort: 'name', order: 'asc', limit: maxPageSize, offset: 0 })
}

export function cachedTemplate(
  client: QueryClient,
  id: number,
): { template: DomainTemplate; updatedAt: number } | undefined {
  for (const [key, page] of client.getQueriesData<TemplatePage>({
    queryKey: queryKeys.domainTemplates.lists(),
  })) {
    const template = page?.data.find((item) => item.id === id)
    if (template) return { template, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export async function fetchTemplate(id: number): Promise<DomainTemplate> {
  return requireData(
    await api.GET('/domain-templates/{templateId}', { params: { path: { templateId: id } } }),
  ).data
}

export function templateOptions(client: QueryClient, id: number) {
  return queryOptions({
    queryKey: queryKeys.domainTemplates.detail(id),
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

function afterChange(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.domainTemplates.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

function forgetOnNotFound(client: QueryClient, id: number, error: unknown) {
  if (isApiProblem(error) && error.status === 404) {
    client.removeQueries({ queryKey: queryKeys.domainTemplates.detail(id) })
    void client.invalidateQueries({ queryKey: queryKeys.domainTemplates.lists() })
  }
}

export type TemplateCreateBody = DomainTemplateCreateRequest

export function createTemplate(
  client: QueryClient,
  body: TemplateCreateBody,
): Promise<DomainTemplate> {
  return runMutation<DomainTemplate, TemplateCreateBody>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/domain-templates', { body: request })).data,
      onSuccess: async (template) => {
        client.setQueryData(queryKeys.domainTemplates.detail(template.id), template)
        await afterChange(client)
      },
    },
    body,
  )
}

export function updateTemplate(
  client: QueryClient,
  id: number,
  patch: DomainTemplatePatch,
  ifMatch: string,
): Promise<DomainTemplate> {
  return runMutation<DomainTemplate, DomainTemplatePatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/domain-templates/{templateId}', {
            params: { path: { templateId: id }, header: { 'If-Match': ifMatch } },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: async (template) => {
        client.setQueryData(queryKeys.domainTemplates.detail(template.id), template)
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
        await api.DELETE('/domain-templates/{templateId}', {
          params: { path: { templateId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.domainTemplates.detail(id) })
        await afterChange(client)
      },
      onError: (error) => forgetOnNotFound(client, id, error),
    },
    undefined,
  )
}

/** Deletes several templates with the API's bulk operation (gap G40), each with its version tag. */
export function applyTemplateBulkAction(
  client: QueryClient,
  request: DomainTemplateBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, DomainTemplateBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/domain-templates/bulk-actions', { body })).data,
      onSuccess: async (result) => {
        for (const item of result.results) {
          if (item.outcome === 'done' || item.outcome === 'notFound') {
            client.removeQueries({ queryKey: queryKeys.domainTemplates.detail(Number(item.id)) })
          }
        }
        await afterChange(client)
      },
    },
    request,
  )
}
