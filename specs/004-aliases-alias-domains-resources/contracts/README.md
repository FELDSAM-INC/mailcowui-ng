# Contracts of UI feature 004

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it consumes
(constitution I), and that contract is not duplicated here. This file records which version this
feature pins, which operations it uses and how it reacts to each problem type. The vendoring and
client generation are unchanged from [UI 001](../../001-sign-in-app-shell/contracts/README.md).

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 004: aliases, alias domains, resources and sender permissions |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, see UI 001 research R6) |
| Planning baseline | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components"), the baseline UI 002 and UI 003 also plan against |
| Why this commit | It has the complete, analysed feature 004 contract (`df21611`, `18431ab`), the API 002 and API 003 contracts, and `KnownProblemType` under `components.schemas` |
| Implementation pin (authoritative once set) | the mailcow-rest-v2 release tag, or merge commit, that ships the API 004 implementation, written to `contract/VERSION.json` by T001 (research R1) |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` (single file, not dereferenced) |
| Bundle sha256 | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` (computed while planning) |
| Operations in the bundle | 376 |
| Problem types named in the bundle | 86 |

The bump task (T001 in [tasks.md](../tasks.md)) runs `scripts/contract/bump.sh` against the release
tag or merge commit of the API 004 implementation. Before accepting it, T001 reads
`git diff 3207925..<ref>` for the feature 004 files below. Any change is reviewed against this plan
before implementation continues (constitution I). If the pin left by UI 002 or UI 003 already
contains the API 004 implementation, it is kept. The pin never goes backwards.

### Feature 004 contract files

These files define what this feature uses. A change to any of them after the pin is a deliberate
contract bump.

- `api/modules/aliases/`: `aliases.yaml`, `alias.yaml`, `alias-alias-domain-copies.yaml`,
  `aliases-bulk-actions.yaml`, `capabilities-aliases.yaml`
- `api/modules/alias-domains/`: `alias-domains.yaml`, `alias-domain.yaml`,
  `alias-domains-bulk-actions.yaml`
- `api/modules/resources/`: `resources.yaml`, `resource.yaml`, `resources-bulk-actions.yaml`
- `api/modules/sender-settings/`: `mailbox-sender-settings.yaml`,
  `sender-permission-candidates.yaml`
- `api/components/schemas/`:
  - `Alias*.yaml`, `Resource*.yaml`, `MailboxSenderSettings*.yaml`, `MailboxSenderPermission*.yaml`
    and `MailboxImplicitSenderAddress.yaml`;
  - the shared `BulkTarget.yaml`, `BulkResult.yaml`, `BulkItemResult.yaml` and
    `BulkItemOutcome.yaml`;
  - the values appended to `KnownProblemType`, `AuditEventType`, `AuditTarget` and
    `ValidationRuleCode`.
- `api/components/parameters/`: `AliasId`, `AliasSort`, `AliasDomainName`, `AliasDomainSort`,
  `ResourceAddress`, `ResourceSort`, `SenderSettingsMailbox` and
  `MailboxSenderPermissionCandidateSort`.
- `api/components/responses/`: `Alias*`, `Resource*`, `MailboxSender*` and `BulkResultResponse`.

## Operations used by this feature

### New in this feature (all 23 operations of API feature 004)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `listAliases` | GET `/aliases` | alias list | FR-005–FR-014 |
| `createAlias` | POST `/aliases` | alias creation, one request per address | FR-018–FR-024 |
| `applyAliasBulkAction` | POST `/aliases/bulk-actions` | alias mass actions, bulk copy | FR-056–FR-060, FR-031 |
| `getAlias` | GET `/aliases/{aliasId}` | alias detail, conflict reload | FR-016, FR-027 |
| `updateAlias` | PATCH `/aliases/{aliasId}` | alias sections | FR-022, FR-026, FR-027 |
| `deleteAlias` | DELETE `/aliases/{aliasId}` | alias deletion | FR-029, FR-030 |
| `copyAliasOverAliasDomains` | POST `/aliases/{aliasId}/alias-domain-copies` | copy from the detail | FR-031, FR-032 |
| `getAliasesCapabilities` | GET `/capabilities/aliases` | `CapabilitiesGate`, forms, bulk bars, groupware-dependent list elements | FR-071 |
| `listAliasDomains` | GET `/alias-domains` | alias domain list; alias-domain group of the alias "Domain" filter | FR-033, FR-034, FR-013 |
| `createAliasDomain` | POST `/alias-domains` | alias domain creation, one request per name | FR-036–FR-038 |
| `applyAliasDomainBulkAction` | POST `/alias-domains/bulk-actions` | alias domain mass actions | FR-056–FR-060 |
| `getAliasDomain` | GET `/alias-domains/{aliasDomain}` | alias domain detail | FR-035 |
| `updateAliasDomain` | PATCH `/alias-domains/{aliasDomain}` | target and active | FR-039 |
| `deleteAliasDomain` | DELETE `/alias-domains/{aliasDomain}` | alias domain deletion | FR-029 |
| `listResources` | GET `/resources` | resource list | FR-042, FR-043 |
| `createResource` | POST `/resources` | resource creation | FR-044, FR-045 |
| `applyResourceBulkAction` | POST `/resources/bulk-actions` | resource mass actions | FR-056–FR-060 |
| `getResource` | GET `/resources/{resourceAddress}` | resource detail | FR-046 |
| `updateResource` | PATCH `/resources/{resourceAddress}` | resource section | FR-046 |
| `deleteResource` | DELETE `/resources/{resourceAddress}` | resource deletion | FR-029 |
| `getMailboxSenderSettings` | GET `/mailboxes/{mailbox}/sender-settings` | "Send as" | FR-049 |
| `updateMailboxSenderSettings` | PATCH `/mailboxes/{mailbox}/sender-settings` | "Send as" save | FR-050–FR-055 |
| `listSenderPermissionCandidates` | GET `/sender-permission-candidates` | candidate picker | FR-050 |

