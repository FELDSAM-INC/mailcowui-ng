// Addresses and file names of UI 010 (data-model §5, research R2, R13). Every location is built
// from the API's `name`: the ASCII form, or the exact stored spelling of an unused key. Vue Router
// percent-encodes it, so readable, upper-case and slash-containing names round-trip.
import type { RouteLocationRaw } from 'vue-router'

export function dkimListLocation(query: { domain?: string } = {}): RouteLocationRaw {
  return { name: 'dkim-keys', query: query.domain ? { domain: query.domain } : {} }
}

export function dkimKeyLocation(name: string): RouteLocationRaw {
  return { name: 'dkim-key', params: { dkimName: name } }
}

export function dkimCopyLocation(name: string): RouteLocationRaw {
  return { name: 'dkim-copy', params: { dkimName: name } }
}

/** The import page; `name` pre-fills the name field (an import with overwrite from an entry). */
export function dkimImportLocation(name?: string): RouteLocationRaw {
  return { name: 'dkim-import', query: name ? { name } : {} }
}

export function diagnosticsLocation(name: string): RouteLocationRaw {
  return { name: 'dns-diagnostics', params: { diagnosticsName: name } }
}

/** A file name part: every character outside `[A-Za-z0-9._-]` becomes `_`. */
export function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_')
}

/** The zone file of a name: `<name>.txt`, as the classic download names it. */
export function zoneFileName(name: string): string {
  return `${safeFileName(name)}.txt`
}

/** An exported private key: `<selector>.<name>.pem`. */
export function privateKeyFileName(selector: string, name: string): string {
  return `${safeFileName(selector)}.${safeFileName(name)}.pem`
}
