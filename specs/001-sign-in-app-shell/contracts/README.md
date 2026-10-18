# Contracts of UI feature 001

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it
consumes (constitution I). That contract is not duplicated here. This file records which version
is pinned, how it is vendored and how the client is generated from it.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 001 – authentication, sessions, passkeys, identity, preferences, API keys, public configuration, audit log |
| Contract version (`info.version`) | `0.1.0` |
| Planning baseline commit | `293b7c293ec0b8d8bdf389b35fc1698fcf4d7ffa` (2026-10-18, "Resolve analysis findings for feature 001"; the last commit touching `api/`) |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` (single file, not dereferenced) |
| Bundle sha256 at the baseline | `8fb1d4b4c150390fce8fd1c07687badbe7177943ce686b5e68b14b71f4c4b7b7` |
| Operations | 31 |

The setup task that vendors the contract (T008 in [tasks.md](../tasks.md)) runs the bump script
against the then-latest commit of mailcow-rest-v2, or against the `v0.1.0` tag once it exists. The
script writes the commit actually pinned to `contract/VERSION.json`, which is authoritative from
then on. Any later change is a deliberate contract bump (constitution I): run the script, then
`npm run typecheck`, `npm test` and the end-to-end suite.

## Files in the repository

| Path | Content | Edited by hand? |
|---|---|---|
| `contract/openapi.yaml` | The bundled contract, byte-identical to the API's release artifact (`GET /api/v2/openapi.yaml`) | No |
| `contract/openapi.json` | The same bundle as JSON, read by the mock validator (`tests/mocks/contract/validator.ts`) | No |
| `contract/VERSION.json` | `repository`, `ref`, `commit`, `contractVersion`, `sha256`, `bundler`, `pinnedAt` | No (written by the script) |
| `src/api/generated/schema.d.ts` | Generated types: `paths`, `operations`, `components`, root types and enumeration value arrays | No |

## Commands

```bash
# Pin a new contract version (a tag or a commit of mailcow-rest-v2).
MAILCOW_REST_V2_DIR=../mailcow-rest-v2 scripts/contract/bump.sh <ref>

# Regenerate the JSON bundle and the TypeScript types from contract/openapi.yaml.
npm run contract:generate
#   = redocly bundle contract/openapi.yaml --ext json -o contract/openapi.json
#   + openapi-typescript contract/openapi.yaml -o src/api/generated/schema.d.ts \
#       --root-types --root-types-no-schema-prefix --enum-values --read-write-markers --alphabetize

