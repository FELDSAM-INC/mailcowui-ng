# Contracts of UI feature 007

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it
consumes (constitution I), which is not duplicated here. This file records the pinned contract
version, the operations this feature uses, and the app's response to each problem type.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 007 – administrators, domain administrators, permission flags, impersonation, webmail on behalf, single sign-on tokens |
| API 007 contract | as of commit `a13c370fba4064dc7fd8c53b7ec9a54b3b77baed` ("Apply orchestrator decisions to feature 007"); no later commit changes it |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, UI 001 R6) |
| Pinned commit (authoritative) | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` |
| Bundle sha256 at planning | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` |
| Paths, operations | 250, 376 (the contracts of API 001 to 013) |
| `KnownProblemType` | registered under `components.schemas` (86 types), so `knownProblemTypeValues` is generated |

Pins only move forward. The setup task T001 keeps the pin that UI 001 to 006 left when it is this
baseline or newer, and then checks this feature's operations against the baseline; otherwise it runs
`scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9` and confirms the sha256 above.
It never pins "the latest commit". The result is recorded in `contract/VERSION.json`, which is
authoritative from then on.

## Operations used by this feature

### API feature 007 (20 of 21)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `listDomainAdmins` | GET `/domain-admins` | domain administrator list | FR-005–FR-008 |
| `createDomainAdmin` | POST `/domain-admins` | creation form | FR-011–FR-017 |
| `getDomainAdmin` | GET `/domain-admins/{username}` | detail | FR-018 |
| `updateDomainAdmin` | PATCH `/domain-admins/{username}` | sections, permissions, status, rename | FR-019–FR-023, FR-026, FR-029 |
| `deleteDomainAdmin` | DELETE `/domain-admins/{username}` | removal | FR-025 |
| `suspendDomainAdminSecondFactors` | POST `/domain-admins/{username}/second-factor-suspension` | sign-in and security | FR-024 |
| `applyDomainAdminBulkAction` | POST `/domain-admins/bulk-actions` | bulk bar | FR-009, FR-010 |
| `listAdmins` | GET `/admins` | administrator list; active-administrator count | FR-032, FR-036 |
| `createAdmin` | POST `/admins` | creation form | FR-033 |
| `getAdmin` | GET `/admins/{username}` | detail | FR-034 |
| `updateAdmin` | PATCH `/admins/{username}` | sections, status, rename | FR-034, FR-036, FR-037 |
| `deleteAdmin` | DELETE `/admins/{username}` | removal | FR-035, FR-038 |
| `suspendAdminSecondFactors` | POST `/admins/{username}/second-factor-suspension` | sign-in and security | FR-024, FR-034 |
| `applyAdminBulkAction` | POST `/admins/bulk-actions` | bulk bar | FR-032, FR-035, FR-036 |
| `getAccountCapabilities` | GET `/capabilities/accounts` | creation forms, bulk limit, username length | FR-012, FR-015 |
| `issueDomainAdminSsoToken` | POST `/domain-admins/{username}/sso-token` | one-time link dialog | FR-062, FR-063 |
| `createSessionWithSsoToken` | POST `/session/sso-token` | landing | FR-058–FR-061 |
| `startImpersonation` | POST `/session/impersonation` | "Sign in as" | FR-040–FR-045 |
| `endImpersonation` | DELETE `/session/impersonation` | "Return to …" | FR-046 |
| `createWebmailSignInOnBehalf` | POST `/mailboxes/{mailbox}/webmail-sign-in` | "Open webmail as" | FR-055, FR-056 |

Not called: `getImpersonation` (`Identity.impersonation` carries the same data on every identity
read).

### Earlier features (8)

| operationId | Method and path | Feature | Used by | Requirements |
|---|---|---|---|---|
| `getCsrfToken` | GET `/csrf-token` | 001 | token renewal after an end, an automatic end, a cross-tab change, a mismatch | FR-053, R4, R5 |
| `getIdentity` | GET `/me` | 001 | identity after a switch; the re-read before a CSRF replay | FR-048, FR-052, FR-053 |
| `getSession` | GET `/session` | 001 | session state after a switch; self-deactivation; landing | FR-037, FR-060 |
| `deleteSession` | DELETE `/session` | 001 | "Sign out completely" | FR-047 |
| `listAuditEvents` | GET `/audit-events` | 001 (filters of 002 and 007) | History links; impersonated filter | FR-071 |
| `listDomains` | GET `/domains` | 002 | domain picker | FR-013 |
| `getPasswordPolicy` | GET `/password-policy` | 003 | password field | FR-014 |
| `getMailboxCapabilities` | GET `/capabilities/mailboxes` | 003 | `groupwareEnabled` for "Open webmail as" | FR-055 |

