// Bulk actions on OAuth2 clients (FR-065, docs/conventions.md "Bulk actions"): targets with each
// entry's version tag as listed, one result row per client labelled with its client ID, and the
// new secrets of a `renewSecret` action (gap G42), which exist only in component state.
import type { Oauth2Client, Oauth2ClientBulkResult } from '@/api'
import {
  rowsFromBulkResult,
  unknownRows as unknownBulkRows,
  type BulkRow,
} from '@/shared/components/bulk-row'

type Entry = Pick<Oauth2Client, 'id' | 'clientId' | 'etag'>

/** `version` is the entry's `etag` exactly as read; the API also accepts it without quotes. */
export function toBulkTargets(entries: readonly Entry[]): { id: string; version: string }[] {
  return entries.map((entry) => ({ id: String(entry.id), version: entry.etag }))
}

const labelOf = (entries: readonly Pick<Entry, 'id' | 'clientId'>[], id: string) =>
  entries.find((entry) => String(entry.id) === id)?.clientId ?? id

/** The shared bulk rows' entries: the identifier, labelled with the client ID. */
const asEntries = (entries: readonly Pick<Entry, 'id' | 'clientId'>[]) =>
  entries.map((entry) => ({ name: String(entry.id), unicodeName: entry.clientId }))

export function rowsFromOauth2BulkResult(
  result: Oauth2ClientBulkResult,
  entries: readonly Pick<Entry, 'id' | 'clientId'>[],
): BulkRow[] {
  return rowsFromBulkResult(result, asEntries(entries))
}

/** A lost connection: the outcome of every client is unknown. */
export function unknownRows(entries: readonly Pick<Entry, 'id' | 'clientId'>[]): BulkRow[] {
  return unknownBulkRows(asEntries(entries))
}

export interface NewSecret {
  id: string
  clientId: string
  secret: string
}

/** The new secrets of the done items of a `renewSecret` action, in request order. */
export function newSecretsOf(
  result: Oauth2ClientBulkResult,
  entries: readonly Pick<Entry, 'id' | 'clientId'>[],
): NewSecret[] {
  return result.results.flatMap((item) =>
    item.outcome === 'done' && item.clientSecret
      ? [{ id: item.id, clientId: labelOf(entries, item.id), secret: item.clientSecret }]
      : [],
  )
}
