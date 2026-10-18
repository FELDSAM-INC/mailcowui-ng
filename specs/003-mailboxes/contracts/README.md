# Contracts of UI feature 003

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it
consumes (constitution I). That contract is not duplicated here. This file records which version
UI 003 needs, how it is pinned with UI 001's mechanism (UI 001 R6, `scripts/contract/bump.sh`),
which operations the feature calls, and how each problem type is handled.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API features | 003 – mailboxes, mailbox templates, password policy read; also 002 (domains, audit target filters) and 001 |
| Contract version (`info.version`) | `0.1.0`, which does not identify a contract (UI 001 R6) |
| Planning baseline | commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Bundle at the baseline | `@redocly/cli@2.64.1 bundle api/openapi.yaml`, sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`, 376 operations |
| Implementation pin | set by T001: API 003's release tag if one exists, otherwise the mailcow-rest-v2 commit that merges the API 003 implementation (research R1). It is recorded in `contract/VERSION.json`, which is authoritative from then on. |

**Bump procedure** (T001):

```bash
MAILCOW_REST_V2_DIR=../mailcow-rest-v2 scripts/contract/bump.sh <tag-or-commit>
git -C ../mailcow-rest-v2 diff 32079252d55797d3da4e58ae661e9fb91c51c6f9..<tag-or-commit> -- api/  # review the used operations
npm run typecheck && npm run test:unit && npm run i18n:check && npm run test:e2e
```

Pins only move forward (`docs/conventions.md`). If the pin left by UI 002 or a later feature is
newer and contains every operation below, it is kept. Before API 003's implementation is merged,
T001 may pin the baseline itself; the pin then moves forward to the implementation's merge commit
before the smoke tasks. Whatever the pin, UI 003 checks its own operations against the baseline. A
changed member of a used operation or schema is a plan change. It is never fixed silently.

At the baseline, `KnownProblemType` is listed under `components.schemas`, so the generated client
exports `knownProblemTypeValues`. This closes UI 001's API gap 5. The translation check switches to
it (research R2).

## Operations used by this feature

### API 003 (16 operations)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `listMailboxes` | GET `/mailboxes` | list, filters, sort, paging; `initialData` for the detail | FR-006–FR-014, FR-017 |
| `createMailbox` | POST `/mailboxes` | create screen | FR-018–FR-027 |
| `getMailboxCapabilities` | GET `/capabilities/mailboxes` | authentication sources, groupware, last logins, limits, retention | FR-015, FR-024, FR-031, FR-038, FR-039, FR-045, FR-054 |
| `listMailboxTags` | GET `/mailbox-tags` | tag filter and tag input suggestions | FR-009, FR-038 |
| `applyMailboxBulkAction` | POST `/mailboxes/bulk-actions` | bulk actions | FR-053–FR-057 |
| `getMailbox` | GET `/mailboxes/{mailbox}` | detail layout; reload after `412` | FR-015–FR-017, FR-044 |
| `updateMailbox` | PATCH `/mailboxes/{mailbox}` (`application/merge-patch+json`, `If-Match`) | General, Sign-in and password, Protocol access, Permissions, Tags and Custom attributes sections | FR-031–FR-043 |
| `deleteMailbox` | DELETE `/mailboxes/{mailbox}` (`If-Match`) | delete dialog | FR-045–FR-047 |
| `previewMailboxDeletion` | GET `/mailboxes/{mailbox}/deletion-preview` | delete dialog | FR-045 |
| `renameMailbox` | POST `/mailboxes/{mailbox}/rename` (`If-Match`) | rename section | FR-048–FR-052 |
| `listMailboxTemplates` | GET `/mailbox-templates` | template list; template choice on the create screen | FR-021, FR-058 |
| `createMailboxTemplate` | POST `/mailbox-templates` | template create screen | FR-059, FR-060 |
| `getMailboxTemplate` | GET `/mailbox-templates/{mailboxTemplateId}` | template detail | FR-058, FR-061, FR-063 |
| `updateMailboxTemplate` | PATCH `/mailbox-templates/{mailboxTemplateId}` (`If-Match`) | template detail groups | FR-061 |
| `deleteMailboxTemplate` | DELETE `/mailbox-templates/{mailboxTemplateId}` (`If-Match`) | template delete | FR-062 |
| `getPasswordPolicy` | GET `/password-policy` | password hints and generator | FR-029, FR-030 |

### API 002 (2 operations, through UI 002's queries)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `listDomains` | GET `/domains` | domain picker (create) and domain filter (list), with `q` | FR-009, FR-020 |
| `getDomain` | GET `/domains/{domain}` | figures of the chosen domain: `usage.mailboxesLeft`, `defaultNewMailboxQuota`, `maxNewMailboxQuota`; `active`, `backupMx` | FR-020, FR-022 |

### API 001 (3 operations, already used by UI 001)

| operationId | Used by | Requirements |
|---|---|---|
| `getIdentity` | role and permission flags for the gates; refetched after a permission refusal | FR-001, FR-003, FR-041–FR-043 |
| `getPublicConfig` | `productName` for the built-in source and the `pwReset` label | FR-024, FR-072 |
| `listAuditEvents` | History: the audit log screen with `targetType` and `targetId` (filters added by UI 002) | FR-064 |

**Not called**: `updatePasswordPolicy` (UI 013) and every other operation of the bundle.

## Problem types and the app's response

Messages come from `problem.<name>` and the feature variants of `src/features/mailboxes/problems.ts`
(research R17), never from `title` or `detail` (FR-068). The table covers every type that API 003
documents for these operations.

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `validation-failed` | 422 | all writes; list parameters | Field errors from `errors` by dot path (`localPart`, `protocolAccess.pop3`, `tags.3`, `customAttributes.<name>`, `newLocalPart`, `name`, `targets`), with a linked summary that receives the focus (FR-069). Rule codes and parameters as below. |
| `about:blank` 404 | 404 | `getMailbox`, `updateMailbox`, `deleteMailbox`, `previewMailboxDeletion`, `renameMailbox`, the template operations | The "not found" state with a link to the list, the same for foreign and missing objects (FR-004). In a delete dialog: "The mailbox no longer exists", and the list is refreshed. |
| `about:blank` 412 | 412 | `updateMailbox`, `deleteMailbox`, `renameMailbox`, `updateMailboxTemplate`, `deleteMailboxTemplate` | Keep the input, reload, mark the changed fields, save again. A deletion or rename is confirmed again (FR-044). |
| `forbidden` | 403 | any, for a mailbox user; template writes, for a domain administrator | `NoAccessState` or "no permission" in context; refresh the identity (UI 001 R8). |
| `attribute-not-permitted` | 403 | `createMailbox`, `updateMailbox` | One field error per `attributes` entry, naming the permission from `requiredFlags` (for example "Requires: Change protocol access"); refresh the identity and the mailbox; keep the entries (FR-043). |
| `permission-flag-required` | 403 | `applyMailboxBulkAction` (protocol actions) | One message naming the permissions in `requiredFlags`; selection kept; identity refreshed. |
| `insufficient-key-scope` | 403 | — | Cannot happen with a session; the generic message if it does. |
| `address-in-use` | 409 | `createMailbox`, `renameMailbox` | Error on the local part or new local part field naming the holder: `mailbox`, `resource`, `alias` or `temporaryAlias` (FR-027, FR-052). |
| `mailbox-limit-reached` | 409 | `createMailbox` | "The domain {domain} already has {count} of {limit} mailboxes"; the domain is refetched (FR-027, US2-AS8). |
| `mailbox-not-renamable` | 409 | `renameMailbox` | "Only active mailboxes and mailboxes with login disallowed can be renamed", with a link to the general section; the mailbox is refetched. |
| `domain-alias-limit-reached` | 409 | `renameMailbox` | "The domain's alias limit is reached ({count} of {limit})", suggesting a rename without keeping the old address (US8-AS6). |
| `mailbox-template-name-exists` | 409 | `createMailboxTemplate`, `updateMailboxTemplate` | Error on the name field (FR-060). |
| `mailbox-template-protected` | 409 | `updateMailboxTemplate` (rename), `deleteMailboxTemplate` | "The Default template cannot be renamed or deleted". The controls are hidden for `isDefault`, so this is only a fallback. |
| `temporary-failure` | 503 | `listMailboxes`, `getMailbox`, `createMailbox`, `updateMailbox`, `deleteMailbox`, `renameMailbox`, `getPasswordPolicy` | By `dependency`: `mailStore`, `webmail`, `sharedStore`, or a generic text for unknown values. Delete: "not deleted, nothing removed, try again later" (FR-047). Rename: "keeps its old address", with `steps` collapsed. Policy: "the rules are unavailable" (FR-030). Lists and reads: the error state with retry. `Retry-After` is a required header of these responses, so every mocked `503` sends it; the UI shows it as a time. |
| `outcome-unknown` | 504 | `deleteMailbox`, `renameMailbox` | Delete (`step: mailStoreCleanup`): "outcome unknown; no records were removed; the deletion can be retried later". Rename: the persistent report naming the unknown step (research R15). |
| `mailbox-rename-incomplete` | 500 | `renameMailbox` | The persistent report with both addresses and every step's translated outcome, advising to contact the server operator; stays until dismissed (FR-052). |
| `about:blank` 500 | 500 | any | The generic message with the request ID (UI 001 FR-077). |
| `unauthenticated`, `csrf-token-mismatch`, `pending-action-required` | 401, 403 | any | UI 001's session handling (UI 001 R8, R11). |

**Bulk item results**: `BulkItemOutcome` (`done`, `notFound`, `refused`, `outdated`, `failed`) is
translated per item. For `refused`, `outdated` and `failed`, the item's `problem.type` is translated
with the table above, for example `temporary-failure` with `dependency: mailStore` for a failed
mail-store cleanup (US6-AS5).

**Validation rule codes of API 003** (`validation.<code>`, parameters formatted as UI 001 R15
describes):

| Code | Parameters | Example message |
|---|---|---|
| `required` | `because`? | "Required" |
| `tooLong`, `tooShort` | `max`, `min` (on `password`: the policy minimum) | "At most 255 characters"; "At least 10 characters" |
| `tooMany` | `max` | "At most 25 tags" |
| `outOfRange` | `min`, `max` (bytes for quotas), `limit` (`maxMailboxQuota`, `domainQuotaLeft`, `largestAllowedQuota`) | "At most 5 GiB (the domain's quota left)" |
| `notMultipleOf` | `factor` (1048576) | "Must be a whole number of MiB" |
| `invalidFormat` | `format`: `localPart`, `email`, `attributeName` | "Use only letters, digits and ! # $ % & ' * + / = ? ^ _ ` { \| } ~ - ." |
| `notFound` | — (on `templateId`, `domain`) | "The template no longer exists" (the template list is reloaded) |
| `notEligible` | `kind: aliasDomain` | "Alias domains cannot hold mailboxes" |
| `notInList` | `allowed` | "Choose one of: …" (for example `authSource`) |
| `immutable` | — | "This value cannot be changed here" |
| `missingCharacterClass` | `characterClass`: `letter`, `digit`, `special`, `lowerAndUpper` | the legacy policy wording of that rule |
| `conflictsWith` | `field`, `value` | "Not possible with the authentication source {value}" |
| `unchanged` | — | "The new local part equals the current one" |

## How hand-written code uses the contract

- Only `src/api/` imports `src/api/generated/` (UI 001 R3). The feature imports the client, the
  root types and the enumeration arrays from `@/api`.
- No hand-written type restates an API shape. Form and view models (data-model §2) are derived
  types, for example `Pick<Mailbox, 'displayName' | 'status'>` or generated request types.
- `AuditEvent.details` is untyped in the contract (`additionalProperties: true`). It is rendered
  generically, with translated key labels only (research R17, plan API gap A).
- Every mocked request and response is validated against `contract/openapi.json` (UI 001 R22).