# CI: checksum, regeneration and a clean git diff.
npm run contract:check
```

## How hand-written code uses the contract

- Only `src/api/` may import `src/api/generated/`, which ESLint enforces. Everything else imports
  from `@/api`: the `api` client (`openapi-fetch` over `paths`), the re-exported root types such
  as `Session`, `Identity` and `ApiKey`, the enumeration arrays, and `ApiProblem`.
- No hand-written type restates an API shape. App-defined models (navigation entries, list
  states, view models) are listed in [data-model.md](../data-model.md#2-app-defined-models).
- Every mocked request and response in tests is validated against `contract/openapi.json`
  ([research R22](../research.md#r22-mock-api-generated-from-the-contract-constitution-vi)).

## Operations used by this feature

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getCsrfToken` | GET `/csrf-token` | bootstrap, CSRF retry, after sign-out and session end | FR-035, R8, R11 |
| `getPublicConfig` | GET `/public-config` | branding, sign-in screens, shell, languages | FR-001–FR-009, FR-048, FR-060 |
| `getPublicConfigLogo` | GET `/public-config/logos/{variant}` | `<img src>` from `Logo.url` only | FR-001 |
| `getSession` | GET `/session` | bootstrap, guards, second-factor resume, "Stay signed in" | FR-029, FR-030, FR-032 |
| `createSession` | POST `/session` | password form | FR-016–FR-019 |
| `deleteSession` | DELETE `/session` | sign-out | FR-036 |
| `cancelPendingSignIn` | DELETE `/session/pending-sign-in` | "Cancel" and expiry of the second-factor step | FR-025, FR-026 |
| `createSecondFactorWebAuthnChallenge` | POST `/session/pending-sign-in/webauthn-challenge` | second-factor WebAuthn | FR-021 |
| `verifySecondFactor` | POST `/session/pending-sign-in/second-factor` | TOTP, WebAuthn and Yubico OTP | FR-020–FR-028 |
| `createPasskeyChallenge` | POST `/session/passkey-challenge` | passkey sign-in (modal and conditional) | FR-010–FR-012 |
| `createSessionWithPasskey` | POST `/session/passkey-assertion` | passkey sign-in | FR-011, FR-013, FR-014 |
| `getIdentity` | GET `/me` | shell, navigation, home, pending actions, guards | FR-042–FR-047, FR-050 |
| `updatePreferences` | PATCH `/me/preferences` | language and theme | FR-058–FR-061 |
| `listPasskeys` | GET `/me/passkeys` | passkeys page, home suggestion | FR-047, FR-052 |
| `createPasskeyRegistrationOptions` | POST `/me/passkeys/registration-options` | add a passkey, pending actions | FR-039, FR-053 |
| `registerPasskey` | POST `/me/passkeys` | add a passkey, pending actions | FR-039, FR-053 |
| `updatePasskey` | PATCH `/me/passkeys/{passkeyId}` | rename | FR-054 |
| `deletePasskey` | DELETE `/me/passkeys/{passkeyId}` | remove | FR-055 |
| `listApiKeys` | GET `/api-keys` | key list | FR-064 |
| `createApiKey` | POST `/api-keys` | create form | FR-065, FR-066 |
| `listApiKeyOwnerCandidates` | GET `/api-keys/owner-candidates` | owner picker and owner filter | FR-064, FR-065 |
| `getApiKey` | GET `/api-keys/{apiKeyId}` | key detail | FR-067 |
| `revokeApiKey` | POST `/api-keys/{apiKeyId}/revocation` | revoke | FR-068 |
| `listAuditEvents` | GET `/audit-events` | audit log | FR-072–FR-074 |
| `getApiDocs` | GET `/docs` | link target only | FR-069 |

Not called: `getPreferences`, `getPasskey`, `getLiveness`, `getReadiness`, `getOpenApiDocument`
and `getProblemTypeDocumentation`.

## Problem types and the app's response

This is the spec's error table, resolved to contract types. Messages come from
`problem.<name>`, never from `title` or `detail` (FR-075).

| `type` (`/api/v2/problems/…`) | Status | App behaviour |
|---|---|---|
| `sign-in-failed` | 401 | Generic failure; keep the username, clear the password, focus (FR-018). After a passkey attempt, suggest username and password (FR-014). |
| `sign-in-expired` | 401 | "Sign-in timed out"; back to the password step with the username kept (FR-025) |
| `second-factor-required` | 401 | Refresh the session; show or resume the second-factor step (FR-029) |
| `second-factor-failed` | 401 | Back to the password step with the username kept (FR-024) |
| `second-factor-unavailable` | 403 | Ask an administrator to reset the second factors (FR-028) |
| `temporary-verification-failure` | 503 | Keep the step; retry or choose another method (FR-027) |
| `too-many-requests` | 429 | Countdown from `retryAfter`; action disabled; re-enabling announced |
| `unauthenticated` | 401 | Session ended (FR-034) |
| `csrf-token-mismatch` | 403 | New token and one silent retry, then session ended (FR-035) |
| `pending-action-required` | 403 | Refresh the session and identity; pending-actions screen (FR-038) |
| `forbidden` | 403 | "No permission" in context; refresh the identity (FR-045) |
| `passkey-registration-failed` | 400 | Explain; offer to try again (FR-053) |
| `validation-failed` | 422 | Field messages from `errors`; summary when there is more than one (FR-076) |
| `about:blank` 404 | 404 | "Not found" state with a way back |
| `about:blank` 412 | 412 | "Changed elsewhere": reload and let the user retry (`useVersionedSave`) |
| `service-unavailable` | 503 | Full-page "temporarily unavailable" with retry |
| `session-required`, `api-key-*`, `insufficient-key-scope`, unknown types, other statuses (including 419) | — | Generic message with retry and the request ID (FR-077) |
