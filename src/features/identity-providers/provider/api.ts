// The identity provider data layer (UI 012 research R10, R14, R16, data-model §3). Reads go through
// the query cache: the capabilities (5 minutes), the configuration (30 seconds; "not configured" is
// `null`, not an error) and the mailbox template names (UI 003's "all templates" key). Every write
// that can carry a secret, and the connection test, are direct client calls that never pass a
// TanStack Query cache (docs/conventions.md, "Secrets in requests or responses"): only the
// secret-free response is written to the cache. Session-level problems still reach the session
// reactions.
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  isApiProblem,
  queryKeys,
  reportSessionProblem,
  requireData,
  type IdentityProviderCapabilities,
  type IdentityProviderConnectionTestResult,
} from '@/api'

import { allTemplatesOptions } from '@/features/mailboxes'

import type { ProviderInput, ProviderPatch } from './form-model'
import type { IdentityProviderConfig } from './types'

export type { IdentityProviderConfig } from './types'

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

export function capabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.identityProvider.capabilities(),
    queryFn: async (): Promise<IdentityProviderCapabilities> =>
      requireData(await api.GET('/capabilities/identity-provider')).data,
    staleTime: 5 * 60_000,
  })
}

export function configurationOptions() {
  return queryOptions({
    queryKey: queryKeys.identityProvider.configuration(),
    queryFn: async (): Promise<IdentityProviderConfig | null> => {
      try {
        return requireData(await api.GET('/identity-provider')).data
      } catch (error) {
        if (isApiProblem(error) && error.is('identity-provider-not-configured')) return null
        throw error
      }
    },
    staleTime: 30_000,
  })
}

/** The page size of `listMailboxTemplates` that reads every template at once (`Limit` maximum). */
export const ALL_TEMPLATES = 1000

/** UI 003's "all templates" query, for the mapping's template choices (FR-029). */
export const templatesQuery = () => allTemplatesOptions(ALL_TEMPLATES)

/** The template names of that query's page, in its order (Default first, then by name). */
export const templateNames = (page: { data: readonly { name: string }[] }): string[] =>
  page.data.map((template) => template.name)

async function direct<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (isApiProblem(error)) reportSessionProblem(error)
    throw error
  }
}

async function afterWrite(
  client: QueryClient,
  config: IdentityProviderConfig | null,
): Promise<void> {
  client.setQueryData(queryKeys.identityProvider.configuration(), config)
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.identityProvider.capabilities() }),
    client.invalidateQueries({ queryKey: queryKeys.publicConfig() }),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

/**
 * The whole save (`PUT`): a first setup is create-only (`If-None-Match: *`), a replacement carries
 * the version tag read. Resolves with the stored configuration and whether it was created.
 */
export async function saveIdentityProvider(
  client: QueryClient,
  input: ProviderInput,
  precondition: { ifMatch: string } | { create: true },
): Promise<{ config: IdentityProviderConfig; created: boolean }> {
  return direct(async () => {
    const header =
      'ifMatch' in precondition ? { 'If-Match': precondition.ifMatch } : { 'If-None-Match': '*' }
    const result = await api.PUT('/identity-provider', { params: { header }, body: input })
    const config = requireData(result).data
    await afterWrite(client, config)
    return { config, created: result.response.status === 201 }
  })
}

/** A change of the stored type (`PATCH`, merge patch) with the version tag read. */
export async function updateIdentityProvider(
  client: QueryClient,
  patch: ProviderPatch,
  ifMatch: string,
): Promise<IdentityProviderConfig> {
  return direct(async () => {
    const config = requireData(
      await api.PATCH('/identity-provider', {
        params: { header: { 'If-Match': ifMatch } },
        body: patch,
        headers: MERGE_PATCH,
      }),
    ).data
    await afterWrite(client, config)
    return config
  })
}

/** The removal, with the version tag read. */
export async function deleteIdentityProvider(client: QueryClient, ifMatch: string): Promise<void> {
  return direct(async () => {
    await api.DELETE('/identity-provider', { params: { header: { 'If-Match': ifMatch } } })
    await afterWrite(client, null)
  })
}

/** "Not configured" after a change or removal: the configuration was removed elsewhere. */
export async function forgetConfiguration(client: QueryClient): Promise<void> {
  await afterWrite(client, null)
}

/** A connection test of candidate settings; the result stays with the caller only. */
export async function testIdentityProviderConnection(
  candidate: ProviderInput,
  signal?: AbortSignal,
): Promise<IdentityProviderConnectionTestResult> {
  return direct(
    async () =>
      requireData(
        await api.POST('/identity-provider/connection-tests', { body: candidate, signal }),
      ).data,
  )
}
