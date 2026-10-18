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
| Operations in the bundle | 376 at the baseline, 377 at the pin (this feature uses 16 new ones, plus UI 001's `listAuditEvents` and `getIdentity`) |
| API 002 contract unchanged since | `651cef0` ("Move domain capabilities to /capabilities/domains") |
| Pin at implementation | the release tag, or else the first commit, at which mailcow-rest-v2 feature 002 is implemented and its quickstart Part A passes (research D1) |
| Pinned (T001, 2026-10-18) | `97aa81f3dec5c797ec6d162bcc8fbc50a5d1c814` ("Implement the audit log list and retention purge (001 US6, G18, G19)"), the latest mailcow-rest-v2 `main` commit that touches `api/` when UI 002 started. Bundle sha256 `66461886e27f3b378da80d48dd1284881eb186b6de1826e60bafb0464eb4d7b2`, 376 operations. API 002 was still being implemented (its worktree had not changed `api/`), so no commit yet implements feature 002 and passes its quickstart Part A; the pin moves forward when it lands. |
| Pin moved (2026-10-18, during US5) | `c1677d577ba66ef3ff360421e0478d6eb3ae5144` ("Do not rebuild the groupware directory when a domain is created, like legacy"), on the coordinator's request. API feature 002 is implemented at this commit (US1 to US8 and its polish, with staging release checks). Bundle sha256 `c7e7fd56b6dd95cd36f2a442bd6afa55691fd9296a0d49c67bc2e624c3735f89`, 377 operations (the new one is `getApiRoot`). |
| Pin moved (2026-10-18, during US7) | `80d0c4b` (API `main`), on the coordinator's request, for the footer exclusion list: `listMailboxes`, `listAliases` and `listAliasDomains` filtered by domain (features 003 and 004), and `applyDomainTemplateBulkAction` (gap G40). |
| Pin moved (2026-10-18, during US8) | `4c257673352c16d12c842e043bef90584381ea32` ("Remove the default mailbox quota from the API (owner decision)"), with features 003, 004, 008 and 011. `defaultMailboxQuota` is gone from domains, templates, their requests, sorts and bulk results; the UI never sends, reads or sorts it. Bundle sha256 `9dddcdb6f7e2355c6a9f56d4ef2c23ed69514151843237e97a51e9ea401b90a9`, 379 operations. |

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
implements feature 002. The `Domain*` globs also match `DomainAdmin*` and
`DomainRelayhostAssignment*` (features 007 and 009). Changes to those files are ignored unless
`Domain.yaml` or another file of this feature starts referencing them. An empty diff confirms that
the plan still matches the contract. A non-empty diff is reviewed
against this plan before implementation continues. The bump also brings the shared enumeration
values and operations of mailcow-rest-v2 features 003 to 013. They are not used, and the
translation coverage manifest keeps them out of the completeness gate (research D2). It also
generates `knownProblemTypeValues`, closing UI 001's API gap 5.

**Domain contract diff at the pin** (T001 step 3): between `3207925` and `97aa81f`, only
`api/modules/audit/audit-events.yaml` changed. It gained the `authMethod` and `requestId` filters
of `GET /audit-events` (API gaps G18 and G19, for UI 012) and a note that an unknown event type
matches no records. The `targetType` and `targetId` filters that this plan uses are unchanged, so
the plan still matches the contract. `AuditEvent.details` now points to mailcow-rest-v2
`docs/audit-events.md`, which does not document the domain, template or footer records yet (gap G1
below). The bump also generates `knownProblemTypeValues`, closing UI 001's API gap 5.

**Domain contract diff at the move to `c1677d5`** (97aa81f..c1677d5): the range holds API 002's
domains, the `GET /api/v2/` redirect (`getApiRoot`, not used) and the creation report fix. Every
operation this feature uses was reviewed; the changes and how the app follows them:

- `DomainCreationReport` lost `groupwareDirectoryUpdate`: like legacy, a creation does not rebuild
  the groupware directory. The report has four steps (`rateLimit`, `dkimKey`,
  `dkimDnsPublication`, `groupwareRestart`); the step, its messages and its coverage entry are
  gone. The alias domain and mailbox reports keep their own step.
- `Domain.footer` (`DomainFooterSummary`, gap G28, required): the domain page's footer summary
  reads it and no longer fetches the footer. `DomainPatch` lists `footer` as read-only (the app
  never sends it). A footer save invalidates the domain and the lists, because the summary is not
  covered by the domain's version tag.
- `DomainCapabilities.templateDefaults` (gap G29, administrators only) and the `default` keywords
  of `DomainTemplateCreateRequest`: the create form without a template, and the new template form,
  start from `templateDefaults`; `defaults.ts` stays as the fallback for its absence and is tested
  against the `default` keywords. openapi-typescript makes the members with a `default` keyword
  required in the generated `DomainTemplateCreateRequest`; the app always sends a whole template,
  so that is kept. openapi-fetch's `Readable` drops `templateDefaults.rateLimit` (type `null`)
  from the response type, so the capabilities read is typed as `DomainCapabilities`.
- `BulkTarget.version` (gap G33): documented as the exact `etag`, quotes included, also accepted
  without them. The app now sends the `etag` exactly as read.
- `PermissionFlagRequiredProblem` (G34): shared base of the permission-flag problems; none of this
  feature's operations returns it.
- `createDomain`'s description no longer lists the groupware directory step. Nothing else of the
  sixteen operations, their parameters or their problem types changed.

**Generator note**: openapi-typescript 7.13 emits a few value-array annotations that do not compile
for schemas of features 003 and 005 (read-only enums and `oneOf` members rendered as `unknown`).
`scripts/contract/generate.mjs` therefore marks the generated file `@ts-nocheck`; the declarations
stay fully typed for the code that imports them.

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
| `getDomainFooter` | GET `/domains/{domain}/footer` | footer editor (the summary reads `Domain.footer`) | FR-057 |
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
