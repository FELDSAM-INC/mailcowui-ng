# Contracts of UI feature 010

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it consumes
(constitution I). This file records the contract version that UI 010 needs, the operations it
uses, and how the app reacts to their problems. Vendoring, client generation and the bump command
are those of UI 001 ([UI 001 contracts](../../001-sign-in-app-shell/contracts/README.md)).

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 010: DKIM, MTA-STS and DNS diagnostics |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, see UI 001 R6) |
| Minimum pinned commit (authoritative) | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` |
| Bundle sha256 at that commit | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` |
| Operations in the bundle | 376 |

The commit contains the complete API 010 contract:
- the bulk deletion `POST /dkim-keys/bulk-actions`;
- `overwrite` on `generateDkimKey`;
- `DnsCheck.id`, with `DnsCheckMessage` codes and params;
- `DkimDnsPublicationReasonCode`;
- `DnsCapabilities.serverHostname`;
- the `RateLimit-*` headers on diagnostics.

It also lists `KnownProblemType` under `components.schemas`, so `knownProblemTypeValues` is
generated (UI 001 plan gap 5, closed).

T002 pins exactly this commit unless the vendored pin, set by UI 002–009, is already this commit
or a descendant of it. In that case it keeps the pin and checks that the operations and schemas
below are unchanged (research R1). `contract/VERSION.json` stays authoritative for the commit that
is actually vendored. T002 records that commit and its sha256 in the "Pin as implemented" line
below.

**Pin as implemented**: mailcow-rest-v2 `main` at `e7efa732101e28f4f165f8e089ee6994d115b932`
(2026-10-19, "Walk through the quickstart of feature 010 and record the gates"), bundle sha256
`da783ad914587a8cb7a1db917e6c0f826675044122dfd466f0934c3ecbfc09aa`. It descends from `3207925`
and from the previous pin `33f1eea`. Against `3207925`, the DKIM, MTA-STS and diagnostics modules
are unchanged except `DnsCapabilities.dkim.bulkLimit` (required, plan gap 2 closed). Against
`33f1eea`, the only other changes are descriptions: `DomainPatch` and `DomainTemplatePatch`
(`mustNotExceed` checked only when a quota changes) and the audit `targetId` filter, which now
names `mtaStsPolicy` and `dkimKey`. API 010 is implemented at this commit.

## Operations used by this feature

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getDnsCapabilities` | GET `/capabilities/dns` | every DNS screen; DKIM settings summary; form defaults and limits | FR-002, FR-015, FR-025, FR-029, FR-043, FR-047, FR-048, FR-058, FR-077 |
| `listDkimKeys` | GET `/dkim-keys` | DKIM list; "all names without a key" collection; copy target picker | FR-005–FR-014, FR-024, FR-034 |
| `generateDkimKey` | POST `/dkim-keys` | generation (single, selection, all missing); replacement with `overwrite` | FR-024–FR-028, FR-041, FR-090 |
| `applyDkimKeyBulkAction` | POST `/dkim-keys/bulk-actions` | bulk deletion | FR-038, FR-040, FR-092 |
| `getDkimKey` | GET `/dkim-keys/{dkimName}` | entry page; DKIM sections of domain and alias domain pages; import name lookup | FR-016–FR-021, FR-030 |
| `deleteDkimKey` | DELETE `/dkim-keys/{dkimName}` | single deletion | FR-037–FR-039 |
| `importDkimKey` | POST `/dkim-keys/{dkimName}/import` | import page (direct call, R11) | FR-029–FR-033 |
| `copyDkimKey` | POST `/dkim-keys/{dkimName}/copy` | copy page | FR-034–FR-036 |
| `exportDkimPrivateKey` | GET `/dkim-keys/{dkimName}/private-key` | export dialog (direct call, R12) | FR-077 |
| `publishDkimDnsRecord` | POST `/dkim-keys/{dkimName}/dns-publication` | "Publish DNS record again" | FR-045 |
| `listMtaStsPolicies` | GET `/mta-sts-policies` | policy list | FR-054–FR-056 |
| `createMtaStsPolicy` | POST `/mta-sts-policies` | set-up form | FR-047, FR-048, FR-050, FR-051 |
| `getMtaStsPolicy` | GET `/mta-sts-policies/{policyDomain}` | domain page MTA-STS section | FR-046 |
| `updateMtaStsPolicy` | PATCH `/mta-sts-policies/{policyDomain}` | edit form, activate, deactivate | FR-049, FR-050, FR-052 |
| `runDnsDiagnostics` | GET `/dns-diagnostics/{diagnosticsName}` | diagnostics page | FR-057–FR-069, FR-091 |

Already used by earlier features and extended here:
- `listAuditEvents`: the history, with `targetType` `dkimKey` and `mtaStsPolicy` (FR-070);
- `getIdentity`: the role.

No other operation is called.

### Headers read or sent

| Header | Operation(s) | Use |
|---|---|---|
| `If-Match` (sent) | `generateDkimKey` with `overwrite`, `importDkimKey` with `overwrite`, `copyDkimKey` (target with a key), `deleteDkimKey`, `publishDkimDnsRecord`, `updateMtaStsPolicy` | The `etag` as read (conventions) |
| `ETag` (read) | single reads and changes | Equals `data.etag`; the app uses `data.etag` |
| `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (read) | `runDnsDiagnostics` (200 and 429) | `RateLimitState` (R14) |
| `Retry-After` (read) | `runDnsDiagnostics` 429; DKIM 503 | Countdown; "try again in…" |
| `Cache-Control: no-store` | `runDnsDiagnostics`, `exportDkimPrivateKey` | Required by the contract; the mock sends it |
| `Content-Type: application/merge-patch+json` (sent) | `updateMtaStsPolicy` | Merge patch with changed members only |

