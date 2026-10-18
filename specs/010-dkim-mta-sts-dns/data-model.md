# Data Model: DKIM, MTA-STS and DNS

**Feature**: `specs/010-dkim-mta-sts-dns` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines the following for UI 010:

- the API data consumed, as generated types;
- the app-defined view models derived from it;
- the server-state cache;
- the client state, where nothing new is stored;
- the routes and their address parameters;
- the client-side validation;
- the state machines.

Contract shapes are not restated. Types come from `src/api/generated/schema.ts` through `@/api`
(UI 001 research R7). Decisions are justified in [research.md](./research.md).

## 1. API data consumed

These are generated root types, imported from `@/api`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `DnsCapabilities` | `getDnsCapabilities` | every DNS screen | `dkim.privateKeyExportEnabled` is `null` for domain administrators; `dnsDiagnostics.serverChecks` follows the role (R4) |
| `DkimKey`, `DkimKeyDetails`, `DkimDnsRecord`, `DkimKeyKind`, `DkimKeyState` | `listDkimKeys`, `getDkimKey` | list, entry, domain and alias domain sections, copy picker, import lookup | `name` addresses the entry (ASCII or exact stored spelling); `etag` is `null` without a key |
| `ListMeta` | `listDkimKeys`, `listMtaStsPolicies` | lists | `total`, `limit`, `offset` |
| `DkimKeyGenerateRequest` | `generateDkimKey` | generation, replacement | `overwrite: true` only for administrators (FR-090) |
| `DkimKeyImportRequest` | `importDkimKey` | import page | `privateKey` is `writeOnly`; sent by a direct call only (R11) |
| `DkimKeyCopyRequest` | `copyDkimKey` | copy page | one target per request |
| `DkimKeyChangeResult`, `DkimDnsPublicationOutcome`, `DkimDnsPublicationStatus`, `DkimDnsPublicationReasonCode` | generate, import, copy, publish | results, entry | the `DkimKey` part is written to the cache; the outcome is shown only while publication is enabled |
| `DkimKeyBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `applyDkimKeyBulkAction` | bulk deletion | `meta.dnsPublication` maps target `id` to `DkimDnsPublicationOutcome` |
| `DkimPrivateKey` | `exportDkimPrivateKey` | export dialog | never cached; held in a component `ref` while the dialog is open (R12) |
| `MtaStsPolicy`, `MtaStsDnsRecord`, `MtaStsMode` | `listMtaStsPolicies`, `getMtaStsPolicy`, `createMtaStsPolicy`, `updateMtaStsPolicy` | policy list, domain section | `policyId` is 14 digits; `etag` for `If-Match` |
| `MtaStsPolicyCreateRequest`, `MtaStsPolicyPatch` | create, update | MTA-STS form | the patch holds only the changed members |
| `DnsDiagnosticsResult`, `DnsCheck`, `DnsCheckStatus`, `DnsCheckMessage`, `DnsCheckMessageCode` | `runDnsDiagnostics` | diagnostics page | headers `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` are read from the response |
| `AuditEvent`, `AuditEventType`, `AuditTarget` | `listAuditEvents` (UI 001/002) | history | `details` rendered generically (plan gap 1) |
| `Problem`, `ValidationProblem`, `FieldViolation`, `ValidationRuleCode`, `TooManyRequestsProblem`, `KnownProblemType` | every error | `ApiProblem`, i18n | `knownProblemTypeValues` is generated at this pin |

Enumeration value arrays used for translations and checks (`--enum-values`):
- `dkimKeyStateValues` and `dkimKeyKindValues`;
- `dkimKeyDetailsMissingPartsValues`;
- `dkimDnsPublicationStatusValues` and `dkimDnsPublicationReasonCodeValues`;
- `dnsCheckStatusValues`, `dnsCheckMessageCodeValues` and `dnsCheckScopeValues`;
- `mtaStsModeValues`;
- `bulkItemOutcomeValues`;
- `dkimKeyGenerateRequestKeySizeValues`, for tests only (the UI uses `allowedKeySizes`).

## 2. App-defined models

These are not API shapes. Each is derived from API data, from capabilities or from app constants.

### DkimActions (`src/features/dns/permissions.ts`, FR-002)

`dkimActions(entry, role, caps)` returns a set of booleans. The unit test is table-driven over the
roles, the entry states (valid, missing, unused, incomplete) and the capability switches (export
and publication, on and off). It covers SC-006.

| Action | Condition |
|---|---|
| `copyRecord` | `entry.key?.record != null` |
| `generate` | `entry.state === 'missing'` and role is `admin` or `domainAdmin` |
| `replace` | `entry.key != null` and role `admin` |
| `importOverwrite` | `entry.key != null` and role `admin` |
| `copyKey` | `entry.key != null` and role `admin`; a valid or unused key that is incomplete answers `409`, so it is offered only when `entry.key.complete` |
| `delete` | `entry.key != null` and role `admin` |
| `export` | `entry.key != null`, role `admin` and `caps.dkim.privateKeyExportEnabled === true` |
| `exportOffNote` | `entry.key != null`, role `admin` and `privateKeyExportEnabled === false` |
| `publishAgain` | `entry.key?.record != null`, role `admin` and `caps.dkim.dnsPublicationEnabled` |
| `history` | role `admin` |
| `checkDns` | `entry.kind !== 'none'` |

List-level actions:
- `importFromList`: `admin`;
- `selectionGenerate`: `admin` or `domainAdmin`;
- `selectionDelete`: `admin`;
- `filterUnused` and `filterKindNone`: `admin`.

### RecordView (`src/features/dns/dkim/record.ts`, FR-016, FR-017)

| Field | Derivation |
|---|---|
| `name` | `key.record.name` |
| `hostLabel` | `` `${key.selector}._domainkey` `` |
| `value` | `key.record.value` |
| `split` | `` key.record.valueParts.map(p => `"${p}"`).join(' ') `` |
| `missingParts` | `key.missingParts`, translated with `dns.dkim.missingParts.<part>` |

### Display name (`src/shared/components/DomainName.vue`)

The readable form first, then the ASCII form below it when the two differ (`displayName !== name`
or `displayDomain !== domain`). Both are rendered as text with `overflow-wrap: anywhere`.

### Summary group (`src/features/dns/diagnostics/summary-groups.ts`, FR-060)

`summaryGroup(status, optional)` returns one of these groups:

| Group | Statuses |
|---|---|
| `ok` | `match` and `informational` |
| `needsAttention` | `mismatch`, and `missing` of a required check |
| `optionalNotSet` | `missing` of an optional check |
| `notVerified` | `lookupFailed` and `expectedUnknown` |

`statusLabelKey(status, optional)` gives `dns.diagnostics.status.<status>`, and
`dns.diagnostics.status.missingOptional` for an optional `missing`. `summarize(checks)` returns the
count per group plus the per-status totals, which a test compares with `result.summary`.

### Check label and message views (`check-labels.ts`, `check-messages.ts`)

- `checkLabel(check)` returns `{ key, params }` from the table in research R15. An unknown
  identifier gives `dns.diagnostics.checks.generic` with `{ type: recordType }`.
- `messageView(message)` returns `{ key, params, link?, englishFallback? }`.
  - `params` are formatted per R15.
  - `link` is the `url` parameter accepted by `safeHref`.
  - `englishFallback` is `message` when the code is not in `dnsCheckMessageCodeValues`.

### Diagnostics entry and rate-limit state

| Model | Fields | Where |
|---|---|---|
| `DiagnosticsEntry` | `result: DnsDiagnosticsResult`, `receivedAt: number` (epoch ms) | `['dns-diagnostics','result',name]` |
| `RateLimitState` | `limit: number`, `remaining: number`, `resetAt: number` (epoch ms) | `['dns-diagnostics','rate-limit']` |
| `ChangedMarker` | `changedAt: number` | `['dns-diagnostics','changed',name]`, set by key and policy mutations (R5) |

### Max age (`src/features/dns/mta-sts/max-age.ts`)

The model is `{ value: number; unit: 'week' | 'day' | 'hour' | 'minute' | 'second' }`.
`toLargestUnit(seconds)` picks the largest unit that divides exactly, and `toSeconds({value, unit})`
converts back. Both are formatted with `Intl.NumberFormat` `style: 'unit'`.

### MX host entry (`src/features/dns/mta-sts/mx-hosts.ts`)

Each entry is `{ input: string; ascii: string | null; error: RuleKey | null }`. `ascii` comes from
`new URL('http://' + host).hostname`, after trimming and removing one trailing dot.
`joinedLength(entries)` is the length of the ASCII forms joined by commas.
`dedupe(entries)` compares the entries case-insensitively and keeps the first spelling.

### Run item (`src/shared/composables/useSequentialRun.ts`)

Each item is `{ id: string; label: string; state: 'pending' | 'running' | 'done' | 'exists' |
'failed' | 'unknown' | 'notProcessed'; problem?: ApiProblem; publication?:
DkimDnsPublicationOutcome }`. The state machine is in §7.

## 3. Server-state cache

### Query keys

These are added to `src/api/query/keys.ts`.

| Key | Operation | staleTime | gcTime | Fetched when | Notes |
|---|---|---|---|---|---|
| `['dns-capabilities']` | `getDnsCapabilities` | 5 min | 5 min | any DNS screen or section | invalidated after `forbidden`, `dkim-private-key-export-disabled` and `dkim-dns-publication-disabled` (R4) |
| `['dkim-keys','list',DkimListParams]` | `listDkimKeys` | 30 s | 5 min | list page | `placeholderData: keepPreviousData` |
| `['dkim-keys','detail',name]` | `getDkimKey` | 30 s | 5 min | entry page, DKIM sections, import lookup | written by every key mutation |
| `['dkim-keys','copy-targets',{q}]` | `listDkimKeys` (`state=valid&state=missing`) | 30 s | 5 min | copy picker opens and on typing (300 ms debounce) | `useInfiniteQuery`, 25 per page |
| `['mta-sts-policies','list',MtaStsListParams]` | `listMtaStsPolicies` | 30 s | 5 min | policy list | `keepPreviousData` |
| `['mta-sts-policies','detail',domain]` | `getMtaStsPolicy` | 30 s | 5 min | domain page MTA-STS section | `404` means no policy |
| `['dns-diagnostics','result',name]` | `runDnsDiagnostics` | 10 min | 10 min | diagnostics page without a fresh result; "Run again" | `retry: false`; TanStack's signal not passed; own 45-s timeout (R14) |
| `['dns-diagnostics','rate-limit']` | — (written from response headers) | ∞ | 10 min | — | `RateLimitState` |
| `['dns-diagnostics','changed',name]` | — (written by mutations) | ∞ | 10 min | — | `ChangedMarker` |

`DkimListParams` and `MtaStsListParams` are aliases of
`NonNullable<operations['listDkimKeys' | 'listMtaStsPolicies']['parameters']['query']>`, not
hand-written shapes.

The "all names without a key" collection (R8) and the private key export are not cached.

### Invalidation after mutations

| Mutation | On success | On 412 | Other |
|---|---|---|---|
| `generateDkimKey` (new) | write `detail(name)` from `data`; invalidate `['dkim-keys','list']` and `['dkim-keys','copy-targets']`; set `changed(name)` | — | `409`: invalidate `detail(name)` (FR-028) |
| `generateDkimKey` (replace) | as above | refetch `detail(name)`; confirm again | — |
| `importDkimKey` (direct call) | write `detail(name)`; invalidate lists; set `changed(name)` | refetch `detail(name)`; confirm again | the private key never enters the cache |
| `copyDkimKey` | write `detail(target)`; invalidate lists; set `changed(target)` | target item `failed` with "changed elsewhere"; refetch the picker | — |
| `deleteDkimKey` | invalidate `detail(name)` (unused: remove it); invalidate lists; set `changed(name)` | refetch `detail(name)`; show the impact again | `404`: invalidate `detail(name)` |
| `applyDkimKeyBulkAction` | invalidate `detail(id)` of each `done` item; invalidate lists; set `changed(id)` | per item `outdated`: stays selected; the list refetch brings fresh tags | — |
| `publishDkimDnsRecord` | write `detail(name)` | refetch `detail(name)` | `403 dkim-dns-publication-disabled`: invalidate capabilities |
| `exportDkimPrivateKey` (direct call) | nothing is cached | — | `403 …export-disabled`: invalidate capabilities |
| `createMtaStsPolicy` | write `['mta-sts-policies','detail',domain]`; invalidate the list; set `changed(domain)` | — | `409`: refetch `detail(domain)` and switch to editing |
| `updateMtaStsPolicy` | write `detail(domain)`; invalidate the list; set `changed(domain)` when `policyId` or `active` changed | keep the input; refetch; mark changed values (`EditableSection`) | — |

## 4. Client state

- **Pinia**: no new store and no new field.
- **Device storage**: no new key. UI 001's unit test on allowed storage keys stays unchanged, and
  UI 010's end-to-end secret scan asserts it (SC-007).
- **Component-local secrets**:

  | State | Owner | Lifetime |
  |---|---|---|
  | Private key text of an import | `DkimImportPage` `ref<string>` | cleared after success, on leave (after confirmation) and on `pagehide`; kept after a refusal |
  | Exported private key | `OneTimeSecretDialog` `ref<string \| null>` | from the export response until the dialog closes |

  Neither is passed to a router location, query, mutation, store, `console` or storage.
- **Local UI state**:
  - the record form shown (single or split);
  - the diagnostics filter ("only attention");
  - the zone file panel expanded;
  - the selection mode and selection (`useBulkSelection`, cleared by `useListState` `onReset`);
  - the run state (`useSequentialRun`);
  - the highlighted `_mta-sts` record (until the route changes).

## 5. Route map

The base is `/ng/`. All routes are lazy, in the shell layout, and require an `active` session.

| Name | Path | Access (catalogue entry; page check) | Title key | Component |
|---|---|---|---|---|
| `dns` | `/dns` | redirect to `dkim-keys` | — | — |
| `dkim-keys` | `/dns/dkim-keys` | `dkimKeys` | `dns.dkim.title` | `features/dns/pages/DkimKeysPage.vue` |
| `dkim-import` | `/dns/dkim-import` | `dkimKeys`; administrators (else `NoAccessState`) | `dns.dkim.import.title` | `features/dns/pages/DkimImportPage.vue` |
| `dkim-key` | `/dns/dkim-keys/:dkimName` | `dkimKeys` | `dns.dkim.entry.title` | `features/dns/pages/DkimKeyPage.vue` |
| `dkim-copy` | `/dns/dkim-keys/:dkimName/copy` | `dkimKeys`; administrators | `dns.dkim.copy.title` | `features/dns/pages/DkimCopyPage.vue` |
| `mta-sts-policies` | `/dns/mta-sts-policies` | `mtaStsPolicies` | `dns.mtaSts.list.title` | `features/dns/pages/MtaStsPoliciesPage.vue` |
| `dns-diagnostics` | `/dns/diagnostics/:diagnosticsName` | `dkimKeys` | `dns.diagnostics.title` | `features/dns/pages/DnsDiagnosticsPage.vue` |

Rules:
- `:dkimName` and `:diagnosticsName` take the API's `name` (ASCII, or the exact stored spelling of
  an unused key). `names.ts` builds every location, and Vue Router percent-encodes it.
- `dkim-import` accepts `?name=<name>` to pre-fill the name (from an entry). The private key is
  never put in the address.
- The domain page's MTA-STS section is reached with UI 002's domain route and the hash `#mta-sts`.