### Operations whose refusal while acting this feature presents

Not called by UI 007, but their screens (UI 001, UI 005) are made unavailable while acting, and a
`403 not-allowed-while-impersonating` from them shows the acting reason (FR-049, FR-057):
`createPasskeyRegistrationOptions`, `registerPasskey`, `updatePasskey`, `deletePasskey`,
`changeOwnPassword`, `startOwnTotpEnrolment`, `createOwnSecondFactorWebAuthnOptions`,
`enrolOwnSecondFactor`, `deleteOwnSecondFactor`, `removeAllOwnSecondFactors`,
`replaceOwnRecoveryEmail` and `createWebmailHandOff`.

## Calls that bypass the query cache

Requests and responses that carry a secret are direct client calls, never `useQuery` or
`useMutation` (`docs/conventions.md`, "Secrets in requests or responses"): `createAdmin`,
`createDomainAdmin`, `updateAdmin` and `updateDomainAdmin` when they carry `password`,
`createSessionWithSsoToken`, `issueDomainAdminSsoToken` and `createWebmailSignInOnBehalf`.

## Behaviour taken from the contract's root document

- **Anti-forgery after an identity change** ("Authentication", step 1): on `csrf-token-mismatch`,
  fetch a new token and re-read `GET /me`; retry the write once only when the identity is
  unchanged, otherwise discard it. UI 001's unconditional retry changes accordingly (research R5).
- **Start** answers the new token in `data.csrfToken`; **end** answers `204`, after which the client
  fetches a token (`GET /csrf-token`) (API 007 R16).

## Problem types and the app's response

Messages come from `problem.<name>` and `validation.<code>`, never from `title` or `detail`.

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `account-exists` | 409 | create, rename | Message on the username field; values kept (US1-AS5) |
| `last-active-admin` | 409 | `updateAdmin`, `deleteAdmin`; bulk item `refused` | Translated message; the account shows its actual state (FR-039, US4-AS7) |
| `cannot-delete-own-account` | 409 | `deleteAdmin`; bulk item `refused` | Translated message (FR-039) |
| `already-impersonating` | 409 | `startImpersonation` | Message; the user stays in their view (FR-042) |
| `impersonation-ended` | 403 | any session request except the end and sign-out | Identity switch `actingEndedByServer`: token renewed, identity re-read, origin or home, notice that acting ended and the request was not carried out; never resent (FR-051) |
| `not-allowed-while-impersonating` | 403 | credential operations, webmail sign-ins | "Not available while acting as another user" (FR-049, FR-057) |
| `webmail-on-behalf-disabled` | 403 | `createWebmailSignInOnBehalf` | Message; the action is hidden after the next identity read (FR-056) |
| `groupware-disabled` | 403 | `createWebmailSignInOnBehalf` | Message (the action is normally hidden by `groupwareEnabled`) |
| `account-inactive` | 409 | `issueDomainAdminSsoToken` | Message; the account is refreshed (FR-062) |
| `permission-flag-required` | 403 | `startImpersonation`, `createWebmailSignInOnBehalf` | Message naming "Log in as mailbox user" from `requiredFlags` (FR-042) |
| `session-required` | 403 | — (the app always uses a session) | Generic message (UI 001) |
| `pending-action-required` | 403 | any | UI 001 (pending-actions screen) |
| `csrf-token-mismatch` | 403 | any write | Research R5 |
| `forbidden` | 403 | any | "No permission" in context, identity refreshed (UI 001 FR-045) |
| `sign-in-failed` | 401 | `createSessionWithSsoToken` | Sign-in screen with "This sign-in link is invalid or has expired" (FR-061) |
| `too-many-requests` | 429 | `createSessionWithSsoToken` | UI 001's throttling message with countdown on the landing (FR-061) |
| `validation-failed` | 422 | creates, updates, bulk (`tooMany`), webmail (`notEligible`) | Field errors: `invalidFormat` (`accountUsername`, `domainName`), `reserved`, `tooLong`, `required`, `notFound` and `notEligible` on `domains.<i>` (keyed by code and path only, because the contract describes the alias-domain case with `expected` in one place and `kind` in another), `notEligible` with `reason` on `mailbox`, password rule codes; a summary when there is more than one (FR-016) |
| `about:blank` 404 | 404 | details, start, webmail, token issue | "Not found" state with a link to the list; for start and webmail a message in place |
| `about:blank` 412 | 412 | updates, suspension, deletion | "Changed elsewhere": input kept, values reloaded and marked (FR-066) |
