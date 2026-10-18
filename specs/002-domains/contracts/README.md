# Contracts of UI feature 002

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it
consumes (constitution I), vendored and generated as UI 001 describes
([contracts/README.md](../../001-sign-in-app-shell/contracts/README.md)). This file records the
pin this feature needs, the operations it uses, and how it reacts to their problem types.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 002 – domains, domain templates, domain footers, capabilities, distinct tags, bulk actions; audit target filters |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, UI 001 R6) |
| Planning baseline (commit) | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Bundle sha256 at the baseline | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` |
| Operations in the bundle | 376 (this feature uses 16 new ones plus `listAuditEvents`) |
| API 002 contract unchanged since | `651cef0` ("Move domain capabilities to /capabilities/domains") |
| Pin at implementation | the release tag, or else the first commit, at which mailcow-rest-v2 feature 002 is implemented and its quickstart Part A passes (research D1) |

**Bump procedure** (tasks.md T001):

```bash
MAILCOW_REST_V2_DIR=../mailcow-rest-v2 scripts/contract/bump.sh <tag-or-commit>
git -C ../mailcow-rest-v2 diff --stat 32079252d55797d3da4e58ae661e9fb91c51c6f9 <tag-or-commit> -- \
  api/modules/domains api/modules/domain-templates api/modules/audit/audit-events.yaml \
  'api/components/schemas/Domain*' 'api/components/parameters/Domain*' \
  'api/components/responses/Domain*' api/components/schemas/BulkTarget.yaml \
  api/components/schemas/BulkResult.yaml api/components/schemas/BulkItemResult.yaml \
  api/components/schemas/BulkItemOutcome.yaml api/components/responses/BulkResultResponse.yaml
