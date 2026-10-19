// Write-only relay credentials (research R7, data-model §2 CredentialIntent, conventions
// "Secrets"): the password field starts empty; left empty it keeps the stored password, typed it
// replaces it, and "Remove password" removes it. Clearing the username also removes the stored
// password on the server. Creation sends username and password only when filled.

export interface CredentialIntent {
  /** As read (`username`). */
  storedUsername: string | null
  /** As read (`passwordSet`). */
  passwordStored: boolean
  username: string
  /** Memory only; cleared after a save, a refusal and leaving the form. */
  password: string
  removePassword: boolean
}

export function credentialIntent(
  stored: { username: string | null; passwordSet: boolean } | null,
): CredentialIntent {
  return {
    storedUsername: stored?.username ?? null,
    passwordStored: stored?.passwordSet ?? false,
    username: stored?.username ?? '',
    password: '',
    removePassword: false,
  }
}

/** The credential members of a patch, by the rules of `RelayhostPatch` and `TransportPatch`. */
export function credentialPatch(intent: CredentialIntent): {
  username?: string
  password?: string
} {
  const patch: { username?: string; password?: string } = {}
  const username = intent.username.trim()
  if (username !== (intent.storedUsername ?? '')) patch.username = username
  if (intent.password !== '') patch.password = intent.password
  else if (intent.removePassword && intent.passwordStored) patch.password = ''
  return patch
}

/** The credential members of a creation: only what is filled. */
export function credentialCreate(intent: CredentialIntent): {
  username?: string
  password?: string
} {
  const body: { username?: string; password?: string } = {}
  const username = intent.username.trim()
  if (username !== '') body.username = username
  if (intent.password !== '') body.password = intent.password
  return body
}

/** Clearing the username while a password is stored (and none typed) removes it on save. */
export function willRemoveWithUsername(intent: CredentialIntent): boolean {
  return (
    intent.passwordStored &&
    !intent.removePassword &&
    intent.password === '' &&
    intent.storedUsername !== null &&
    intent.username.trim() === ''
  )
}

export const removalPending = (intent: CredentialIntent) =>
  intent.passwordStored && intent.removePassword