### Address parameters of the lists (`useListState` schemas)

Defaults are omitted from the address, invalid values fall back to the default, and changing any
parameter except `page` resets `page` and the selection (conventions). The search is applied 300 ms
after typing stops.

**DKIM keys** (`/dns/dkim-keys`, FR-005–FR-012):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `state` | repeatable `valid`, `missing`, `unused` (≤ 3; `unused` admins only) | — | `state` (exploded) |
| `kind` | `domain`, `aliasDomain`, `none` (`none` admins only) | — | `kind` |
| `complete` | `true`, `false` | — | `complete` |
| `selector` | string ≤ 255 | — | `selector` |
| `domain` | string ≤ 255 | — | `domain` (the domain with its alias domains, FR-012) |
| `sort` | `name`, `state`, `selector`, `keyLength` | `name` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | `limit` |

A domain administrator's address with `state=unused` or `kind=none` is normalised away.

**MTA-STS policies** (`/dns/mta-sts-policies`, FR-054):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `active` | `true`, `false` | — | `active` |
| `mode` | `enforce`, `testing`, `none` | — | `mode` |
| `sort` | `domain`, `mode`, `maxAge`, `policyId` | `domain` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page`, `size` | as above | 1, 25 | `offset`, `limit` |

## 6. Client-side validation

These checks run before sending. Server field errors are always shown too (FR-072).
Capability-backed limits are read at runtime. Contract constants live in
`src/shared/validation/limits.ts`, whose unit test compares them with `contract/openapi.json`.

| Field | Rule | Source of the limit | Message key |
|---|---|---|---|
| Selector (generate, replace, import) | not empty; ≤ `selectorMaxLength`; `^[A-Za-z0-9._-]+$` | capabilities | `validation.required`, `validation.tooLong`, `validation.format.dkimSelector` |
| Key size | one of `allowedKeySizes`; default `defaultKeySize` | capabilities | `validation.notInList` |
| Import name | readable or ASCII domain name: labels of letters, digits and inner hyphens; ≤ 253 characters as ASCII; ≤ 63 per label (`domain-name.ts`) | spec FR-029 | `validation.format.domainName`, `validation.tooLong` |
| Private key | not empty; UTF-8 bytes ≤ `privateKeyMaxBytes` | capabilities | `validation.required`, `validation.tooLong` (`unit: bytes`) |
| Private key file | `file.size ≤ privateKeyMaxBytes` before reading | capabilities | `validation.tooLong` |
| Copy targets | at least one; never the source (not offered) | spec FR-034 | `validation.required` |
| Bulk deletion | ≤ `limits.dkimBulkTargets` (100, contract `maxItems`) | contract (plan gap 2) | `validation.tooMany` |
| Bulk deletion confirmation | the typed text equals the number of keys to delete | conventions | `dns.dkim.delete.bulk.typeCountMismatch` |
| MX hosts | ≥ 1 entry; each `domain-name.ts` with an optional `*.` prefix; duplicates (ignoring case) dropped; joined ASCII ≤ `mxMaxLength`, used length shown at ≥ 90 %; ≤ `limits.mtaStsMxHostsMax` (128) entries | capabilities, contract | `validation.required`, `validation.format.mxHost`, `validation.tooLong`, `validation.tooMany` |
| Max age | whole number ≥ 1 in its unit; `maxAgeMin ≤ seconds ≤ maxAgeMax` | capabilities | `validation.outOfRange` (limit in the chosen unit when exact) |
| Mode | one of `capabilities.mtaSts.modes` | capabilities | `validation.notInList` |
| List search, selector and domain filters | ≤ 255 characters (`limits.searchMax`) | contract | `validation.tooLong` |

## 7. State machines

### Generation and copy runs (`useSequentialRun`)

```text
idle ─start(items)→ running ─(each item: pending → running → done | exists | failed | unknown)→ finished
            │            │ stop() → current item finishes; remaining → notProcessed → finished
            │            │ route leave → confirm ─yes→ stop() ; ─no→ stays running
            └ finished ─retry(failed|unknown|notProcessed)→ running (only those items)