npm run typecheck && npm run i18n:check && npm run test:unit && npm run test:e2e
```

Pins only move forward (`docs/conventions.md`). When `contract/VERSION.json` already pins a later
commit than the chosen ref, keep it: run the diff against that commit, and confirm that it
implements feature 002. An empty diff confirms that the plan still matches the contract. A non-empty diff is reviewed
against this plan before implementation continues. The bump also brings the shared enumeration
values and operations of mailcow-rest-v2 features 003 to 013. They are not used, and the
translation coverage manifest keeps them out of the completeness gate (research D2). It also
generates `knownProblemTypeValues`, closing UI 001's API gap 5.

## Operations used by this feature

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `listDomains` | GET `/domains` | domain list; seeding the domain page | FR-005 to FR-014 |
| `createDomain` | POST `/domains` | create page | FR-018 to FR-028 |
| `applyDomainBulkAction` | POST `/domains/bulk-actions` | bulk activate, deactivate, delete | FR-045 to FR-048 |
| `getDomain` | GET `/domains/{domain}` | domain page, footer page header | FR-015 to FR-017 |
| `updateDomain` | PATCH `/domains/{domain}` | section saves | FR-029 to FR-040 |
| `deleteDomain` | DELETE `/domains/{domain}` | deletion | FR-041 to FR-044 |
| `previewDomainDeletion` | GET `/domains/{domain}/deletion-preview` | deletion impact | FR-041 to FR-043 |
| `getDomainFooter` | GET `/domains/{domain}/footer` | footer summary, footer editor | FR-015, FR-057 |
| `replaceDomainFooter` | PUT `/domains/{domain}/footer` | footer editor | FR-057 to FR-062 |
| `getDomainsCapabilities` | GET `/capabilities/domains` | limits and server settings of every form and the list | FR-021, FR-024, FR-039, FR-040, FR-045, FR-060 |
| `listDomainTags` | GET `/domain-tags` | tag filter and tag suggestions | FR-010, FR-039 |
| `listDomainTemplates` | GET `/domain-templates` | template list; template choice of the create page | FR-019, FR-049, FR-050 |
| `createDomainTemplate` | POST `/domain-templates` | template create page | FR-051, FR-052 |
| `getDomainTemplate` | GET `/domain-templates/{templateId}` | template page | FR-051, FR-053 |
| `updateDomainTemplate` | PATCH `/domain-templates/{templateId}` | template sections | FR-051, FR-053, FR-054 |
| `deleteDomainTemplate` | DELETE `/domain-templates/{templateId}` | single and multiple template deletion | FR-055 |
| `listAuditEvents` (UI 001) | GET `/audit-events` with `targetType`, `targetId` | History | FR-063 |
| `getIdentity` (UI 001) | GET `/me` | permissions (`role`, `permissions.domainDesc`, `scope`) | FR-001 to FR-003 |

Every write sends `X-CSRF-Token` (UI 001 R8). Every change sends `If-Match` with the `etag` that
was read, and every bulk target carries its `version` (research D11, D20, D22, D23).

## Problem types and the app's response

Messages come from `problem.<name>` and `validation.<code>`, never from `title`, `detail` or
`errors[].message` (FR-064).

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `validation-failed` | 422 | create, update, replace footer, template writes, bulk (`targets`), lists | Field messages next to fields with parameters (sizes as sizes), summary at the top, focus moves to it (FR-027, FR-065). Unknown codes: `validation.invalid`. |
| `domain-exists` | 409 | `createDomain` | Error on the name field; the first step opens; input kept (US2-AS3) |
| `domain-not-empty` | 409 | `deleteDomain`; bulk item `refused` | "n mailboxes and m resources remain" from the `mailboxes` and `resources` members (US4-AS3) |
| `domain-template-name-exists` | 409 | template create and rename | Error on the name field (US6-AS2) |
| `domain-template-protected` | 409 | template rename or delete | "The Default template cannot be renamed or deleted". The controls are hidden anyway (FR-053). |
| `attribute-not-permitted` | 403 | `updateDomain` | Reason naming each attribute of `attributes`; identity and domain refetched; those fields read-only; other input kept (FR-003, US3-AS8) |
| `forbidden` | 403 | any | UI 001's handling: "no permission" in context, identity refreshed |
| `temporary-failure` | 503 | create, delete; bulk item `failed` | "Nothing was changed", retry keeps the input; `Retry-After` shown as a wait time (FR-066) |
| `about:blank` 404 | 404 | domain, footer, template reads and writes | `NotFoundPage` with a link to the list; on a write, "no longer available" and the caches removed (FR-004, edge cases) |
| `about:blank` 412 | 412 | update, delete, replace footer, template writes; bulk item `outdated` | Outdated handling (research D11, D20); bulk row "changed in the meantime", kept selected |
| `insufficient-key-scope`, `csrf-token-mismatch`, `pending-action-required`, `unauthenticated` | — | any | UI 001's handling (R8) |

## Validation rule codes this feature's forms can receive

| Code | Fields | Parameters shown |
|---|---|---|
| `required` | `name`, template `name` | — |
| `tooLong` | `name`, `description`, `tags.n`, template `name`, `html`, `plain`, exclusions | `max` (as a size with `unit: bytes`) |
| `tooMany` | `tags`, `targets` | `max` |
| `outOfRange` | limits, quotas, `rateLimit.value` | `min`, `max` (sizes for quotas) |
| `notInList` | `dkimKeySize`, `rateLimit.frame` | `allowed` |
| `invalidFormat` | `name` (`domainName`), `dkimSelector` (`dkimSelector`), exclusions (`email`, `domainName`) | the format label |
| `notFound` | `templateId`, `excludedAddresses.n`, `excludedAliasDomains.n` | — |
| `notMultipleOf` | quotas | `factor` as a size |
| `mustNotExceed` | `defaultMailboxQuota`, `maxMailboxQuota` | `field` as its label, `value` as a size |
| `belowInUse` | `maxMailboxes`, `maxAliases`, `maxMailboxQuota`, `domainQuota` | `inUse` (a size for quotas) |
| `reserved` | `name` (the server's host name) | — |
| `immutable` | read-only members | — (never sent by the app; shown generically) |
