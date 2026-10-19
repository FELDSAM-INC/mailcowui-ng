// Requests that carry a DKIM private key (research R11, R12, FR-076, FR-077): direct client calls,
// never a TanStack query or mutation, whose `variables` and `data` the caches would keep. Callers
// run them through `useSecretRequest`, so the key lives only in component state. After an import
// only the non-secret change result is written to the entry's detail; an export is never cached.
import type { QueryClient } from '@tanstack/vue-query'

import {
  api,
  isApiProblem,
  queryKeys,
  requireData,
  type DkimKeyChangeResult,
  type DkimPrivateKey,
} from '@/api'

import { afterKeyChange } from './dkim'

export interface ImportBody {
  privateKey: string
  selector: string
  overwrite: boolean
}

/** Imports a private key for a name; overwriting a key needs its version tag. */
export async function importKey(
  client: QueryClient,
  name: string,
  body: ImportBody,
  ifMatch?: string | null,
): Promise<DkimKeyChangeResult> {
  try {
    const result = requireData(
      await api.POST('/dkim-keys/{dkimName}/import', {
        params: { path: { dkimName: name }, header: ifMatch ? { 'If-Match': ifMatch } : {} },
        body,
      }),
    ).data
    afterKeyChange(client, result)
    return result
  } catch (error) {
    if (isApiProblem(error) && (error.status === 409 || error.status === 412)) {
      void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.detail(name) })
    }
    throw error
  }
}

/** Reads a key's private key (administrators, while the operator allows it). */
export async function exportKey(name: string): Promise<DkimPrivateKey> {
  return requireData(
    await api.GET('/dkim-keys/{dkimName}/private-key', { params: { path: { dkimName: name } } }),
  ).data
}