```

`unknown` (a network failure, or a non-problem 5xx) is never retried on its own. A manual retry of
a generation that did succeed returns `409`, which is reported as `exists`.

### Bulk deletion

```text
select mode → selection (current page) → Delete → BulkDeleteDialog (list, marked domains, skipped,
type the number) ─confirm→ sending ─200→ BulkResultSummary (done / notFound / refused / outdated /
failed; failed, refused and outdated stay selected; list refetched)
                                     └ network failure → "outcome unknown" for all; nothing resent
```

### Single deletion and replacement (versioned confirmation loop)

```text
confirm(impact from detail) ─yes→ sending ─204/200→ done (entry "Key missing", or list for unused)
                                        ├ 412 → refetch detail → confirm(fresh impact) …
                                        └ 404 → "no longer exists" → refetch
```

### Private key import

```text
empty ─type/paste/file→ entered ─submit→ (has key and overwrite? confirm) → sending
   ▲                       │ leave → confirm ─yes→ cleared → leave
   │                       │ pagehide → cleared
   │       sending ─201/200→ cleared → replace route with the entry (announce created/replaced, outcome)
   │               ─409 → entered (name error + "Switch on overwrite")
   │               ─422 → entered (field errors; key text kept)
   │               ─412 → refetch entry → confirm again
   └───────────────────── reload: nothing restored
