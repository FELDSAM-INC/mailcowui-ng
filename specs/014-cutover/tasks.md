---
description: "Task list for UI feature 014: cutover from the classic interface"
---

# Tasks: Cutover from the Classic Interface

**Input**: Design documents from `specs/014-cutover/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:

- plan.md, spec.md, research.md, data-model.md and contracts/ are complete.
- **UI 014 is implemented last.** No task starts before T001 confirms the entry conditions of
  plan.md "Dependencies and order":
  - UI 001–013 are released and deployed with their API releases;
  - the pinned contract contains API 001–013;
  - the target routes exist or are reconciled.

**Tests**: mandatory (constitution VI). In every phase, tests are written first and must fail
before the implementation tasks that follow them.

- **End-to-end specs** run on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`.
  Each calls UI 001's `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every state it
  reaches, and fails on CSP or mock contract violations (UI 001 fixtures).
- **nginx tests** (`npm run test:nginx`) run the real mailcow nginx image of every
  `verifiedAgainst` release.
- **Test titles** name their spec reference: `US1-AS6 …`, `FR-016 …`, `X14 …`, `Edge: …`.

**Organization**: tasks are grouped by user story (spec priorities: US1–US3 at P1, US4–US6 at P2).
US1, US2 and US3 together are the minimum installable increment. US1 alone must never be installed
on a real host, because it lacks the exclusion guards of US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US6)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the entry conditions, then scaffold directories, scripts, vendored upstream
templates, schemas, the nginx harness and CI (research R11, R15).

- [ ] T001 Verify the entry conditions of plan.md "Dependencies and order", read-only:
  - every row of `src/app/navigation/catalogue.ts` has `status: 'available'`;
  - `contract/VERSION.json` pins mailcow-rest-v2 commit `e4f74adce7318ac5ced8f87ba8303cddf9c78e52`
    (the plan's baseline) or a later one, never an earlier one (conventions: pins only move forward), and
    the pin contains API 002–013 and the seven operations of contracts/README.md §1;
  - whether `listSieveFilters` in `contract/openapi.json` has an `id` parameter (gap SF).

  Record the findings in the commit message of T002. If SF is missing, raise it in mailcow-rest-v2
  as contracts/README.md §3 describes, including an entry in its `docs/api-gaps.md`. Only row M31's resolver (T026) waits for it.
- [ ] T002 Create the directories `cutover/`, `deploy/cutover/{bin,lib,nginx,data}/`, `docs/cutover/`, `scripts/cutover/`, `src/features/cutover/{pages,components}/`, `tests/unit/cutover/`, `tests/unit/features/cutover/`, `tests/e2e/cutover/` and `tests/nginx/`. Add these npm scripts to `package.json`:
  - `cutover:generate` (`node scripts/cutover/generate.mjs`);
  - `cutover:check` (`node scripts/cutover/check.mjs`);
  - `cutover:readiness` (`node scripts/cutover/readiness.mjs`);
  - `cutover:classic-links` (`node scripts/cutover/classic-links-scan.mjs`);
  - `cutover:gates` (`node scripts/cutover/gates.mjs`);
  - `test:nginx` (`vitest run --config vitest.nginx.config.ts`).

  Change `build` to `vite build && node scripts/cutover/release-manifest.mjs`.
- [ ] T003 [P] Write `scripts/cutover/vendor-nginx-templates.sh <tag>` (research R15). It reads `$MAILCOW_REPO` (default `../mailhosting`) and runs `git show <tag>:data/conf/nginx/templates/nginx.conf.j2` and `…/sites-default.conf.j2`. It writes them to `tests/nginx/upstream/<tag>/templates/` with `SHA256SUMS`, and prints the `nginx-mailcow` image of `git show <tag>:docker-compose.yml`. Run it for `2026-09a`. The expected image is `ghcr.io/mailcow/nginx:1.30.4-1`.
- [ ] T004 [P] Create the JSON Schemas (2020-12) `cutover/mapping.schema.json`, `cutover/readiness-register.schema.json` and `cutover/classic-links.schema.json` with every field and rule of data-model.md §2, §8 and §9. Quote these rules verbatim:
  - row ids `^(M[0-3][0-9]|F[1-3])$` and exclusion ids `^X(0[1-9]|1[0-6])$`;
  - `usedBy` is a non-empty subset of `admin`, `domainadmin`, `user`;
  - `carry` is one of `none`, `edit-value`, `token`, `sso_token`, `profile-flags`;
  - `decode` is `once` or `classic-address`;
  - `entryTargets[].key` matches `^[a-z0-9-]{1,32}$`;
  - the register disposition is exactly one of `matched`, `improved`, `changed`, `dropped`, `kept-classic`;
  - the link disposition is one of `removed`, `replaced`, `kept-entry`, `kept-excluded`;
  - `RR` ids match `^RR[0-9]{3,4}$` and `CL` ids `^CL[0-9]{2,3}$`.
- [ ] T005 [P] Create the nginx harness:
  - `tests/nginx/compose.yaml`, with these services:
    - `nginx-mailcow`: `ghcr.io/mailcow/nginx:1.30.4-1` pinned by digest. Environment: `MAILCOW_HOSTNAME=mail.example.test`, `ADDITIONAL_SERVER_NAMES=webmail.example.test`, `HTTPS_PORT=8443`, `HTTP_PORT=8080`, `ENABLE_IPV6=false`, `SKIP_SOGO=n`, `SKIP_RSPAMD=n`, `PHPFPMHOST=php-fpm-mailcow`, `SOGOHOST=sogo-stub`, `RSPAMDHOST=rspamd-stub`. It mounts `tests/nginx/fixtures/mailcow/data/conf/nginx` at `/etc/nginx/conf.d`, the stub web root at `/web` and generated certificates at `/etc/ssl/mail`, and publishes `127.0.0.1:${NGC_HARNESS_PORT:-18443}:8443`;
    - `php-fpm-mailcow`: `php:8.4-fpm-alpine`, with pools on 9001 and 9002, the docroot `/web`, and the network alias `phpfpm`, because the baseline template's 9082 server hard-codes `fastcgi_pass phpfpm:9001` and nginx resolves it at start;
    - `restv2-mailcow`: a php-fpm stub on 9000 serving `/app/public/index.php`;
    - `ng-mailcow`: `nginxinc/nginx-unprivileged:1.28-alpine` serving `tests/nginx/fixtures/ng` under `/ng/`;
    - `sogo-stub` and `rspamd-stub`: busybox `httpd` on 20000 and 11334.
  - `tests/nginx/global-setup.ts`: generate a self-signed certificate (`alpine` plus `openssl`) into a temporary directory, copy the vendored templates of each `verifiedAgainst` release into `fixtures/mailcow/data/conf/nginx/templates/`, write `fixtures/ng/release.ready.json` and `release.not-ready.json` with the mapping digest of the generated rules, run `compose up -d --wait`, and tear down at the end.
  - `vitest.nginx.config.ts`: node environment, `fileParallelism: false`, 120 s hooks.
  - `scripts/cutover/harness.sh up|down`.
  - `tests/nginx/helpers.ts`: install or remove the generated files in the fixture mailcow directory, write the state bits and reload, send requests with a chosen Host, SNI, method and cookies without following redirects, and read the nginx-mailcow logs.
  - `tests/nginx/.gitignore`: `*.active`, generated certificates, `ng-cutover*` copies.
- [ ] T006 [P] Create the harness fixtures:
  - `tests/nginx/fixtures/web/`: a PHP stub for every classic script of data-model.md §2 and the exclusions. Each answers with a fixture status, content type and header `X-Stub: <script>?<query>`, including `index.php` answering `404` on `autodiscover.` and `autoconfig.` hosts and `mobileconfig.php` answering `302 Location: index.php?mobileconfig[&only_email][&app_password]` when signed out. Add the static files of X10, including `lang/lang.en-gb.json` and `lang/lang.sk-sk.json` served as `application/json`;
  - `tests/nginx/fixtures/api/public/index.php`: `GET /api/v2/health/ready`, `/health/live` and `/public-config`, with the announcement switchable through a fixture file;
  - `tests/nginx/fixtures/ng/`: `index.html` and `release.json` (a copy of one of the two variants that `global-setup.ts` writes with the current digest);
  - `tests/nginx/fixtures/mailcow/`: `mailcow.conf` with the harness host names and ports, `data/web/inc/app_info.inc.php` with `$MAILCOW_GIT_VERSION="2026-09a";`, `data/conf/nginx/` containing only `site.restv2.custom` copied from mailcow-rest-v2's `deploy/nginx/`, and `docker-compose.yml` pointing to `tests/nginx/compose.yaml` for the CLI's Compose detection.
- [ ] T007 [P] Extend `.github/workflows/ci.yml` (UI 001 R28) with these jobs:
  - `cutover` (needs `quality`): `npm run cutover:check`, `npm run cutover:readiness -- --allow-unsigned`, `npm run cutover:classic-links` and `shellcheck deploy/cutover/bin/ng-cutover scripts/cutover/*.sh`;
  - `nginx` (needs `build`): `npm run test:nginx`, uploading `docker compose logs` on failure;
  - `cutover-gates` (on tags `v*` and `workflow_dispatch`): `npm run cutover:gates`.

  `cutover` and `nginx` are merge gates.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The authoritative mapping, the generator's base pipeline (switches, rows, targets,
`no-store`, access record), the route contract and the arrival parsing that every story uses
(research R2, R3, R11; data-model §2, §3, §5).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Legacy form map (constitution IV 1.3.0)