## Problem types and the app's response

Messages come from `problem.<name>` and the feature's context keys, never from `title` or `detail`
(UI 001 FR-075). The full table with screens is research R21.

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `dkim-key-exists` | 409 | generate, import, copy | Single generation: "already has a key" and refresh. Run item: `exists`. Import: name-field error with "Switch on overwrite". Copy: target "has a key now". |
| `dkim-private-key-export-disabled` | 403 | export | Message; capabilities refetched; action removed |
| `dkim-dns-publication-disabled` | 403 | publish again | Message; capabilities refetched; action removed |
| `mta-sts-policy-exists` | 409 | create policy | Reload the policy and continue as an edit |
| `temporary-failure` | 503 | DKIM operations | "Nothing was changed", with retry after `Retry-After`, keeping the input |
| `too-many-requests` | 429 | diagnostics | Previous result kept; countdown; "Run again" disabled |
| `validation-failed` | 422 | forms, bulk | Field errors from rule codes (see below) |
| `forbidden`, `pending-action-required`, `csrf-token-mismatch`, `insufficient-key-scope`, `api-key-source-not-allowed` | 403 | any | UI 001 handling, plus a capabilities refetch for `forbidden` |
| `about:blank` 404 | 404 | entry, diagnostics, policy, actions | Not-found page, "no policy", or "no longer exists" |
| `about:blank` 409 | 409 | copy | "The source key is incomplete and cannot be copied" |
| `about:blank` 412 | 412 | versioned writes | Refetch; confirm again or mark changed values |

### Validation rule codes of this feature

Each code and parameter set is translated as `validation.<code>` (UI 001 R15):

| Field path | Codes and params |
|---|---|
| `name` (generate) | `required`, `tooLong` (`max`) |
| `selector` | `required`, `tooLong` (`max`), `invalidFormat` (`format: dkimSelector`) |
| `keySize` | `notInList` (`allowed`) |
| `dkimName` (import path name) | `invalidFormat` (`format: domainName`) |
| `privateKey` | `required`, `tooLong` (`max: 16384`, `unit: bytes`), `invalidPrivateKey`, `encryptedPrivateKey`, `unsupportedKeyType` (`allowed`), `keyLengthOutOfRange` (`min`, `max`) |
| `target` (copy) | `required`, `notFound`, `sameAsSource` |
| `targets` (bulk) | `tooMany` (`max: 100`) |
| `domain` (policy create) | `required`, `tooLong` |
| `version` | `notInList` (`allowed`) |
| `mode` | `required`, `notInList` (`allowed`) |
| `maxAge` | `required`, `outOfRange` (`min`, `max`) |
| `mxHosts` | `required`, `tooLong` (`max: 255`), `tooMany` |
| `mxHosts.<i>` | `invalidFormat` (`format: mxHost`) |

Unknown codes fall back to `validation.invalid` (UI 001 FR-076).

## Contract components the mock must honour

The mock validator enforces these parts of the contract (UI 001 R22):

- Required headers:
  - `Location` and `ETag` on `201`;
  - `ETag` on `200` changes and on policy reads;
  - `RateLimit-*` and `Cache-Control: no-store` on diagnostics;
  - `Retry-After` on `429` and `503`;
  - `Cache-Control: no-store` on the export.
- `DkimDnsRecord.valueParts` with items of at most 255 characters, joined equal to `value`, which
  the factory guarantees.
- The `MtaStsPolicy.policyId` pattern `^[0-9]{14}$`, and the `DnsCheck.id` pattern.
- Closed enumerations (`DnsCheckMessageCode`, `DkimDnsPublicationReasonCode`, `DkimKeyState`,
  `BulkItemOutcome`…): no unknown values in mocked data. Their fallbacks are unit-tested (research
  R24).