### Reused from earlier features

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getIdentity` | GET `/me` (API 001) | role, scope and the flags `aliasDomains`, `aliasExternalGoto`, `extendSenderAcl`, `ratelimit`; refreshed after permission refusals | FR-002, FR-004 |
| `getPublicConfig` | GET `/public-config` (API 001) | `productName` in the alias address help | FR-067 |
| `listDomains` | GET `/domains` (API 002) | every domain picker, with `backupMx` for the relay rule | FR-011, FR-036, FR-044 |
| `listAuditEvents` | GET `/audit-events` (API 001, with API 002's `targetType` and `targetId`) | History | FR-061 |

All 23 new operations are used. No feature 004 operation is left uncalled.

## How the requests are built

- Creations send one object per request (contract; spec clarification). Multi-entry forms send the
  entries one after another (research R9).
- `PATCH` bodies are JSON Merge Patch (`application/merge-patch+json`). They contain only the changed
  members and never read-only members, and they carry `If-Match` with the `etag` read (research R10).
- Deletions and the single copy send `If-Match`.
- Bulk bodies are `{ action, targets: [{ id, version }] }`, with at most `bulkLimit` targets. The
  `version` is the list entry's `etag` (research R16).
- `GET /sender-permission-candidates` always sends `mailbox` and `type=address&type=domain`. "Any
  address" has its own switch (research R15).

## Problem types and the app's response

Messages come from `problem.<name>` and `validation.<code>` with their parameters, never from `title`,
`detail` or `message` (UI 001 FR-075). Field paths map to fields and entries as data-model §6 lists.

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `validation-failed` | 422 | every write and list | Field and entry messages. List parameter errors reset the offending address parameter. |
| `address-in-use` | 409 | `createAlias`, `updateAlias`, `createResource` | At the address entry, or the resource description, naming the holder (`mailbox`, `resource`, `alias`, `temporaryAlias`) (US2-AS4, US7-AS2). In a multi-entry creation the run continues. |
| `domain-alias-limit-reached` | 409 | `createAlias`, `updateAlias`, `updateAliasDomain` | Count and limit at the address or target field (US2-AS5, US4-AS7). In a bulk copy it is a skip reason. |
| `alias-domain-already-exists` | 409 | `createAliasDomain` | At the name entry, by `existingKind` (US4-AS5). |
| `not-primary-domain-alias` | 409 | `copyAliasOverAliasDomains`, bulk copy items | The action is not offered for `inAliasDomain` aliases. A bulk item shows the reason. |
| `attribute-not-permitted` | 403 | `createAlias`, `updateAlias` (`destinations.N`), `createAliasDomain` (`rateLimit`), `updateMailboxSenderSettings` (`externalSenderAddresses`) | At each named field or entry, naming the flag. Refreshes the identity (FR-004). |
| `permission-flag-required` | 403 | `createAliasDomain` | Form-level message naming the flag. Refreshes the identity, which removes the add control (FR-041). |
| `forbidden` | 403 | every operation (mailbox users) | UI 001's handling: a message and an identity refresh. Screens are not offered to mailbox users. |
| `temporary-failure` | 503 | alias domain list, detail, create, update and delete; bulk items | "Try again shortly". The input is kept, and lists and details show their error state with a retry action. |
| `about:blank` 404 | 404 | detail reads, patches, deletions, copies | First load: the "not found" state with a link back. On a save or refresh: "no longer exists", then back to the list (FR-003, FR-028). |
| `about:blank` 412 | 412 | patches, deletions, copies, sender settings | Outdated flow: the input is kept, the object reloaded and the changes marked. A deletion is confirmed again (FR-027). |
| `csrf-token-mismatch`, `unauthenticated`, `pending-action-required`, `insufficient-key-scope` | 403/401 | any | UI 001's handling (UI 001 contracts README). |
| unknown types, other statuses | — | any | Generic message with the request ID (FR-068). |

## Gaps reported to mailcow-rest-v2

The plan's "API dependency and gaps" section has the details and the interim behaviour:

- **G1**: candidates and permissions lack `kind` (domain or alias domain, alias or mailbox).
- **G2**: there is no readable form of destinations, copy addresses or external sender addresses.
- **G3**: the members of 004 audit `details` are not documented. mailcow-rest-v2 already tracks this
  as `docs/api-gaps.md` G3, fixed per feature in `docs/audit-events.md`.
- **G4**: `reason` versus `kind` for `localDomain`.