- [ ] T007a Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it. For this feature the map lists the arrival notice, arrival page and API keys note strings (none mirrors a classic form), any legacy key reused for them (for example `admin.loading`), and the `/lang/…` exclusion.

### Tests for the foundation (write first; must fail)

- [ ] T008 [P] Write `tests/unit/cutover/mapping.spec.ts`. It checks:
  - `cutover/mapping.json` validates against the schema;
  - ids M01–M33, F1–F3 and X01–X16 each occur exactly once;
  - each row's `usedBy` equals the spec's "Route Mapping" table, transcribed as a fixture in the test;
  - `carry` and `decode` per row as data-model.md §2 lists them (M16, M17, M18 and M20 use `classic-address`);
  - every exact row has a sample for its canonical, `.php` and trailing-slash forms, and M16–M32 have a query-form sample too;
  - `precedence` orders guards, then token rows (M13 < M10–M12, M03 < M04, M33 < M01), then plain rows, then fallbacks;
  - `verifiedAgainst[0]` is `2026-09a`, with template checksums equal to `tests/nginx/upstream/2026-09a/templates/SHA256SUMS`;
  - `entryTargets` contains `default → /admin` and `api-v1-keys → /admin/system`;
  - every sample value matches `carriedValueCharset`.
- [ ] T009 [P] Write `tests/unit/cutover/generate.spec.ts` for the base pipeline. It checks:
  - two runs give byte-identical output;
  - both nginx files start with `# mapping-digest: sha256:<hex>`, equal to the SHA-256 of the canonical mapping JSON (sorted keys);
  - the `map ngc $ngc_switches` block has `default "000"` and the wildcard include `ng-cutover-stat[e].custom`;
  - one `$ngc_row_on` regex per row, requiring a `1` bit for each role of the used-by set (M14 `111`, M16 `11.`, M02 `..1`);
  - `$ngc_target` yields `/ng/arrival/<row>` plus the fragment of data-model.md §2, with `$ngc_pv` and `$ngc_qv` for M16–M32;
  - raw values are captured only in maps over `$request_uri` or `$args`, and no `return` or map value references `$uri`;
  - the server snippet contains exactly `add_header Cache-Control $ngc_cache_control always;`, the `access_log … ngc_cutover if=$ngc_redirect;` line and `if ($ngc_redirect) { return 302 $ngc_target; }`;
  - `log_format ngc_cutover` contains `"$uri"` and `ngc_row=$ngc_row`, and neither `$args` nor `$request_uri`;
  - `deploy/cutover/data/smoke-cases.json` has one case per sample, with `whenOn` as in data-model.md §10;
  - `docs/cutover/mapping.md` contains every row.
- [ ] T010 [P] Write `tests/unit/features/cutover/fragment.spec.ts` and `tests/unit/features/cutover/classic-decode.spec.ts`:
  - `parseArrivalFragment(rawHash, carry)` splits `p=`, `q=`, `token=` and `sso_token=` at the first `=` only (a raw `&` stays in a `p` value), and parses `only_email=1&app_password=1` as flags. An empty or unknown fragment gives no value;
  - path decoding keeps `+`, query decoding turns `+` into a space, and malformed `%zz` is kept literally, as PHP's `rawurldecode` does;
  - `decodeAsClassic(v, 'classic-address')` applies one more tolerant `rawurldecode` and then entity decoding (`%2540example.org` → `@example.org`, `&#64;` → `@`, `&amp;` → `&`) through an inert `DOMParser` document. A `<script>` text is returned as text and never executed or inserted.
- [ ] T011 [P] Write `tests/unit/features/cutover/targets.spec.ts`. With the real router of `src/app/router/index.ts` on memory history, every `rows[].target.route` of `cutover/mapping.json` satisfies `router.hasRoute(name)`, and `router.resolve` with the row's sample parameters gives a path under the base without `/arrival/`. The resolver routes `classic-target` with `alias`, `template` and `sieve-filter` resolve too.
- [ ] T012 [P] Write `tests/nginx/install-neutral.spec.ts`. With the generated rules copied into the harness and the state `ngc "000";`:
  - `nginx -t` passes;
  - every smoke case of `deploy/cutover/data/smoke-cases.json` gets the same status, content type, `Location` and `X-Stub` as with the files removed;
  - removing `ng-cutover-state.custom` and reloading still passes `nginx -t` and behaves as `000` (research R5);
  - `/classic` and `/classic/exit` are left out of this comparison until US4.

### Core implementation

- [ ] T013 Write `cutover/mapping.json` (data-model.md §2):
  - the top-level fields, with `verifiedAgainst[0]` from T003;
  - all 36 rows, with `paths`, `editType`, `query`, `hostKinds`, `carry`, `decode`, `target` (route names of data-model.md §5), `deliveredBy`, `precedence` and samples. Sample values include `john%40example.org`, `%40example.org` (catch-all), `john%2Btag%40example.org`, `7`, `xn--bcher-kva.example` and a numeric ID per ID row;
  - all 16 exclusions with the samples listed in research R12, plus `/administrator` and `/ngc-smoke-unknown` for X16, and `/lang/lang.en-gb.json` and `/lang/lang.sk-sk.json` for X10 (the app loads these at runtime, constitution IV 1.3.0).
- [ ] T014 Reconcile the target route contract with the shipped routers (data-model.md §5):
  1. The names, paths and parameters in data-model.md §5 come from the UI 002–013 plans. For each target route that the shipped router lacks or names differently, either correct `cutover/mapping.json`, or add the route to the delivering feature's `routes.ts`, opening that feature's existing view for the object.
  2. List each change in the commit message.
  3. T011 must pass. While SF is open, `filter-detail` is checked only for existence, because M31 resolves to `filters`.
- [ ] T015 Implement `scripts/cutover/generate.mjs` and `scripts/cutover/check.mjs` for the base pipeline of data-model.md §3. The generator handles:
  - the switches map with the wildcard state include;
  - `$ngc_path_row` from `$uri`, with the `.php` and trailing-slash forms added per path;
  - `$ngc_raw_type` and `$ngc_pv` from `$request_uri` (canonical one-segment form, path charset);
  - `$ngc_query_kind`, `$ngc_qv`, `$ngc_token`, `$ngc_sso` and `$ngc_flags` from `$args`, with `edit.php`'s order for the query form (research R18);
  - `$ngc_row`, which combines only those tokens;
  - `$ngc_row_on`;
  - `$ngc_redirect`, from `$ngc_row_on` only at this stage;
  - `$ngc_target`;
  - `$ngc_cache_control`;
  - `log_format ngc_cutover`.

  It escapes nginx-significant characters in regexes and writes `deploy/cutover/nginx/ng-cutover.conf`, `deploy/cutover/nginx/site.ng-cutover.custom`, `deploy/cutover/data/smoke-cases.json`, `deploy/cutover/data/mapping.json` and `docs/cutover/mapping.md`. `check.mjs` regenerates into a temporary directory and fails on any difference.
