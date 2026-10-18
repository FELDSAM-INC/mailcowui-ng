# Contracts of UI feature 014

UI feature 014 adds no API of its own and requests no new mailcow-rest-v2 operation, apart from
one gap (SF, below). This file records the API operations it uses and the interfaces it exposes to
browsers, operators and other repositories.

## 1. Pinned mailcow-rest-v2 contract

UI 014 is implemented last. It uses the contract pin that the shipped UI features 001–013 have
reached together (`contract/VERSION.json`). UI 014 never bumps the contract itself, except to pick
up SF. The pin must contain the API features that the targets depend on:

- API 002 to 013;
- the reset page default of API 005 (`RESTV2_PW_RESET_PAGE=/ng/reset-password?token={token}`);
- the single sign-on tokens of API 007, accepted by both interfaces;
- the OAuth2 endpoints that API 012 keeps in the legacy container.

### Baseline commit (contract-pin rule)

`docs/conventions.md` ("Contract pins only move forward") requires each feature to check its own
operations against its plan's baseline commit.

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| Baseline commit | `e4f74adce7318ac5ced8f87ba8303cddf9c78e52` (2026-10-18, "Track UI-found API gaps and document audit detail keys") |
| Checked at the baseline | all seven operations below exist (`operationId` in `api/`), and `listSieveFilters` has no `id` parameter (gap SF is open) |
| Same gap in UI 005's plan | AG2 ("No read of a Sieve filter by its ID alone") |

UI 014 never moves the pin backward. At implementation, T001 confirms that `contract/VERSION.json`
pins this commit or a later one, and checks the seven operations against that pin again.

### Operations used

| Operation | Used by | Session | Why |
|---|---|---|---|
| `getAlias` | `classic-target` (M16, numeric value) | browser session | opens the alias by the classic ID |
| `listAliases` (`address` filter, `limit=1`) | `classic-target` (M16, address value) | browser session | finds the alias ID for a classic address (contract: "Find an alias by address with the `address` filter") |
| `getDomainTemplate` | `classic-target` (M21) | browser session | a domain template ID, checked first as in `edit.php`. A `404` means it is not a domain template |
| `getMailboxTemplate` | `classic-target` (M21) | browser session | a mailbox template ID |
| `listSieveFilters` with `id` (after SF) | `classic-target` (M31) | browser session | finds the filter's mailbox, then opens UI 005's `filter-detail`. Until SF is pinned, M31 goes to the `filters` list as a fallback |
| `getPublicConfig` | `ng-cutover apply` preflight (warning) | none | `announcement.active` and `text` (FR-023) |
| `getReadiness` | `ng-cutover apply` preflight | none | "the API answers" (FR-023) |

These are the only operations UI 014 adds. Everything else the arrival targets request belongs to
the delivering features. The operator tool is not the app: it calls the two anonymous operations
over plain HTTP. They are contract operations, so constitution I still holds.

### API gap SF: look up a Sieve filter by its ID

- **The need**: the classic address `/edit/filter/{id}` (M31) carries only the filter's ID. The
  pinned contract reaches a filter only through `/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}`,
  and `listSieveFilters` filters by `mailbox`, `kind`, `active` and `q`, but not by ID. Finding
  the mailbox would mean paging through every filter in scope, which is a workaround that
  constitution I forbids.
- **Registry**: mailcow-rest-v2 tracks UI-found gaps in `docs/api-gaps.md` (G1–G5 at the
  baseline). SF is to be added there as the next entry, with "Found by: UI 014" and "API feature:
  005". The local label SF is used until it has a number.
- **Proposed to mailcow-rest-v2, API feature 005**: add a repeatable `id` filter to
  `listSieveFilters` (`GET /sieve-filters?id=42`). It is additive, keeps the existing scope rules
  and returns the entry with its `mailbox`. A direct `GET /sieve-filters/{sieveFilterId}` would
  serve too.
- **Effect on UI 014**: until a pin contains SF, `classic-target` sends M31 to the `filters`
  list as a fallback arrival, which UI 005's plan expects. The plan's owner question 1 records
  this default and the alternative of waiting.

## 2. Interfaces this feature exposes

### 2.1 Classic address → arrival redirect (nginx-mailcow, HTTP)

| Aspect | Contract |
|---|---|
| Applies to | `GET` and `HEAD` requests on the public server blocks, local port ≠ `65510`, no classic pass, and a mapping row whose used-by set is fully switched on |
| Answer | `302 Found`. `Location: /ng/arrival/<row>[#<fragment>]` (relative, so the host and scheme are kept). `Cache-Control: no-store` |
| Fragment | `p=<raw path value>`, `q=<raw query value>`, `token=<raw>`, `sso_token=<raw>`, or `only_email=1` and/or `app_password=1` (data-model §2). Raw values match `carriedValueCharset` |
| Access record | an extra line `ngc_cutover <time> <host> <method> "<path>" <status> ngc_row=<row>`, with no query string. mailcow's `combined` line is unchanged |
| Everything else | unchanged: status, headers and body as before (FR-013, FR-015) |

The source of truth is `cutover/mapping.json`. The rules are in
`deploy/cutover/nginx/ng-cutover.conf` and `deploy/cutover/nginx/site.ng-cutover.custom`.

