import type { Identity } from './generated/schema'
import { identityKey } from './identity'

// The anti-forgery token (research R8). It lives in memory only and is never stored on the device
// (constitution V). Fetches are single-flight: concurrent writers share one request.
let token: string | null = null
let inflight: Promise<string> | null = null
let fetcher: (() => Promise<string>) | null = null

/** Wires the function that performs GET /csrf-token (set by the client module). */
export function setCsrfFetcher(fetch: () => Promise<string>): void {
  fetcher = fetch
}

export function currentCsrfToken(): string | null {
  return token
}

export function clearCsrfToken(): void {
  token = null
}

/** Fetches a new token, sharing one request between concurrent callers. */
export function refreshCsrfToken(): Promise<string> {
  if (inflight) return inflight
  if (!fetcher) return Promise.reject(new Error('CSRF fetcher not configured'))
  inflight = fetcher()
    .then((value) => {
      token = value
      return value
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** The current token, fetched first when there is none yet. */
export function ensureCsrfToken(): Promise<string> {
  return token ? Promise.resolve(token) : refreshCsrfToken()
}

/** Adopts a token returned by an identity-switch response; never persisted. */
export function setCsrfToken(value: string): void {
  token = value
}

export interface IdentityChangeHandler {
  current(): Identity | null | undefined
  changed(change: { identity: Identity; refusedWrite: true }): void | Promise<void>
}
let identityChangeHandler: IdentityChangeHandler | null = null
/** Session supplies its cache through inversion; the API does not import application state. */
export function setIdentityChangeHandler(handler: IdentityChangeHandler | null): void {
  identityChangeHandler = handler
}
export function requestIdentityKey(): string | null {
  return identityKey(identityChangeHandler?.current())
}
export async function refuseChangedIdentity(
  owner: string | null,
  identity: Identity,
): Promise<boolean> {
  if (owner !== null && owner === identityKey(identity)) return false
  await identityChangeHandler?.changed({ identity, refusedWrite: true })
  return true
}
