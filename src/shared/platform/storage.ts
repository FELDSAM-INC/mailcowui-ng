// The only device storage of the app (constitution V, data-model §4, FR-091). It holds
// conveniences only, never credentials, tokens, secrets, usernames or API data. Every access sits
// in try/catch: with storage disabled or full the app keeps working and simply forgets them.

export const ALLOWED_LOCAL_KEYS = [
  'mailcowui-ng.locale',
  'mailcowui-ng.theme',
  'mailcowui-ng.passkey-suggestion-dismissed',
] as const

export const ALLOWED_SESSION_KEYS = ['mailcowui-ng.announcement-collapsed'] as const

export type LocalStorageKey = (typeof ALLOWED_LOCAL_KEYS)[number]
export type SessionStorageKey = (typeof ALLOWED_SESSION_KEYS)[number]

export interface KeyValueStore<K extends string> {
  get(key: K): string | null
  set(key: K, value: string): boolean
  remove(key: K): void
}

function createStore<K extends string>(
  storage: () => Storage,
  allowed: readonly K[],
): KeyValueStore<K> {
  // The runtime check backs up the types: a cast or a typo can never write another key.
  const isAllowed = (key: string): key is K => (allowed as readonly string[]).includes(key)
  return {
    get(key) {
      if (!isAllowed(key)) return null
      try {
        return storage().getItem(key)
      } catch {
        return null
      }
    },
    set(key, value) {
      if (!isAllowed(key)) return false
      try {
        storage().setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    remove(key) {
      if (!isAllowed(key)) return
      try {
        storage().removeItem(key)
      } catch {
        // Storage disabled: nothing to remove.
      }
    },
  }
}

export const localStore = createStore<LocalStorageKey>(
  () => window.localStorage,
  ALLOWED_LOCAL_KEYS,
)

export const sessionStore = createStore<SessionStorageKey>(
  () => window.sessionStorage,
  ALLOWED_SESSION_KEYS,
)