- [ ] T016 [P] Implement `src/features/cutover/fragment.ts`, `src/features/cutover/classic-decode.ts` and `src/features/cutover/mapping.ts` (a typed read-only view of `cutover/mapping.json`'s rows: `id`, `kind`, `carry`, `decode` and `target`, imported as JSON so that it lands in the lazy arrival chunk).
- [ ] T017 Run `npm run cutover:generate` and commit the generated `deploy/cutover/nginx/ng-cutover.conf`, `deploy/cutover/nginx/site.ng-cutover.custom`, `deploy/cutover/data/smoke-cases.json`, `deploy/cutover/data/mapping.json` and `docs/cutover/mapping.md`. T008–T012 pass.

**Checkpoint**: The mapping, the generated rules and the route contract are in place, and an
installed rule set with every switch off changes nothing.

---

## Phase 3: User Story 1 - Classic bookmarks and links open the matching screen of the app (Priority: P1) 🎯 MVP part 1

**Goal**: With cutover on, every mapped classic address, including the fallback families,
redirects to `/ng/arrival/<row>`. The app then opens the documented screen for the identifier,
through sign-in when needed.

**Independent Test**: In the harness with every switch on, request each row on both host names
and follow the redirect in the app (mock API). The documented screen opens for the identifier,
signed out and signed in, on 360 px and desktop (spec US1 "Independent Test").

### Tests for User Story 1 (write first; must fail)

- [ ] T018 [P] [US1] Write `tests/nginx/redirects.spec.ts`. For each state `000`, `100`, `010`, `001`, `110` and `111`, on `mail.example.test` and `webmail.example.test`, every row sample in each form answers as follows:
  - when its used-by set is on: `302`, the relative `Location` exactly as in `smoke-cases.json`, and `Cache-Control: no-store`. Otherwise the off-state answer;
  - `HEAD` behaves like `GET`;
  - the `ngc_cutover` access line names the row and contains no query string;
  - **fallbacks**: F1 for `/admin/old-page`, F2 for `/domainadmin/nothing`, F3 for `/edit/unknown/42`, `/edit/mailbox/a%2Fb`, `/edit//mailbox/x`, `/edit/mailbox/` (empty value) and `/edit.php?nothing=1`;
  - **trailing slash**: `/edit/mailbox/x/` is M20 (FR-007);
  - **removed addresses** (US1-AS10): `/debug`, `/queue` and `/mailbox` give M06, M09 and M15;
  - **values**: `/reset-password?token=<value with a raw backslash>` falls to M04;
  - **query-form precedence**: `/edit.php?mailbox=a@b&alias=7` gives M16;
  - **dropped parameters** (FR-006): `?lang=cs` and `?duallogin=x` never appear in `Location`;
  - **case-sensitive matching** (FR-007): `/Admin/queue`, `/USER` and `/Edit/mailbox/x` are never redirected and keep their off-state answers.
- [ ] T019 [P] [US1] Write `tests/unit/features/cutover/resolve-arrival.spec.ts`, table-driven over every row of `cutover/mapping.json`. `resolveArrival(row, rawHash)` returns:
  - for the start rows: M01, F3 → `{ name: 'home' }`; M05, F1 → `{ name: 'sign-in-admin' }`; M10, F2 → `{ name: 'sign-in-domain-admin' }`;
  - for M20: `{ name: 'mailbox-overview', params: { address: 'john+tag@example.org' } }` from `p=john%2Btag%40example.org`, and `'john tag@example.org'` from `q=john+tag%40example.org`;
  - for M06 and M09: `{ name: 'operations-dashboard' }` and `{ name: 'operations-mail-queue' }`; for M23: `{ name: 'admin-detail', params: { username } }`; for M25–M29: the `routing-*-edit` routes with their numeric parameter; for M32: `{ name: 'account-app-password-detail', params: { appPasswordId } }`;
  - for M16: `{ name: 'classic-target', params: { kind: 'alias', value } }`;
  - for M03: `{ name: 'password-reset', query: { token } }`;
  - for M13: `{ name: 'sign-in-sso-token' }` with no token in the location, plus a hand-over of the token to the auth feature's memory holder (research R3);
  - for M33: `{ name: 'account-mail-apps', query: { variant: 'email', appPassword: '1' } }` for both flags, no `variant` without `only_email`, an empty query for none, and never a download (FR-050);
  - `kind: 'fallback'` for F1–F3 and for an unknown row such as `M99` (start screen);
  - no token and no value is kept in the returned arrival state.
- [ ] T020 [P] [US1] Write `tests/unit/features/cutover/ClassicTargetPage.spec.ts`, with the operations mocked through UI 001's contract-validated MSW handlers:
  - **alias** `7`: `getAlias` and a `replace` to `alias-detail`;
  - **alias** `john@example.org`: `listAliases` with `address`, then a `replace`. An empty result shows UI 004's alias not-found state with a way to the list;
  - **template** `12`: `getDomainTemplate` `200` leads to `domain-template-detail`. A `404` leads to `getMailboxTemplate`, which leads to `mailbox-template-detail`. Both `404` show the domain templates not-found state;
  - **`403`**: the no-access state (UI 001 FR-045);
  - **network failure or `5xx`**: UI 001's error state with a retry, and no `replace`;
  - **sieve-filter**: while SF is not pinned, a `replace` to `filters` and the arrival marked as a fallback (plan owner question 1). Once pinned, `listSieveFilters` with `id` and a `replace` to `filter-detail` with the filter's `mailbox` and `filterId`; an empty result shows the filters not-found state.
- [ ] T021 [P] [US1] Extend `tests/unit/app/router/guards.spec.ts` and `tests/unit/app/router/return-to.spec.ts`:
  - the `arrival` route is reachable in every session state (anonymous, pending second factor, restricted, active) without a guard redirect;
  - `returnTo=/from-classic/alias/7` is accepted;
  - a signed-in session that opens `sign-in-admin` is sent to `home`, which the spec's "Start" semantics need.
- [ ] T022 [P] [US1] Add `tests/mocks/scenarios/cutover.ts`, registered in `tests/mocks/scenarios/index.ts`. It holds contract-valid fixtures for the sample identifiers:
  - the mailbox `john@example.org` and `john+tag@example.org`;
  - the alias with ID 7 and the catch-all `@example.org`;
  - the domain template 12 and the mailbox template 13;
  - a sync job, a relayhost, a transport, a BCC map, a recipient map, a TLS policy map and an OAuth2 client;
  - the domain administrator `reseller` and the administrator `admin`;
  - an app password of `alice@example.org`.
- [ ] T023 [P] [US1] Write `tests/e2e/cutover/arrival-targets.spec.ts`. It is table-driven from the row samples and opens `/ng/arrival/<row>#<fragment>` as the redirect produces it:
  - **signed out**: the row's sign-in screen, then after sign-in the documented target with the identifier (FR-045, SC-005);
  - **signed in** as a role of the used-by set: the target directly;
  - the address bar never shows `/arrival/` or the fragment afterwards (FR-014);
  - **acceptance scenarios**:
    - US1-AS1, mailbox detail;
    - US1-AS2, mail queue after administrator sign-in;
    - US1-AS3, My account;
    - US1-AS4, reset screen with the token gone from the address;
    - US1-AS5, the one-time sign-in landing with the token, which never appears in the address bar, in history or in any request URL;
    - US1-AS6, fallback start;
    - US1-AS8, the mailbox not-found state for a deleted mailbox;
    - US1-AS9, a mailbox user on M08 sees "no access";
    - US1-AS10, M06 and M09;
  - **edge cases**: the catch-all alias `%40example.org` and `+` in an address;
  - the M33 profile options are preselected and nothing downloads until the user starts it (FR-050);
  - axe runs on every target.
- [ ] T024 [P] [US1] Write `tests/unit/features/auth/sso-token-handover.spec.ts` for the auth feature's token hand-over (research R3, M13): the exported function stores the token in the same memory holder that `captureSsoToken()` fills, `SsoTokenLandingPage` consumes it as a captured token (ask first with a session, exchange only when visible, UI 007 FR-059, FR-060), and the token is never written to the address, history or device storage. Skip the parts that UI 007's own tests already cover.

### Implementation for User Story 1

- [ ] T025 [US1] Implement `src/features/cutover/resolve-arrival.ts` (research R3; data-model.md §2, §5) and `src/features/cutover/arrival-state.ts` with `kind`, `row`, `targetPath` and `visible` (data-model.md §6). The device counters come in T063.
- [ ] T026 [US1] Implement `src/features/cutover/api.ts` (query functions for `getAlias`, `listAliases` with `address` and `limit=1`, `getDomainTemplate`, `getMailboxTemplate`, and `listSieveFilters` with `id` once SF is pinned; until then the `sieve-filter` kind replaces itself with `filters` as a fallback arrival) and `src/features/cutover/pages/ClassicTargetPage.vue`. The page shows a loading state, `router.replace` to the detail route, the target feature's not-found or no-access component (exported through that feature's `index.ts`), or UI 001's error state with a retry.
- [ ] T027 [US1] Implement `src/features/cutover/pages/ArrivalPage.vue`:
  1. read `window.location.hash` raw, once, on setup;
  2. set the arrival state;
  3. `router.replace(resolveArrival(…))`;
  4. render only an accessible loading text while resolving.

  It requests no data.
