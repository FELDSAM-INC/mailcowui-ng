# Data Model: Cutover from the Classic Interface

**Feature**: `specs/014-cutover` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature adds no API data and no server storage. Its models are of four kinds:

- the authoritative mapping and the files generated from it;
- the nginx variables and the switch state on the mailcow host;
- the operator tool's files;
- a little client state in the app.

Decisions are justified in research.md and not repeated here.

## 1. Entities and where they live

| Entity (spec "Key Entities") | Representation | Location | Owner |
|---|---|---|---|
| Mapping row | `rows[]` entry | `cutover/mapping.json` | this repository |
| Exclusion row | `exclusions[]` entry | `cutover/mapping.json` | this repository |
| Cutover switch | three bits and a last-change time per role | `data/conf/nginx/ng-cutover-state.custom` on the mailcow host | operator, via `ng-cutover apply` |
| Classic pass | the cookies `classic_pass` and `classic_pass_8h` | browser | set by `/classic`, cleared by `/classic/exit` |
| Readiness register entry | `entries[]` entry | `cutover/readiness-register.json` | owner sign-off |
| Classic link register entry | `entries[]` entry | `cutover/classic-links.json` | this repository |
| Smoke test result | one JSON line per case | standard output; the baseline in `var/baseline-<host>.json` | operator tool |
| Monitoring report | daily aggregates and the report | `var/collected/<day>.json`, standard output | operator tool |
| Release manifest | JSON | `dist/release.json`, served at `/ng/release.json` | build |
| Arrival | in-memory state and device counters | app | app |

`var/` is the operator tool's own directory (`$NG_CUTOVER_HOME/var`, default
`/opt/ng-cutover/var`), outside the mailcow checkout.

## 2. Authoritative mapping (`cutover/mapping.json`)

`cutover/mapping.schema.json` (JSON Schema 2020-12) validates it. Its top-level fields are:

| Field | Type | Rule |
|---|---|---|
| `schema` | `1` | — |
| `verifiedAgainst` | array of `{ release, nginxImage, templates: { "nginx.conf.j2": sha256, "sites-default.conf.j2": sha256 } }` | at least one entry. The first is `2026-09a` with `ghcr.io/mailcow/nginx:1.30.4-1` (FR-030) |
| `carriedValueCharset` | `{ path: regex, query: regex }` | path: `^[A-Za-z0-9._~!$&'()*+,;=:@%-]+$` (RFC 3986 `pchar`, no `\`). Query: the path set plus `/` and `?` |
| `entryTargets` | array of `{ key, classicPath, registerEntry }` | `key` matches `^[a-z0-9-]{1,32}$`. The first entry is the default `{ "key": "default", "classicPath": "/admin" }`. Each other entry names a readiness register entry with disposition `kept-classic` |
| `rows` | array of **Row** | ids M01–M33 and F1–F3, each exactly once |
| `exclusions` | array of **Exclusion** | ids X01–X16, each exactly once |

**Row**:

| Field | Type | Rule |
|---|---|---|
| `id` | `^(M[0-3][0-9]\|F[1-3])$` | the spec's row id |
| `kind` | `exact` or `fallback` | `fallback` only for F1–F3 |
| `usedBy` | non-empty subset of `admin`, `domainadmin`, `user` | the spec's used-by set (FR-021) |
| `paths` | array of canonical paths, or `{ prefix }` for fallback families | the generator adds the `.php` form and the trailing-slash form (FR-007). Matching is case-sensitive |
| `editType` | string (M16–M32 only) | the `/edit/<type>/` segment and the `/edit.php?<type>=` key |
| `query` | `{ requires?: string[], forbids?: string[] }` | parameter keys, matched as keys with or without a value. `signInFlow` stands for FR-016's set |
| `hostKinds` | `["std"]` or `["std","ad"]` | M01 and M33 are `std` only (X14) |
| `carry` | `none`, `edit-value`, `token`, `sso_token` or `profile-flags` | what goes into the arrival fragment (research R3) |
| `decode` | `once` or `classic-address` | `classic-address` for M16, M17, M18 and M20 (`rawurldecode` and `html_entity_decode`, research R3) |
| `target` | **Target** | see §5 |
| `deliveredBy` | `'001'` … `'013'` | the delivering UI feature |
| `samples` | array of `{ request, value? }` | at least one per path form. The smoke test and the end-to-end tests use them |
| `precedence` | integer | the generator's regex order (research R2): guards, then token rows, then plain rows, then fallbacks |

**Exclusion**:

| Field | Type | Rule |
|---|---|---|
| `id` | `^X(0[1-9]\|1[0-6])$` | — |
| `kind` | `path`, `method`, `pass`, `host-root`, `internal` or `unmapped` | how it is guaranteed: by no row matching it, by the method guard, by the pass, by the host kind, by the include point, or by default |
| `samples` | array of `{ method?, request, host?, cookies? }` | X12 and X13 samples reuse row samples. X15 has none for the smoke test and is covered by the nginx tests |
| `reason` | string | from the spec |

### The mapping

The generator writes this table into `docs/cutover/mapping.md` (FR-029):

- the fragment column is what nginx writes after `/ng/arrival/<row>`;
- `{v}` is the raw carried value, checked against `carriedValueCharset`.

| Row | Classic address (plus `.php` and trailing-slash forms) | Query rule | Used by (A D U) | Arrival fragment | Target route (§5) |
|---|---|---|---|---|---|
| M01 | `/`, `/index.php` | forbids `signInFlow`, `mobileconfig`; host `std` | . . 1 | — | `home` |
| M02 | `/user` | — | . . 1 | — | `account` |
| M03 | `/reset-password` | requires `token` (value in charset) | . . 1 | `#token={v}` | `password-reset` with query `token` (UI 005 moves it to memory in `beforeEnter`) |
| M04 | `/reset-password` | otherwise | . . 1 | — | `password-reset-request` |
| M05 | `/admin`, `/admin/index.php` | forbids `signInFlow` | 1 . . | — | `sign-in-admin` |
| M06 | `/admin/dashboard`, `/debug` | — | 1 . . | — | `operations-dashboard` |
| M07 | `/admin/mailbox` | — | 1 . . | — | `domains` |
| M08 | `/admin/system` | — | 1 . . | — | `administrators` |
| M09 | `/admin/queue`, `/queue` | — | 1 . . | — | `operations-mail-queue` |
| M10 | `/domainadmin`, `/domainadmin/index.php` | forbids `signInFlow`, `sso_token` | . 1 . | — | `sign-in-domain-admin` |
| M11 | `/domainadmin/mailbox` | forbids `sso_token` | . 1 . | — | `domains` |
| M12 | `/domainadmin/user` | forbids `sso_token` | . 1 . | — | `account` |
| M13 | the paths of M10–M12 | requires `sso_token` (value in charset); on M10 paths also forbids `signInFlow` | . 1 . | `#sso_token={v}` | `sign-in-sso-token`; the token is handed over in memory, never in the address (research R3) |
| M14 | `/quarantine` | — | 1 1 1 | — | `quarantine` |
| M15 | `/mailbox` | — | 1 1 . | — | `domains` |
| M16 | `/edit/alias/{v}`, `/edit.php?alias={v}` | — | 1 1 . | `#p={v}` or `#q={v}` | resolver `alias`, then `alias-detail` |
| M17 | `/edit/aliasdomain/{v}` | — | 1 1 . | same | `alias-domain-detail` (`aliasDomain`) |
| M18 | `/edit/resource/{v}` | — | 1 1 . | same | `resource-detail` (`resourceAddress`) |
| M19 | `/edit/domain/{v}` | — | 1 1 . | same | `domain-detail` (`domain`) |
| M20 | `/edit/mailbox/{v}` | — | 1 1 . | same | `mailbox-overview` (`address`), the default child of `mailbox-detail` |
| M21 | `/edit/template/{v}` | — | 1 1 . | same | resolver `template`, then `domain-template-detail` or `mailbox-template-detail` (`templateId`) |
| M22 | `/edit/domainadmin/{v}` | — | 1 . . | same | `domain-admin-detail` (`username`) |
| M23 | `/edit/admin/{v}` | — | 1 . . | same | `admin-detail` (`username`) |
| M24 | `/edit/oauth2client/{v}` | — | 1 . . | same | `oauth2-client-detail` (`oauth2ClientId`) |
| M25 | `/edit/relayhost/{v}` | — | 1 . . | same | `routing-relayhost-edit` (`relayhostId`) |
| M26 | `/edit/transport/{v}` | — | 1 . . | same | `routing-transport-edit` (`transportId`) |
| M27 | `/edit/bcc/{v}` | — | 1 1 . | same | `routing-bcc-map-edit` (`bccMapId`) |
| M28 | `/edit/recipient_map/{v}` | — | 1 . . | same | `routing-recipient-map-edit` (`recipientMapId`) |
| M29 | `/edit/tls_policy_map/{v}` | — | 1 . . | same | `routing-tls-policy-map-edit` (`tlsPolicyMapId`) |
| M30 | `/edit/syncjob/{v}` | — | 1 1 1 | same | `sync-job-detail` (`syncJobId`) |
| M31 | `/edit/filter/{v}` | — | 1 1 . | same | resolver `sieve-filter`, then `filter-detail` (`mailbox`, `filterId`) once API gap SF is pinned; until then `filters` as a fallback arrival (plan owner question 1) |
| M32 | `/edit/app-passwd/{v}` | — | . . 1 | same | `account-app-password-detail` (`appPasswordId`) |
| M33 | `/`, `/index.php` | requires `mobileconfig`; forbids `signInFlow`; host `std` | . . 1 | `#only_email=1`, `#app_password=1`, both, or none | `account-mail-apps` with query `variant=email` (for `only_email`) and/or `appPassword=1` |
| F1 | prefix `/admin/` (not M05–M09) | — | 1 . . | — | `sign-in-admin`, fallback |
| F2 | prefix `/domainadmin/` (not M10–M13) | — | . 1 . | — | `sign-in-domain-admin`, fallback |
| F3 | prefix `/edit/`; `/edit.php` without a known type or with an empty value; any `/edit/` path whose raw value fails the charset or whose type is unknown | — | 1 1 1 | — | `home`, fallback |

**Notes on the mapping**:

- **M16–M32**, both forms:
  - The path form `/edit/<type>/<v>[/]` matches only when the normalised `$uri` and the raw
    `$request_uri` both have exactly one value segment. The query form `/edit.php?<type>=<v>`
    follows `edit.php`'s order of checks (research R18).
  - A path-form value fills `#p=`. A query-form value fills `#q=`, which the app form-decodes, so
    `+` becomes a space.
- **"Start" targets** (M01, M05, M10, F1–F3) name the sign-in screen. UI 001's guard sends a session
  that is already signed in to `home` (spec "Route Mapping": "Start means the app's home screen when
  signed in").
- **Parameters that are not carried**, such as `lang`, `duallogin` and unknown keys, are dropped
  (FR-006).

## 3. nginx decision variables

All variables are generated into `ng-cutover.conf` and use the prefix `ngc_`. Maps combine only
safe tokens (row ids and bits), never raw strings. Raw values reach only `$ngc_target`.

| Variable | Map source | Values | Purpose |
|---|---|---|---|
| `$ngc_switches` | constant `ngc`, with `include …/ng-cutover-stat[e].custom` | `000`–`111` (default `000`) | the cutover switch: administrators, domain administrators, mailbox users |
| `$ngc_pass` | `$cookie_classic_pass$cookie_classic_pass_8h` | `1` only for `11`, else `0` | the classic pass (X13, FR-031) |
| `$ngc_host_kind` | `$host` | `ad` (`^(autodiscover\|autoconfig)\.`) or `std` | X14 |
| `$ngc_flow` | `$args` | `1` when `oauth`, `iam_sso`, `cancel_tfa_login` or `cancel_tfa_setup` is a key, or both `code` and `state` are keys; else `0` | FR-016 |
| `$ngc_path_row` | `$uri` (normalised) | a path class such as `ROOT`, `USER`, `RESET`, `M05`–`M09`, `DA_ROOT`, `DA_MAILBOX`, `DA_USER`, `M14`, `M15`, `EDIT:<type>`, `EDITPHP`, `F1`, `F2`, `F3`, or empty | the row family from the path |
| `$ngc_raw_type`, `$ngc_pv` | `$request_uri` | the raw edit type, and the raw value as a named capture, when the raw path is canonical and the value is in the charset | carried path-form value |
| `$ngc_query_kind`, `$ngc_qv`, `$ngc_token`, `$ngc_sso`, `$ngc_flags` | `$args` | the `edit.php` type and value in the classic order, the `token` and `sso_token` values (charset checked), and the `mobileconfig`, `only_email` and `app_password` flags | carried query values |
| `$ngc_row` | `"$ngc_host_kind:$ngc_flow:$ngc_path_row:$ngc_raw_type:$ngc_query_kind:$ngc_flags"` | a row id or empty | FR-004, FR-012, FR-013, FR-016, FR-017 |
| `$ngc_carry` | `"$ngc_path_row:$ngc_query_kind"` | `p` for the path form of M16–M32, `q` for the query form, else empty | chooses `#p=` or `#q=` |
| `$ngc_row_on` | `"$ngc_row:$ngc_switches"` | `1` when every role of the used-by set is on | FR-021 |
| `$ngc_redirect` | `"$request_method:$ngc_pass:$server_port:$ngc_row_on"` | `1` only for `GET` or `HEAD`, no pass, a port other than `65510`, and the row on | FR-008, X12, X13, X15 |
| `$ngc_target` | `"$ngc_row:$ngc_carry"` | `/ng/arrival/<row>` with the fragment of §2 | FR-004, FR-006 |
| `$ngc_cache_control` | `$ngc_redirect` | `no-store` or empty (no header) | FR-005 |
| `$ngc_entry_target` | `$arg_to` | an `entryTargets[].classicPath`, default `/admin` | FR-032 |

The server snippet `site.ng-cutover.custom` contains, in this order:

1. `add_header Cache-Control $ngc_cache_control always;`
2. `access_log /var/log/nginx/access.log ngc_cutover if=$ngc_redirect;`
3. `if ($ngc_redirect) { return 302 $ngc_target; }`
4. `location = /classic { … }`, which sets both cookies, sends `no-store` and answers
   `return 302 $ngc_entry_target;`
5. `location = /classic/exit { … }`, which expires both cookies and answers `return 302 /ng/;`

Both files start with `# mapping-digest: sha256:<hex>` and `# generated by
scripts/cutover/generate.mjs; do not edit`.

## 4. Switch state and the operator tool's files

### State file (`data/conf/nginx/ng-cutover-state.custom`)

```text
# ng-cutover state, schema 1. Written by `ng-cutover apply`; do not edit by hand.
# admin on 2026-11-02T08:00:00Z
# domainadmin off 2026-10-30T10:00:00Z
# user off never
ngc "100";
```

- **Format**: the bit order is administrators, domain administrators, mailbox users. The last line
  is the only line nginx reads.
- **Writes**: `apply` writes the file atomically (temporary file and `mv`) and keeps
  `ng-cutover-state.custom.bak`.
- **Missing file**: means `000`, all off (research R5).

**Switch state transitions**, per role:

```text
off ──apply (role in setting) + preflight OK──▶ on
off ──apply (role in setting) + preflight fails──▶ off (refused; reasons printed; nothing written)
on  ──apply (role not in setting)──▶ off        (never refused; no preflight)
any ──nginx -t fails──▶ previous state restored; no reload; error printed
```

The last-change time changes only when the role's state changes. Running `apply` with the same
setting again rewrites nothing.

### Tool directory (`$NG_CUTOVER_HOME`)

| Path | Content |
|---|---|
| `bin/ng-cutover` | the CLI (bash) |
| `lib/*.mjs` | the zero-dependency Node modules: `preflight`, `smoke`, `collect`, `report`, `http`, `mapping` |
| `nginx/ng-cutover.conf`, `nginx/site.ng-cutover.custom` | the generated rules that `install` copies |
| `data/smoke-cases.json` | the generated smoke cases |
| `data/mapping.json` | a copy of `cutover/mapping.json`, for the digest and the documentation |
| `var/baseline-<host>.json` | the off-state baseline: `{ recordedAt, mappingDigest, mailcowRelease, result, cases: [{ id, host, method, request, status, contentType, location }] }` |
| `var/history.log` | one line per `apply`: time, previous bits, new bits, outcome |
| `var/collected/<day>.json` | the daily aggregates (§10) |
| `var/address-notes.json` | `{ "<normalised address>": { "kind": "mapped-request" \| "expected" \| "noise", "note": string } }` |

## 5. Target route contract (requirements on UI 001–013)

The mapping names targets by **route name**. Paths belong to the delivering features, whose plans
fix them (spec "Route Mapping"). The unit test `tests/unit/features/cutover/targets.spec.ts`
resolves every target against the real router with its sample parameters. If a shipped feature
uses another name, task T014 updates `cutover/mapping.json`. If a shipped feature lacks an
addressable screen for the object, 014 adds the route to that feature's `routes.ts`, opening the
feature's existing view for the object (conventions "Where features meet").

| Route name | Path (under `/ng/`) | Params and query | Delivered by, plan reference | Classic form |
|---|---|---|---|---|
| `home`, `sign-in-admin`, `sign-in-domain-admin` | `/`, `/sign-in/admin`, `/sign-in/domain-admin` | — | 001, data-model §5 | — |
| `account` | `/account` | — | 005, data-model | — |
| `password-reset` | `/reset-password` | query `token` (or `#token`), moved to memory in `beforeEnter`, then removed | 005 (`src/features/auth/routes.ts`); the path is fixed by API 005's `RESTV2_PW_RESET_PAGE` | the reset token |
| `password-reset-request` | `/reset-password/request` | — | 005 | — |
| `account-mail-apps` | `/account/mail-apps` | query `variant` (`email`, `emailAndDav`) and `appPassword=1`, preselection only, removed after reading | 005 (`src/features/account/routes.ts`, `pages/MailAppsPage.vue`) | `only_email` becomes `variant=email`; `app_password` becomes `appPassword=1` (FR-050) |
| `account-app-password-detail` | `/account/app-passwords/:appPasswordId(\d+)` | integer | 005 | the classic ID; the mailbox is the user's own |
| `filter-detail` | `/filters/:mailbox/:filterId(\d+)` | mailbox address, integer | 005 (`src/features/filters/routes.ts`) | needs the mailbox, so the resolver needs API gap SF (UI 005 plan, gap AG2) |
| `filters` | `/filters` | list state | 005 | the interim target of M31 |
| `operations-dashboard`, `operations-mail-queue` | `/operations/dashboard`, `/operations/mail-queue` | — | 011 (`src/features/operations/routes.ts`) | — |
| `domains` | `/domains` | — | 002 (`src/features/domains/routes.ts`) | — |
| `domain-detail` | `/domains/:domain` | domain | 002 | ASCII or Unicode, any case; the page replaces it with the ASCII name |
| `domain-template-detail` | `/domain-templates/:templateId(\d+)` | integer | 002 | through the resolver |
| `mailbox-overview` | `/mailboxes/:address([^/]+@[^/]+)` (child `''` of `mailbox-detail`) | address | 003 (`src/features/mailboxes/routes.ts`) | any case, Unicode domain; the page replaces it with the canonical address |
| `mailbox-template-detail` | `/mailbox-templates/:templateId(\d+)` | integer | 003 | through the resolver |
| `alias-detail` | `/aliases/:aliasId(\d+)` | integer | 004 (`src/features/aliases/routes.ts`) | numeric ID only; an address goes through the resolver |
| `alias-domain-detail` | `/alias-domains/:aliasDomain` | domain | 004 (`src/features/alias-domains/routes.ts`) | ASCII or Unicode; canonicalised to ASCII |
| `resource-detail` | `/resources/:resourceAddress([^/]+@[^/]+)` | address | 004 (`src/features/resources/routes.ts`) | the address |
| `quarantine` | `/quarantine` | — | 006 (`src/features/quarantine/routes.ts`) | — |
| `administrators` | `/administrators` (redirects to the domain administrators list) | — | 007 (`src/features/administrators/routes.ts`) | — |
| `admin-detail`, `domain-admin-detail` | `/administrators/admins/:username`, `/administrators/domain-admins/:username` | username `[A-Za-z0-9._-]{1,255}` | 007 | the username |
| `sign-in-sso-token` | `/sign-in/sso-token` | query `sso_token`, but captured by `captureSsoToken()` in `src/main.ts` **only on a page load** of that path | 007 (`src/features/auth/routes.ts`) | the token is handed over in memory through the auth feature's public API (research R3) |
| `sync-job-detail` | `/sync-jobs/:syncJobId([1-9][0-9]{0,9})` | integer | 008 (`src/features/sync-jobs/routes.ts`) | the classic ID, one route for all three roles |
| `routing-relayhost-edit`, `routing-transport-edit`, `routing-bcc-map-edit`, `routing-recipient-map-edit`, `routing-tls-policy-map-edit` | `/routing/relayhosts/:relayhostId`, `/routing/transports/:transportId`, `/routing/bcc-maps/:bccMapId`, `/routing/recipient-maps/:recipientMapId`, `/routing/tls-policy-maps/:tlsPolicyMapId` | integer | 009 (`src/features/routing/routes.ts`) | the classic ID |
| `oauth2-client-detail` | `/identity-providers/oauth2-apps/:oauth2ClientId(\d{1,10})` | integer | 012 (`src/features/identity-providers/routes.ts`) | the classic ID |

These names and paths come from the UI 002–013 plans as of 2026-10-18. T014 compares them with
the shipped routers and updates `cutover/mapping.json` where a name changed.

Every target screen shows its own "not found" or "no access" state for an unknown or out-of-scope
identifier, with a way to the list (FR-010, UI 001 FR-045).

### Routes added by this feature (`src/features/cutover/routes.ts`)

| Name | Path | Layout | Access | Component |
|---|---|---|---|---|
| `arrival` | `/arrival/:row(M[0-3][0-9]\|F[1-3])` | none (renders nothing visible while it resolves) | any session state, with UI 001's marker for that access (the one its `not-found` route uses) | `pages/ArrivalPage.vue` |
| `classic-target` | `/from-classic/:kind(alias\|template\|sieve-filter)/:value` | shell | `active` | `pages/ClassicTargetPage.vue` |

- `classic-target` resolves through contract operations (research R3). It uses
  `replace` to reach the detail route, or shows the target feature's not-found state.
- `returnTo` accepts both routes, because they are in-app addresses. The arrival route is reached
  before sign-in, so it is never itself a `returnTo` value.

## 6. App client state

### Arrival state (`src/features/cutover/arrival-state.ts`, in memory)

| Field | Type | Rule |
|---|---|---|
| `kind` | `'exact' \| 'fallback' \| null` | set by `ArrivalPage`. `null` on a direct visit |
| `row` | row id or `null` | for the e2e assertions and the notice's fallback sentence |
| `targetPath` | string or `null` | the resolved full path. The notice hides once the user navigates to a route other than the sign-in steps or this path |
| `visible` | boolean | false after "Close" or "Don't show again" |

### Device storage (extends UI 001 data-model §4; every call in `try/catch`)

| Storage | Key | Value | Purpose |
|---|---|---|---|
| `localStorage` | `mailcowui-ng.arrival-notice-visits` | `'0'`–`'3'` | the visits on which the notice was shown (FR-042) |
| `localStorage` | `mailcowui-ng.arrival-notice-dismissed` | `'1'` | "Don't show again" (FR-042) |
| `sessionStorage` | `mailcowui-ng.arrival-notice-counted` | `'1'` | count at most one visit per tab session |

- **Exact arrivals**: the notice is shown when it is not dismissed and the visit count is below 3.
- **Fallback arrivals**: the fallback sentence is always shown. The general part of the notice
  follows the same rule as an exact arrival.
- **What is never stored**: tokens, identifiers and addresses. UI 001's storage allowlist test is
  extended with exactly these three keys.

### Arrival notice states

```text
direct visit ─────────────────────────────▶ hidden
arrival(exact), not dismissed, visits<3 ──▶ shown (count once per tab session) ──Close──▶ hidden (this visit)
                                                                           └─Don't show again─▶ hidden (device)
arrival(exact), dismissed or visits≥3 ───▶ hidden
arrival(fallback) ───────────────────────▶ shown with the fallback sentence (general part as for exact)
```

## 7. Release manifest (`/ng/release.json`)

```json
{
  "schema": 1,
  "version": "1.0.0",
  "commit": "<40 hex>",
  "builtAt": "2026-12-01T10:00:00Z",
  "cutoverReady": true,
  "mappingDigest": "sha256:<64 hex>",
  "mappingVerifiedAgainst": ["2026-09a"]
}
```

- **Writer**: `scripts/cutover/release-manifest.mjs`, after `vite build`.
- **`cutoverReady`**: `process.env.CUTOVER_READY === '1'`. The release workflow sets it only after
  `cutover-gates` passes (research R8).
- **Serving**: the image sends `Cache-Control: no-cache` for this file.

## 8. Readiness register (`cutover/readiness-register.json`)

| Field | Type | Rule |
|---|---|---|
| `schema` | `1` | — |
| `entries[].id` | `^RR[0-9]{3,4}$` | unique |
| `entries[].source` | string | a key derived by `scripts/cutover/readiness.mjs` (research R9), each covered exactly once; or `014#<row>` for a deviation of the mapping that the owner must accept (initially `014#M31` while API gap SF is open, disposition `changed`) |
| `entries[].legacy` | string | the legacy screen or action, quoted from the source row |
| `entries[].deliveredBy` | `'001'` … `'013'` or `null` | `null` only for `kept-classic` |
| `entries[].disposition` | `matched`, `improved`, `changed`, `dropped` or `kept-classic` | exactly one (FR-002) |
| `entries[].appScreen` | route name | required for `matched`, `improved` and `changed`. Checked against the router by the gate test |
| `entries[].reason` | string | required for `changed` and `dropped` |
| `entries[].ownerAcceptance` | `{ by, date }` | required for `dropped` |
| `entries[].classicAccess` | `{ entryTarget, note }` | required for `kept-classic`. `entryTarget` is one of `mapping.json → entryTargets[].key` |
| `entries[].proposed` | boolean | set by `--scaffold`. Any `true` fails the check |
| `signOff` | `{ owner, date, appVersion, entriesDigest }` or `null` | `entriesDigest` is the SHA-256 of the canonical `entries` array. A mismatch voids the sign-off |

The initial entries are the `changed` entry `014#M31` ("`/edit/filter/{id}` arrives on the Filters list until API gap SF is pinned", removed once it is) and the `kept-classic` entry "API keys for `/api/v1` (configuration › Access ›
Administrators › API)", with `entryTarget: "api-v1-keys"` (spec clarification 5).

## 9. Classic link register (`cutover/classic-links.json`)

| Field | Type | Rule |
|---|---|---|
| `entries[].id` | `^CL[0-9]{2,3}$` | unique |
| `entries[].place` | `{ file, component?, requirement }` | for example `src/features/api-keys/pages/ApiKeysPage.vue`, `014 FR-035` |
| `entries[].classicTarget` | string | the address linked |
| `entries[].roles` | subset of `admin`, `domainadmin`, `user` | who sees the link |
| `entries[].disposition` | `removed`, `replaced`, `kept-entry` or `kept-excluded` | in the cutover-ready mode, only `kept-*` may still match a find of the scan |
| `entries[].replacedBy` | string | required for `replaced`, for example `005 FR-034` |
| `entries[].exclusion` | `X01`–`X16` | required for `kept-excluded` |

The initial entries CL01–CL10 are listed in research R9.

## 10. Smoke test and monitoring records

**Smoke case** (`deploy/cutover/data/smoke-cases.json`, generated):

```json
{ "id": "M20.path", "rowOrExclusion": "M20", "method": "GET", "request": "/edit/mailbox/smoke%40example.invalid",
  "hostKind": "std", "cookies": null, "usedBy": ["admin","domainadmin"],
  "whenOn": { "status": 302, "location": "/ng/arrival/M20#p=smoke%40example.invalid", "cacheControl": "no-store" } }
```

**Smoke result line** (`--json`):

```json
{ "case": "M20.path", "host": "mail.example.org", "switches": "110", "expected": { "status": 302, "location": "…" },
  "actual": { "status": 302, "location": "…", "contentType": null, "cacheControl": "no-store" }, "pass": true }
```

The final line is `{ "result": "pass" | "fail", "rollbackRecommended": boolean, "mailcowRelease": "2026-09a",
"verified": boolean }`.

**Daily aggregate** (`var/collected/<day>.json`):

```json
{ "day": "2026-11-03", "source": "docker-logs" | "file",
  "notFound": { "/foo/bar?x=…": 4 }, "fallback": { "F1": { "/admin/old-page": 2 } },
  "redirects": { "M20": 37, "M14": 12 }, "notFoundClassicTotal": 41 }
```

The report compares `notFoundClassicTotal` with the baseline days' average and flags `> 1.05 ×`
(SC-008). It lists the fallback addresses seen on at least 3 days that are not documented in
`address-notes.json` (FR-047).
