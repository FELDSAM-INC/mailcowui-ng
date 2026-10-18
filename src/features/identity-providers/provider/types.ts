// The identity provider as the client reads it: openapi-fetch returns read-only members as plain
// values and drops the write-only secrets (`Readable`).
import type { IdentityProvider, Readable } from '@/api'

export type IdentityProviderConfig = Readable<IdentityProvider>