```

### Private key export

```text
idle ─Export→ confirm ─yes→ requesting ─200→ shown(key) ─copy or download→ secured ─close→ idle (key cleared)
                                        │                  └ close (not secured) → confirm ─yes→ idle (cleared)
                                        ├ 403 export-disabled → message, capabilities refetched, action removed
                                        └ 404 / 503 → message
```

### Diagnostics run

```text
open page ─fresh result (< 10 min)?─yes→ shown(result, time) ─Run again→ running
           └no→ running ─200→ shown(result) + rate limit stored
                        ├ 45 s → timeout error (+ previous result if any)
                        ├ 429 → rate-limited(countdown; previous result kept; Run again disabled)
                        ├ 404 → not found page
                        └ network/5xx → error (+ previous result)
remaining = 0 and resetAt in the future → Run again disabled until resetAt (announced once)
```

### MTA-STS section

```text
loading ─404→ none ─Set up→ form(defaults) ─save→ creating ─201→ view (+ identifier notice)
        ─200→ view ─Edit→ form(values) ─save→ patching ─200→ view (+ notice if policyId changed)
                                              ├ 412 → form(input kept, changed values marked) …
                                              └ 422 → form(field errors)
              view ─Deactivate→ confirm ─yes→ patching {active:false} → view
              view ─Activate→ patching {active:true} → view (+ certificate and DNS notice)
```