- [ ] T028 [US1] Implement `src/features/cutover/routes.ts` (`arrival` with `/arrival/:row(M[0-3][0-9]|F[1-3])` and UI 001's any-session-state marker, the one its `not-found` route uses; UI 005, 007 and 012 plans name it differently, so use whatever the shipped guard reads; `classic-target` with `/from-classic/:kind(alias|template|sieve-filter)/:value`, the shell layout and access `active`, data-model.md §5) and `src/features/cutover/index.ts`. Register `cutoverRoutes` in `src/app/router/routes.ts`. Allow `arrival` in every session state in `src/app/router/guards.ts`.
- [ ] T029 [US1] Export the token hand-over function from `src/features/auth/index.ts`, writing to the memory holder of `captureSsoToken()`, unless UI 007 already exports one. Call it from `ArrivalPage.vue` for M13 before `router.replace`. UI 005 already reads `variant` and `appPassword` on `account-mail-apps` as preselection only (UI 005 data-model), so M33 needs no change there.
- [ ] T030 [US1] Run `npm run cutover:generate` and commit the regenerated files under `deploy/cutover/` and `docs/cutover/mapping.md`. T018–T024 pass.

**Checkpoint**: Every mapped address arrives on its screen in the harness and in the app. Exclusion
guards are still missing, so this must not be installed on a real host.

---

## Phase 4: User Story 2 - Everything that must stay in the classic interface keeps working (Priority: P1) MVP part 2

**Goal**: Exclusions X01–X16 answer exactly as before in every switch state. This covers methods
other than `GET` and `HEAD`, sign-in flows, `autodiscover.` and `autoconfig.` roots, the internal
listener and the internal servers.

**Independent Test**: Record the off-state answers of every exclusion, switch all roles on, and
compare. Then run the runbook's end-to-end checks (spec US2 "Independent Test").

### Tests for User Story 2 (write first; must fail)

- [ ] T031 [P] [US2] Write `tests/nginx/exclusions.spec.ts`. In every switch state, every exclusion sample matches the off-state answer (status, content type, `Location` and `X-Stub`). It covers:
  - X01, `/ng/` and `/api/v2/` through `site.restv2.custom`;
  - X02–X07 and X09–X11. For X10 this includes `/lang/lang.en-gb.json` and `/lang/lang.sk-sk.json`, which answer `200` with `application/json` in every switch state and for every role's session or classic pass, never a redirect (constitution IV 1.3.0: the app loads them at runtime);
  - **X08**: `/?oauth`, `/?iam_sso`, `/?code=1&state=2`, `/?state=2&code=1`, `/?cancel_tfa_login`, `/admin?cancel_tfa_setup`, `/domainadmin/?cancel_tfa_login`, `/index.php?oauth` and `/domainadmin?sso_token=abc&cancel_tfa_login`;
  - **X12**: `POST`, `PUT`, `DELETE` and `OPTIONS` to M01, M05, M14 and M20, never redirected (US2-AS8);
  - **X14**: `/` and `/?mobileconfig` with `Host: autodiscover.example.test` and `autoconfig.example.test` answer `404` (US2-AS9);
  - **X15**: `nginx -T` shows `site.ng-cutover.custom` only in server blocks listening on `8443` or `8080`, never in those on `8081`, `9081` or `9082`. Requests from inside the container to `http://127.0.0.1:8081/`, `:9081/` and `https://127.0.0.1:9082/` and to `http://127.0.0.1:65510/sogo-auth` and `http://127.0.0.1:65510/edit/mailbox/x@y` are never redirected;
  - **X16**: `/administrator`, `/ngc-smoke-unknown` and `/classicx`;
  - `/.well-known/caldav` keeps its `301` to `/SOGo/dav/`.
- [ ] T032 [P] [US2] Extend `tests/unit/cutover/generate.spec.ts` with the guard maps:
  - `$ngc_flow` contains the key set of FR-016 and the PCRE look-ahead for `code` and `state`;
  - `$ngc_host_kind` matches `^(autodiscover|autoconfig)\.`;
  - rows with `hostKinds: ["std"]` (M01, M33) and the `signInFlow` rule (M01, M05, M10, M13 on M10 paths) are guarded in `$ngc_row`;
  - `$ngc_redirect` is keyed on `"$request_method:$ngc_pass:$server_port:$ngc_row_on"` and matches only `GET` and `HEAD`, port ≠ `65510`.

### Implementation for User Story 2

- [ ] T033 [US2] Add the guards to `scripts/cutover/generate.mjs`:
  - the `$ngc_flow` and `$ngc_host_kind` maps;
  - the `signInFlow` and `hostKinds` handling in `$ngc_row`;
  - the method and port terms of `$ngc_redirect`.

  The pass term reads `$ngc_pass`, defined as constant `0` until T053. Run `npm run cutover:generate`. T031 and T032 pass.
- [ ] T034 [US2] Create `docs/cutover/runbook.md`, starting with the section "What stays in the classic interface". It lists X01–X16 with their reasons, and gives the end-to-end checks of SC-002 as numbered steps: mail client autoconfiguration (Autodiscover XML and Thunderbird autoconfig), an `/api/v1/get/status/version` read with a key and without, a webmail sign-in, an ActiveSync sync, a quarantine quick release from an old notification, and an OAuth2 sign-in with a test application, including a second factor and the notes of research R17.

**Checkpoint**: Redirects and exclusions are complete in nginx.

---

## Phase 5: User Story 3 - The operator switches cutover on per role and rolls it back (Priority: P1) MVP part 3

**Goal**: The CLI installs, applies, reports and uninstalls. Turning a role on is refused unless
the deployed app is cutover-ready with the same mapping and the app and the API answer. Rollback is
always possible and loses nothing.

**Independent Test**: In the harness, apply each switch combination, run the smoke cases after
each, roll back, and check that every classic address answers as in the baseline (spec US3
"Independent Test"). The data and session checks run in quickstart Part D.

### Tests for User Story 3 (write first; must fail)

- [ ] T035 [P] [US3] Write `tests/unit/cutover/preflight.spec.ts` for `deploy/cutover/lib/preflight.mjs`, against an in-process `node:https` server. It covers:
  - **refusals**, each with its reason (FR-023, FR-001):
    - `release.json` missing, not JSON, `cutoverReady` false, or a `mappingDigest` different from the installed rules header;
    - `/ng/` not `200 text/html`;
    - `/api/v2/health/ready` not `200`;
    - a baseline file missing, failed, recorded with another digest, or missing for one configured host;
  - **warnings**:
    - `announcement.active` false or `text` null;
    - `MAILCOW_GIT_VERSION` not in `verifiedAgainst`;
    - a setting that skips the order administrators, then domain administrators, then mailbox users;
  - **no checks** when the setting turns roles only off.
- [ ] T036 [P] [US3] Write `tests/unit/cutover/release-manifest.spec.ts`. `scripts/cutover/release-manifest.mjs` writes `dist/release.json` with `schema`, `version` from `package.json`, `commit` (from `GITHUB_SHA` or `git rev-parse HEAD`), `builtAt`, `cutoverReady` (`true` only for `CUTOVER_READY=1`), `mappingDigest` equal to the generator's digest, and `mappingVerifiedAgainst` (data-model.md §7).
- [ ] T037 [P] [US3] Write `tests/unit/cutover/readiness.spec.ts` with fixture specs and registers in `tests/unit/cutover/fixtures/readiness/`. It covers:
  - **key derivation** from the "Legacy Parity" tables, including sub-headings and multiple tables, and from the inventory bullets (research R9);
  - **failures**:
    - an uncovered key and a duplicate cover;
    - an orphan entry;
    - a disposition outside the list;
    - `proposed: true`;
    - `dropped` without `ownerAcceptance` or `reason`;
    - `kept-classic` without a valid `entryTarget`;
    - `appScreen` naming a route that does not exist;
    - a "Deferred" parity status without a delivering entry;
    - a stale `signOff.entriesDigest`;
  - `--allow-unsigned` accepts a missing sign-off and nothing else;
  - `--scaffold` proposes dispositions from the parity statuses;
  - `--render` writes the Markdown view.
- [ ] T038 [US3] Write `tests/nginx/cli.spec.ts`. It runs `deploy/cutover/bin/ng-cutover --mailcow-dir tests/nginx/fixtures/mailcow` with `NG_CUTOVER_COMPOSE` pointing at the harness, and covers:
  - **install**: copies three files and leaves the state at `000`;
  - **apply refused**: `apply admin` with `release.not-ready.json` is refused with the reason, and the state file and nginx behaviour are unchanged (US3-AS1);
  - **apply**: `apply admin` with `release.ready.json` and a passing baseline fixture (written into the tool's `var/` with the current mapping digest, because the smoke tool arrives in US6) writes `ngc "100";` with a timestamp, and `/admin` redirects within 60 s while `/domainadmin`, `/` and `/quarantine` stay classic (US3-AS2);
  - **no restart** (FR-022): the nginx-mailcow container's start time and every other harness container's start time are unchanged after `install`, `apply` and `uninstall`;
  - `apply all` redirects `/quarantine` and `/edit/syncjob/7` (US3-AS3);
  - **rollback**: `apply none` with the API stub stopped and `ng-cutover` given no network is never refused, and everything is classic again (US3-AS4);
  - `status` and `--json` print each role, its state and last change; `status --probe` reports the observed behaviour, and exits `5` after the state file is edited without a reload (US3-AS8);
  - **restore**: an injected invalid rules file makes `apply` exit `4`, restore the previous state and not reload;
  - **idempotence**: a repeated `apply` with the same setting leaves the timestamps unchanged;
  - **uninstall**: refused while a role is on. After `apply none`, it removes the snippet first and `/api/v2/` and `/ng/` keep answering;
  - **durability** (FR-027): the state survives `compose restart nginx-mailcow`;
  - **no interruption** (US3-AS7, SC-003): a long request held open on the ActiveSync stub completes across an `apply`.
- [ ] T039 [P] [US3] Add the image check to the CI `image` job in `.github/workflows/ci.yml` (UI 001 R28): `GET /ng/release.json` answers `200` with `Cache-Control: no-cache` and `cutoverReady: false` for a default build.

### Implementation for User Story 3

- [ ] T040 [US3] Implement `deploy/cutover/lib/http.mjs` (`node:https` and `node:http` requests with `lookup` and `servername` for `--resolve`, redirects not followed, timeouts, `rejectUnauthorized` toggled per request) and `deploy/cutover/lib/mapping.mjs` (loads `data/mapping.json` and the installed rules header digest).
- [ ] T041 [US3] Implement `deploy/cutover/lib/preflight.mjs`, with checks, reasons, warnings and exit codes as in research R5. It writes JSON when given `--json`.
- [ ] T042 [US3] Implement `deploy/cutover/bin/ng-cutover`:
  - **commands**: `install`, `apply`, `status [--probe]`, `uninstall` and `version` (contracts/README.md §2.5);
  - **Compose detection**: `docker compose`, then `docker-compose`, overridable with `NG_CUTOVER_COMPOSE`;
  - **configuration**: reads `mailcow.conf` and `data/web/inc/app_info.inc.php`;
  - **Node runner**: the host's Node 22+, otherwise `docker run --rm --network host node:24-alpine@sha256:…`;
  - **apply**: writes the state through a temporary file and `mv`, keeping `.bak`; runs `nginx -t`, restores on failure, then `nginx -s reload`; appends to `var/history.log`;
  - every message names "the classic interface". The script passes `shellcheck`.
- [ ] T043 [US3] Implement `scripts/cutover/release-manifest.mjs`. Add `ARG CUTOVER_READY=0` and its environment variable to the build stage of `docker/Dockerfile`. Add `location = /ng/release.json { add_header Cache-Control "no-cache" always; … }`, with the security headers include, to `docker/nginx/default.conf`.
- [ ] T044 [US3] Implement `scripts/cutover/readiness.mjs`, with validation, `--allow-unsigned`, `--scaffold` and `--render` to `docs/cutover/readiness-register.md`. Create `cutover/readiness-register.json` with the `changed` entry `014#M31` (while SF is open) and the `kept-classic` entry "API keys for `/api/v1` (configuration › Access › Administrators › API)" (`entryTarget: "api-v1-keys"`), `deliveredBy: null` and `signOff: null` (data-model.md §8).
- [ ] T045 [US3] Implement `scripts/cutover/gates.mjs`. It runs the five gates of research R8:
  1. no `placeholder` catalogue entry and no `PlaceholderPage` route, by running `tests/unit/features/cutover/no-placeholders.spec.ts` (written in T052);
  2. the readiness register is signed (`readiness.mjs` without `--allow-unsigned`);
  3. the classic links are clean (`classic-links-scan.mjs --cutover-ready`);
  4. `tests/unit/features/cutover/targets.spec.ts` passes;
  5. `tests/e2e/cutover/classic-link-crawl.spec.ts` passes.

  It prints each gate and exits non-zero on any failure, including a gate whose test does not exist yet. Add `CUTOVER_READY` handling to the release workflow `.github/workflows/release.yml`, creating it if UI 001–013 have not: the image build gets `CUTOVER_READY=1` only when `cutover-gates` passed in the same run, and the release notes get the line "Cutover-ready: yes" (FR-003).
- [ ] T046 [US3] Add the runbook sections "Switching roles", "Status" and "Rollback" to `docs/cutover/runbook.md`:
  - `NG_CUTOVER_ROLES` and `ng-cutover apply`;
  - the recommended order;
  - the shared-address note (`/quarantine` and `/edit/syncjob/…` wait for all roles);
  - status and `--probe`;
  - rollback with `apply none` and partial rollback;
  - the emergency rollback without the tool (`ngc "000";` or deleting the state file, then `docker compose exec nginx-mailcow nginx -s reload`, research R14);
  - what users see after a rollback.

**Checkpoint**: US1, US2 and US3 form the minimum installable cutover. It can switch per role,
refuse unsafe changes and roll back.

---

## Phase 6: User Story 4 - Administrators still reach what only the classic interface offers, and the app shows no stale classic links (Priority: P2)

**Goal**: The classic interface entry and pass work. The API keys screen links to the classic
`/api/v1` key management for administrators. The release contains no placeholder and no link to a
redirected classic address.

**Independent Test**: With every switch on, an administrator follows the API keys note, signs in
to the classic interface and stays there. The rendered-link crawl and the static scan find nothing
forbidden (spec US4 "Independent Test").

### Tests for User Story 4 (write first; must fail)

- [ ] T047 [P] [US4] Write `tests/nginx/entry.spec.ts`:
  - `GET /classic`, `/classic?to=unknown` and `/classic?to=../../x` answer `302 Location: /admin`, and `/classic?to=api-v1-keys` answers `/admin/system`. Each sets exactly `classic_pass=1; Path=/; Secure; HttpOnly; SameSite=Lax` and `classic_pass_8h=1; Max-Age=28800; Path=/; Secure; HttpOnly; SameSite=Lax`, with `Cache-Control: no-store` (US4-AS2, US4-AS5);
  - with both cookies, no row or fallback redirects in state `111`;
  - with only one cookie, every row redirects (FR-033);
  - `/ng/` and `/api/v2/` are unaffected by the pass;
  - `/classic/exit` answers `302 /ng/` and expires both cookies (US4-AS3).
- [ ] T048 [P] [US4] Extend `tests/unit/cutover/generate.spec.ts`:
  - the pass map is `"$cookie_classic_pass$cookie_classic_pass_8h"` with `"11" 1; default 0;`;
  - `$ngc_entry_target` is generated from `entryTargets`, with `/admin` as the default;
  - the exact locations `= /classic` and `= /classic/exit` exist;
  - no entry target lies outside `entryTargets`.
- [ ] T049 [P] [US4] Write `tests/unit/features/cutover/ClassicApiKeysNote.spec.ts`:
  - the text says that keys for the classic API (`/api/v1`) are managed in the classic interface, which has its own sign-in (FR-035);
  - the link's `href` is `/classic?to=api-v1-keys`, from `classic-links.ts`, and it is a plain anchor, not a `RouterLink`;
  - the note renders only for the `admin` role;
  - the label is a new string present in en-gb, cs-cz and sk-sk, and another mailcow language (for example de-de) shows the English text.
- [ ] T050 [P] [US4] Write `tests/e2e/cutover/api-keys-note.spec.ts`:
  - US4-AS1: the note is in the API keys screen's related area, with axe and no horizontal scrolling at 360 px;
  - US4-AS4: a domain administrator and a mailbox user see no link to the entry anywhere they can navigate.
- [ ] T051 [P] [US4] Write `tests/unit/cutover/classic-links.spec.ts`, with fixture source trees in `tests/unit/cutover/fixtures/classic-links/`:
  - the register validates;
  - every export of `src/app/navigation/classic-links.ts`, and every static `href="/…"` outside `/ng/` in `src/**/*.vue`, needs a register entry;
  - `--cutover-ready` fails on any match whose disposition is not `kept-entry` or `kept-excluded` (FR-037).
  - **switch independence** (FR-038): the scan also fails when code under `src/` references `release.json`, the `classic_pass` cookies, `document.cookie` or any `ngc_` name, so the app cannot learn or depend on the switch state.
- [ ] T052 [P] [US4] Write `tests/e2e/cutover/classic-link-crawl.spec.ts` (SC-006):
  - for each role it visits every route of the router with sample parameters from the cutover mock scenario;
  - it collects every same-origin `a[href]` and `form[action]` outside `/ng/`;
  - it allows only `/classic?to=<entry key>`, the prefixes `/api/v2/`, `/api/`, `/SOGo`, `/oauth/` and `/rspamd/`, and elements marked `data-operator-link`;
  - it fails when `[data-testid="placeholder-page"]` appears.

  Then write `tests/unit/features/cutover/no-placeholders.spec.ts`: no entry of `src/app/navigation/catalogue.ts` has `status: 'placeholder'`, and no route of the real router renders `PlaceholderPage` (FR-003). Adjust UI 001's `tests/unit/app/navigation/visibility.spec.ts` where it relies on placeholder rows.

### Implementation for User Story 4

- [ ] T053 [US4] Generate the pass map, the entry allowlist map and the `location = /classic` and `location = /classic/exit` blocks in `scripts/cutover/generate.mjs`, replacing T033's constant `$ngc_pass`. Run `npm run cutover:generate`. T047 and T048 pass, and T012's comparison now includes `/classic`.
- [ ] T054 [US4] Implement `src/features/cutover/components/ClassicApiKeysNote.vue` and export it from `src/features/cutover/index.ts`. Add the keys `cutover.classicApiKeys.title`, `.body` and `.link` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` as T007a's form map lists them, using "the classic interface", "klasické rozhraní" and "klasické rozhranie" (FR-039). Never machine-translate.
- [ ] T055 [US4] Add a designated "related" area below the page header of `src/features/api-keys/pages/ApiKeysPage.vue` (conventions "Where features meet"), and place `ClassicApiKeysNote` there for administrators (FR-035).
- [ ] T056 [US4] Reduce `src/app/navigation/classic-links.ts` to `classicEntry('api-v1-keys')`, which returns `/classic?to=api-v1-keys`, and the excluded targets in use. Mark operator app links with `data-operator-link` in `src/app/shell/AppsMenu.vue` and in the sign-in screen's app links (`src/features/auth/`).
- [ ] T057 [US4] Remove the placeholder mechanism (FR-003):
  - delete `src/app/states/PlaceholderPage.vue` and its tests;
  - remove the `placeholder` status and the `classic` field from `NavigationEntry` in `src/app/navigation/catalogue.ts`;
  - remove the placeholder route generation from `src/app/router/routes.ts`;
  - remove the placeholder translation keys from `src/i18n/messages/*.json`.

  The remaining UI 001 tests must pass.
- [ ] T058 [US4] Create `cutover/classic-links.json` with CL01–CL10 (research R9) and their final dispositions. Implement `scripts/cutover/classic-links-scan.mjs`, with `--cutover-ready`. T049–T052 pass.

**Checkpoint**: The classic interface entry works in every switch state, and no stale classic link
remains.

---

## Phase 7: User Story 5 - Users are told about the change (Priority: P2)

**Goal**: The arrival notice appears on arrivals through a redirect, including on the sign-in
screen, with the fallback sentence for fallback arrivals. It stops after "Don't show again" or
three visits. The runbook offers the announcement texts.

**Independent Test**: Arrive through redirected addresses and check the notice, its dismissal and
its accessibility on both viewports. Activate the runbook's texts in both interfaces in three
languages (spec US5 "Independent Test").

### Tests for User Story 5 (write first; must fail)

- [ ] T059 [P] [US5] Extend `tests/unit/features/cutover/arrival-state.spec.ts` with the counters of data-model.md §6:
  - **counting**: the first exact arrival in a tab session counts one visit; further arrivals in the same tab session do not;
  - **limit**: at visits `3` or dismissed, an exact arrival is hidden;
  - **fallback**: an arrival always shows the fallback sentence;
  - **storage failure**: storage that throws (private mode) still shows the notice and never throws;
  - **what is stored**: only the three keys are written, and never a token or an identifier.
- [ ] T060 [P] [US5] Write `tests/unit/features/cutover/ArrivalNotice.spec.ts`:
  - the exact and fallback texts of FR-041 come from `cutover.arrival.*`;
  - it is a `section` with an `h2`, not a dialog, so it never traps focus;
  - `useAnnouncer().polite` is called once per arrival;
  - "Close" and "Don't show again" are native buttons with the 44 × 44 utility classes;
  - it hides once the route leaves the sign-in steps and `targetPath`;
  - it renders nothing on a direct visit (US5-AS4).
- [ ] T061 [P] [US5] Extend `tests/unit/shared/platform/storage.spec.ts` (UI 001) with exactly the keys `mailcowui-ng.arrival-notice-visits`, `mailcowui-ng.arrival-notice-dismissed` and `mailcowui-ng.arrival-notice-counted`.
- [ ] T062 [P] [US5] Write `tests/e2e/cutover/arrival-notice.spec.ts`:
  - US5-AS2: the notice shows on the sign-in screen after `/ng/arrival/M05` and again on the target after sign-in, in each locale, and is announced;
  - US5-AS3: "Don't show again" hides it on later exact arrivals, a fourth visit (new browser context with the same storage state) hides it, and a fallback arrival (`/ng/arrival/F1`) still shows the fallback sentence;
  - US5-AS4: a direct visit to `/ng/` shows no notice;
  - axe in both themes, no horizontal scrolling at 360 px, and 44 × 44 targets (FR-049, SC-009).

### Implementation for User Story 5

- [ ] T063 [US5] Add the device counters to `src/features/cutover/arrival-state.ts`, and allow the three keys in `src/shared/platform/storage.ts`.
- [ ] T064 [US5] Implement `src/features/cutover/components/ArrivalNotice.vue` and export it from `src/features/cutover/index.ts`. Add `cutover.arrival.title`, `.body`, `.fallback`, `.close` and `.dontShowAgain` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (FR-039, FR-041), never machine-translated. The arrival page's loading text is the legacy `admin.loading`, verbatim, unless T007a's form map adds `cutover.arrival.loading` with a reason. `npm run i18n:check` passes.
- [ ] T065 [US5] Render `ArrivalNotice` below `AnnouncementBanner` in `src/app/layouts/AuthLayout.vue` and `src/app/layouts/ShellLayout.vue`. T059–T062 pass.
- [ ] T066 [US5] Add the section "Telling users" to `docs/cutover/runbook.md`, with the "before" and "after" announcement texts in English, Czech and Slovak (FR-040), written by people and never machine-translated (constitution IV 1.3.0). The "before" text has the date placeholder, the address `https://<host>/ng/`, signing in again with the usual account, passkeys and second factors still working, forwarded bookmarks, and unaffected webmail, mail apps and quarantine links. The "after" text says the switch has happened and where to get help. Recommend activating "before" at least 7 days ahead and keeping "after" for at least 14 days, through UI 013's announcement settings. Note that the apply step warns when no announcement is active.

**Checkpoint**: Users are informed in both interfaces and on arrival.

---

## Phase 8: User Story 6 - The operator verifies the cutover and watches for broken links (Priority: P2)

**Goal**: A read-only smoke test with a baseline, per-case results and a machine-readable outcome,
and a daily not-found and fallback report for the 14-day window.

**Independent Test**: Run the smoke test in the off, partial and on states and after a rollback.
Inject a broken exclusion and an unmapped bookmark, and confirm that the smoke test and the report
show them (spec US6 "Independent Test").

### Tests for User Story 6 (write first; must fail)

- [ ] T067 [P] [US6] Write `tests/unit/cutover/smoke.spec.ts` for `deploy/cutover/lib/smoke.mjs`, against an in-process server:
  - **expectations** per switch state (data-model.md §10);
  - **baseline mode**:
    - refuses unless every switch is off;
    - records status, content type and `Location`;
    - fails when `/ng/release.json` is missing or its digest differs (FR-043: every target exists in the deployed app);
  - **compare mode**:
    - an exclusion with another status or content type fails, with `rollbackRecommended: true` and exit `3` (US6-AS3);
    - a non-redirected row that changed answer is reported (US6-AS5);
  - **output**: the table, `--json` lines and the final `RESULT` line (US6-AS2);
  - the `autodiscover.` and `autoconfig.` checks use the main host's address, are marked "certificate not verified", and expect `404`;
  - concurrency 4;
  - no request carries a credential or an `Authorization` header.
- [ ] T068 [P] [US6] Write `tests/unit/cutover/report.spec.ts`, with fixture logs `tests/unit/cutover/fixtures/access-*.log` (mailcow `combined` lines and `ngc_cutover` lines):
  - `collect` writes the daily aggregate of data-model.md §10;
  - query values become `…` and row values `{value}`, and no token, address or value from a query string appears (FR-046);
  - only paths outside `/ng/` and `/api/v2/` count as classic;
  - `report` compares the last day with the baseline average and flags anything above 5 % (SC-008);
  - fallback addresses seen on at least 3 days that are not in `address-notes.json` are listed (FR-047);
  - exit codes as in contracts/README.md §2.5.
- [ ] T069 [US6] Write `tests/nginx/smoke-tool.spec.ts`. It runs `ng-cutover smoke` against the harness:
  - `--record-baseline` with every switch off passes;
  - the states `100`, `110` and `111`, and `000` after a rollback, pass;
  - an operator snippet `tests/nginx/fixtures/broken/site.zz-broken.custom` (`location ^~ /api/v1/ { return 418; }`) makes it exit `3`;
  - a stub change of `/qhandler.php`'s status between runs is reported as a changed classic address;
  - a `release.json` with another digest fails the baseline.
- [ ] T070 [US6] Write `tests/nginx/report-tool.spec.ts`. It sends `/admin/old-page` five times, `/foo?token=secret` three times and mapped rows in state `111`. `ng-cutover collect --input <compose logs>` then shows F1 and the `404` with counts and without `secret`, and `report` lists them (US6-AS4).

### Implementation for User Story 6

- [ ] T071 [US6] Implement `deploy/cutover/lib/smoke.mjs` and the `smoke` command in `deploy/cutover/bin/ng-cutover`. The command reads the host names from `mailcow.conf`, accepts `--host`, `--mail-domain`, `--resolve` and `--switches`, and stores the baseline in `var/baseline-<host>.json` (research R12).
- [ ] T072 [US6] Implement `deploy/cutover/lib/collect.mjs` and `deploy/cutover/lib/report.mjs`, and the `collect` and `report` commands. `collect` reads `<compose> logs --no-color --no-log-prefix --since <day> --until <day+1> nginx-mailcow` or `--input`, and writes `var/collected/<day>.json`. `report` reads `var/address-notes.json` (research R13).
- [ ] T073 [US6] Add the runbook sections "Baseline", "Smoke test" and "Monitoring" to `docs/cutover/runbook.md`:
  - a cron line for a daily `ng-cutover collect`, starting at least 7 days before the first change;
  - `smoke --record-baseline`;
  - smoke after every switch change, every rollback, every mailcow update and every app or API release (FR-044);
  - the 14-day window with a daily `report` and documenting addresses in `address-notes.json` (FR-047);
  - the rollback triggers of FR-048, including the app or API unavailable for more than 5 minutes.

**Checkpoint**: All six stories are complete and independently tested.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: The smoke suite against the real API, packaging, documentation, the registers'
final content and sign-off, the rehearsal, and the cutover-ready release.

- [ ] T074 [P] Write `tests/smoke/cutover.smoke.spec.ts` (tag `@cutover`, constitution VI's smoke layer, research R15). Through the harness nginx in front of the real API dev stack, it follows classic addresses through real sign-ins with the seeded accounts:
  - M05 and M09 as `admin`;
  - M11 and M19 as `reseller`;
  - M02 and M30 as `alice@example.org`, with TOTP;
  - M20 for a seeded mailbox;
  - M13 with a token from `issueDomainAdminSsoToken`;
  - M03 when the dev stack exposes a reset token.

  It checks that each arrives on its screen with real data, and that X02 and X06 still reach the classic stub.
- [ ] T075 Extend `scripts/smoke/stack-up.sh` and `scripts/smoke/stack-down.sh` (UI 001 R25) with `--with-cutover`. This starts the real mailcow nginx image on the API stack's network, with the vendored templates, `site.restv2.custom`, the generated cutover files, state `111` and the classic stub, and with `SMOKE_BASE_URL` set to its address. T074 passes.
- [ ] T076 [P] Write `scripts/cutover/package-tooling.sh`. It builds `mailcowui-ng-cutover-<version>.tar.gz` from `deploy/cutover/` (`bin/`, `lib/`, `nginx/`, `data/`, an empty `var/`) and `docs/cutover/runbook.md`. It refuses when `npm run cutover:check` fails. Attach the archive to releases in `.github/workflows/release.yml` (plan owner question 3).
- [ ] T077 Complete `docs/cutover/runbook.md`:
  - "Preconditions" (FR-001);
  - "Installing", including the order rule of research R7: install the addition with every switch off before deploying the cutover-ready release;
  - "Before switching mailbox users": point uptime monitors at `/api/v2/health/live` or `/ng/`, and review operator app links that point to classic addresses;
  - "After a mailcow update": smoke, and `verifiedAgainst`;
  - "Uninstalling";
  - a link to the generated `docs/cutover/mapping.md`.
- [ ] T078 Populate the readiness register: run `npm run cutover:readiness -- --scaffold`, confirm or correct each proposed entry against the shipped features, remove every `proposed` flag, record `dropped` reasons and acceptances, then `--render` `docs/cutover/readiness-register.md` for the owner. After the owner reviews it, record `signOff` with the computed `entriesDigest` in `cutover/readiness-register.json` (FR-002).
- [ ] T079 Review `cutover/classic-links.json` against the shipped code, then run `npm run cutover:classic-links -- --cutover-ready` and `npm run cutover:gates`. Both must pass. Run `npm run budget:check` and `npm run lhci` to confirm that the initial JS and the scores are unchanged (constitution VII).
- [ ] T080 Run quickstart.md Parts A, B and C, and fix every deviation.
- [ ] T081 Run quickstart.md Part D on a mailcow test installation. Record the timed rollback (under 15 minutes, SC-010), the switch latency (under 1 minute, SC-003 and SC-004), the data checksums (SC-004) and the session continuity (US3-AS6) in the release notes draft.
- [ ] T082 Build the cutover-ready release through `.github/workflows/release.yml`: tag `v*`, let `cutover-gates` pass, build the image with `CUTOVER_READY=1`, publish the tooling archive, and check that the release notes say "Cutover-ready: yes" (FR-003). The deployed `/ng/release.json` must show `cutoverReady: true` with the same `mappingDigest` as the archive's rules.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Before anything**: UI 001–013 shipped (T001). This is an external dependency, not a task.
- **Setup (Phase 1)**: T001 first. T002 then unblocks T003–T007, which can run in parallel.
- **Foundational (Phase 2)**: depends on Setup and blocks all stories. T007a comes first; the
  screen and string tasks depend on its form map. T013 comes before T014 and T015. T016 is
  independent of T015. T017 closes the phase.
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on Phase 2. It is safe to start in parallel with US1, but it edits
  `scripts/cutover/generate.mjs` after T015. Sequence T033 after T030 when one person does both.
- **US3 (Phase 5)**: depends on Phase 2. The CLI tests (T038) need the guard maps of US2 to make
  the switch semantics realistic, so run T038 after T033.
- **US4 (Phase 6)**: depends on Phase 2 and on US2's T033, because the pass term replaces T033's
  constant. T055–T057 touch UI 001 files that no other story edits.
- **US5 (Phase 7)**: depends on US1's `arrival-state.ts` (T025).
- **US6 (Phase 8)**: depends on US3's `lib/http.mjs` and `lib/mapping.mjs` (T040). Its nginx tests
  depend on the CLI (T042).
- **Polish (Phase 9)**: depends on every story. T078 needs the owner, and T082 needs T078 and T081.

### User Story Dependencies

- **US1 (P1)**: after Phase 2. Independently testable in the harness and the app.
- **US2 (P1)**: after Phase 2. Independently testable in the harness.
- **US3 (P1)**: after Phase 2. The realistic CLI tests come after US2.
- **US4 (P2)**: after US2's generator guards.
- **US5 (P2)**: after US1's arrival state.
- **US6 (P2)**: after US3's tool library.

### Files edited by several stories

- `scripts/cutover/generate.mjs`: T015, then T033 (US2), then T053 (US4). Regenerate after each
  (`npm run cutover:generate`).
- `docs/cutover/runbook.md`: T034, T046, T066, T073, then T077. Each adds its own section.
- `src/features/cutover/arrival-state.ts`: T025 (US1), then T063 (US5).
- `src/features/cutover/index.ts`: T028, T054 and T064, each adding exports.
- `src/i18n/messages/*.json`: T054, T057 (removing keys) and T064.
- `deploy/cutover/bin/ng-cutover`: T042, T071 and T072.
- `.github/workflows/ci.yml`: T007 and T039. `.github/workflows/release.yml`: T045 and T076.

### Within Each User Story

- Tests are written first and fail before implementation.
- Mapping and generator before nginx behaviour. Pure functions before pages. Pages before route
  registration.
- Regenerate the nginx files after every generator change. `cutover:check` fails otherwise.
- The story is complete, and its checkpoint verified, before the next priority starts.

### Parallel Opportunities

- Setup: T003–T007 in parallel after T002.
- Foundational tests: T008–T012 in parallel. Implementation: T016 alongside T013–T015.
- US1 tests: T018–T024 in parallel.
- US2 tests: T031 and T032 in parallel.
- US3 tests: T035–T037 and T039 in parallel. T038 after T033.
- US4 tests: T047–T052 in parallel.
- US5 tests: T059–T062 in parallel.
- US6 tests: T067 and T068 in parallel.
- Polish: T074 and T076 in parallel.

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests together (they must fail):
Task: "tests/nginx/redirects.spec.ts – every row × form × state on both host names (T018)"
Task: "tests/unit/features/cutover/resolve-arrival.spec.ts – row → route table (T019)"
Task: "tests/unit/features/cutover/ClassicTargetPage.spec.ts – alias/template lookups (T020)"
Task: "tests/unit/app/router/{guards,return-to}.spec.ts – arrival in every state (T021)"
Task: "tests/mocks/scenarios/cutover.ts – classic identifiers (T022)"
Task: "tests/e2e/cutover/arrival-targets.spec.ts – FR-045 on both viewports (T023)"
```

## Parallel Example: User Story 4

```bash
Task: "tests/nginx/entry.spec.ts – entry, pass and exit (T047)"
Task: "tests/unit/features/cutover/ClassicApiKeysNote.spec.ts (T049)"
Task: "tests/e2e/cutover/api-keys-note.spec.ts (T050)"
Task: "tests/unit/cutover/classic-links.spec.ts (T051)"
Task: "tests/e2e/cutover/classic-link-crawl.spec.ts (T052)"
```

---

## Implementation Strategy

### Minimum installable increment (US1 + US2 + US3)

1. Phase 1 Setup, after T001 confirms the entry conditions.
2. Phase 2 Foundational: mapping, generator base and route contract.
3. US1: redirects and arrival. Validate in the harness and the app, **but do not install anywhere
   real**.
4. US2: the exclusion guards. Validate every exclusion in every state.
5. US3: the CLI, preflight, release manifest, readiness tooling and rollback.
6. **Stop and validate**: quickstart Part B for US1–US3. This is the first build an operator could
   use on a test host.

### Incremental delivery

1. Then US4: entry, API keys note, stale links and placeholders.
2. Then US5: arrival notice and announcement texts.
3. Then US6: smoke test and monitoring.
4. Polish: smoke suite, packaging, the registers' sign-off, the rehearsal (Part D), and the
   cutover-ready release.

### Parallel team strategy

After Phase 2:

- Developer A: US1, then US5 (app side).
- Developer B: US2, then US4's nginx part (T047, T048, T053), then US6 (nginx and tool side).
- Developer C: US3 (CLI, preflight, manifest, readiness tooling), then US4's app part
  (T049–T052, T054–T058).

Coordinate on `scripts/cutover/generate.mjs` (T015, then T033, then T053).

---

## Notes

- **[P]** tasks touch different files and depend on no incomplete task.
- A **[Story]** label maps each task to its user story for traceability.
- Never edit generated files: `deploy/cutover/nginx/*`, `deploy/cutover/data/*`,
  `docs/cutover/mapping.md` and `docs/cutover/readiness-register.md`. Edit `cutover/*.json` or the
  generator instead.
- Upstream mailcow files are never edited. The harness mounts vendored copies of the templates
  read-only.
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