### 2.2 Arrival address (the app)

- **Address**: `/ng/arrival/<row>`, where `<row>` is one of M01–M33 or F1–F3, plus the fragment
  above.
- **Behaviour**:
  - the app replaces the address with the target route (data-model §5);
  - it shows the arrival notice;
  - an unknown row leads to the fallback start screen.
- **Who may link to it**: only the redirect. It is not a documented address for people or
  external systems.

### 2.3 Classic interface entry and exit (nginx-mailcow, HTTP)

| Request | Answer |
|---|---|
| `GET /classic` or `/classic?to=<unknown>` | `302 Location: /admin`, with `Set-Cookie: classic_pass=1; Path=/; Secure; HttpOnly; SameSite=Lax` and `Set-Cookie: classic_pass_8h=1; Max-Age=28800; Path=/; Secure; HttpOnly; SameSite=Lax`, and `Cache-Control: no-store` |
| `GET /classic?to=api-v1-keys` | the same, with `Location: /admin/system` |
| `GET /classic/exit` | `302 Location: /ng/`; both cookies with `Max-Age=0`; `Cache-Control: no-store` |

These addresses are documented in the runbook. The app links only to
`/classic?to=api-v1-keys` (`src/app/navigation/classic-links.ts`, CL07). New keys come only from
readiness register entries with the disposition `kept-classic`.

### 2.4 Release manifest (the app's image)

`GET /ng/release.json` answers with the JSON of data-model §7 and `Cache-Control: no-cache`.
Consumers:

- `ng-cutover apply` (preflight);
- `ng-cutover smoke`;
- operators.

Fields are only ever added. The schema number goes up only for breaking changes.

### 2.5 Operator CLI `ng-cutover` (mailcow host)

The CLI is distributed as `deploy/cutover/` and as the release asset
`mailcowui-ng-cutover-<version>.tar.gz`. It is installed to `$NG_CUTOVER_HOME` (default
`/opt/ng-cutover`). Global options:

- `--mailcow-dir <path>` (default: the current directory if it contains `mailcow.conf`);
- `--json`, for machine-readable output.

| Command | Effect | Exit codes |
|---|---|---|
| `install` | copies the rules and an all-off state file (if none exists) into `data/conf/nginx/`, runs `nginx -t` and reloads. On failure it removes what it added | 0 ok, 1 refused (switch on with a digest mismatch), 4 `nginx -t` failed (restored) |
| `apply <roles>` or `NG_CUTOVER_ROLES=<roles> apply` | `<roles>` is `none`, `all`, or a comma list of `admin`, `domainadmin` and `user`. The preflight runs when a role turns on. Then it writes the state, runs `nginx -t` and reloads | 0 applied, 1 refused by preflight (reasons printed), 2 usage, 4 `nginx -t` failed (restored, no reload) |
| `status [--probe]` | each role's state and last change, the installed digest and its verified releases. `--probe` adds the observed behaviour per role | 0; 5 when the probe disagrees with the state |
| `smoke [--record-baseline] [--host H]… [--mail-domain D] [--resolve H:PORT:ADDR] [--switches BITS]` | the cutover smoke test (research R12) | 0 pass, 1 fail, 3 fail with rollback recommended, 2 usage |
| `collect [--day YYYY-MM-DD] [--input FILE]` | writes `var/collected/<day>.json` | 0, 2 |
| `report [--days N] [--baseline-days N]` | the monitoring report (research R13) | 0 within thresholds, 1 thresholds exceeded or undocumented recurring addresses |
| `uninstall` | requires all roles off, then removes the three files with `nginx -t` and a reload | 0, 1 refused (a role is on), 4 |
| `version` | the tool's version and mapping digest | 0 |

### 2.6 Files on the mailcow host

| File | Format | Writer |
|---|---|---|
| `data/conf/nginx/ng-cutover.conf` | nginx `http` context, generated | `install` |
| `data/conf/nginx/site.ng-cutover.custom` | nginx `server` context, generated | `install` |
| `data/conf/nginx/ng-cutover-state.custom` | the state file of data-model §4 | `apply` (and `install` when it is missing) |
| `data/conf/nginx/ng-cutover-state.custom.bak` | the previous state | `apply` |

Each name is covered by mailcow's `.gitignore` (`*.conf`, `*.custom`, `*.bak`) and kept by
`update.sh`.

## 3. Coordination with mailcow-rest-v2

| Item | Repository | Status |
|---|---|---|
| SF: look up a Sieve filter by ID | mailcow-rest-v2, API feature 005 | **to be specified there first** (constitution I) |
| `/ng/` routing and the `ng-mailcow` upstream (`deploy/nginx/site.restv2.custom`) | mailcow-rest-v2 | relied on unchanged (API research R23) |
| `location = /ng { return 301 /ng/; }` | mailcow-rest-v2 | proposed by UI 001 (plan, API gap 2). Not needed by 014: every target is under `/ng/` |
| The reset page default `/ng/reset-password?token={token}` | mailcow-rest-v2, API 005 | relied on. Operators who set `RESTV2_PW_RESET_PAGE=/reset-password?token={token}` are covered by M03 |
