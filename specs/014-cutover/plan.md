# Implementation Plan: Cutover from the Classic Interface

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-cutover/spec.md`

## Summary

UI feature 014 redirects the classic mailcow interface to mailcowui-ng once UI 001–013 have
shipped. It keeps everything that must stay classic, gives the operator a per-role switch with a
safe rollback, and proves the result with a smoke test and a monitoring report. The approach, with
details in [research.md](./research.md):

- **Redirects**:
  - three generated nginx files in the operator's `data/conf/nginx/`, using mailcow's own
    extension points: `*.conf` at `http` level and `site.*.custom` in every public server (R1);
  - a server-level `if ($ngc_redirect) { return 302 $ngc_target; }` driven by lazy maps. The
    redirect applies only to `GET` and `HEAD`, only without a classic pass, never on the internal
    SOGo verification port, and only when every role of the row's used-by set is switched on (R2,
    R4);
  - redirects are `302` with `Cache-Control: no-store` and a relative `Location`, so the host and
    scheme are kept.
- **Arrival in the app**:
  - every redirect leads to `/ng/arrival/<row>`. Carried values travel in the URL fragment, so
    tokens and identifiers never reach a new log line;
  - the app resolves the row to a named route of the delivering feature, decoding as the classic
    page did, and replaces the address (R3);
  - three rows need a lookup (alias by address, template kind, Sieve filter), done by a
    session-backed `classic-target` route through contract operations.
- **Switch and rollback**:
  - `ng-cutover`, a bash CLI on the mailcow host, writes the switch bits atomically, runs
    `nginx -t` with automatic restore, and reloads gracefully;
  - turning a role on is refused unless the deployed app's `/ng/release.json` says
    `cutoverReady` with the same mapping digest, the app and the API answer, and a passing
    off-state baseline exists;
  - rollback is `ng-cutover apply none` and is never refused (R5, R14).
- **Classic interface entry**: `/classic?to=<key>` sets a two-cookie classic pass (session cookie
  plus 8-hour cookie) and opens an allowlisted classic screen. `/classic/exit` ends the pass (R7).
- **One source**: `cutover/mapping.json` generates the nginx rules, the smoke cases and the
  documented mapping, and the app imports it. A SHA-256 digest ties an installation's rules to
  the deployed app (R11).
- **Readiness**:
  - machine-checked registers for readiness (FR-002, with a digest-bound owner sign-off) and for
    classic links (FR-036);
  - a release gate sets `cutoverReady` in the release manifest (R8, R9).
- **Communication**: a translated, non-modal arrival notice with device-local visit counting
  (R10), and the runbook's announcement texts in English, Czech and Slovak (R16).
- **Verification**:
  - unit and end-to-end tests;
  - nginx tests on the real mailcow nginx image with vendored upstream templates;
  - a smoke suite against the real API;
  - the operator's read-only cutover smoke test;
  - a not-found and fallback report built from daily aggregates (R12, R13, R15).

## Technical Context

**Language/Version**:

- App: TypeScript 5.9 (strict) and Vue 3.5, as in UI 001.
- Tooling: Node.js 24 ESM (`.mjs`, no dependencies) for the generator, checkers, smoke test and
  report.
- Operator CLI: bash 4+.
- Generated nginx configuration for nginx 1.30 (mailcow `2026-09a`).

**Primary Dependencies**: no new runtime or development dependency. The feature uses UI 001's
stack: Vue Router, vue-i18n, TanStack Vue Query and the generated client. It also uses its dev
tools: Vitest, Playwright, axe and Ajv. The nginx tests use Docker images, pinned by digest:

- `ghcr.io/mailcow/nginx:1.30.4-1`, the image of `2026-09a`;
- `php:8.4-fpm-alpine`;
- `nginxinc/nginx-unprivileged:1.28-alpine`, already UI 001's base;
- `node:24-alpine`.

**Storage**:

- On the mailcow host: three files in `data/conf/nginx/`, and the tool's `var/` directory with the
  baselines, the daily aggregates, the history and the address notes.
- In the browser: three convenience keys for the arrival notice (data-model §6).
- No database change, in line with API constitution V.

**Testing**:

- Vitest units, test-first.
- Playwright end-to-end on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`,
  with axe in both themes.
- `npm run test:nginx`: the Docker harness with the real mailcow nginx image.
- The Playwright smoke suite against the mailcow-rest-v2 dev stack, `@cutover`.
- `shellcheck` on the CLI. It is preinstalled on CI runners and adds no dependency.

**Target Platform**:

- Browsers: as UI 001.
- The operator tool: a Linux mailcow-dockerized host with Docker and Compose v2. Node 22+ is
  optional, because the tool falls back to `node:24-alpine`.
- nginx-mailcow at `2026-09a` or a later release listed in `verifiedAgainst`.

**Project Type**: the web application's static frontend (UI 001), plus deployment artefacts and
operator tooling in `deploy/cutover/`. There is no backend code.

**Performance Goals**:

- A switch change takes effect for new requests within 1 minute (SC-003). In practice it takes
  seconds: a graceful reload.
- The redirect decision costs a few regex matches per classic request.
- The arrival route is a lazy chunk of a few KB, and the initial JS budget is unchanged.
- The smoke test takes under 1 minute per host, and the rollback procedure under 15 minutes
  (SC-010).

**Constraints**:

- No upstream mailcow file, template or service definition changes. No container restart or image
  rebuild (FR-022).
- An nginx configuration that cannot load must never be left in place, because mailcow's ACME
  reload restarts the container on failure.
- Exclusions answer exactly as before (FR-015).
- Tokens are never checked or consumed on the way, and never logged again.
- The pass grants nothing.
- The app never depends on the switch state (FR-038).

**Scale/Scope**:

- 33 mapping rows, 3 fallback families and 16 exclusion classes.
- 3 roles and 8 switch states.
- About 400 smoke requests per host name.
- 2 new app routes, 2 new components and about 20 translation keys.
- A readiness register over every parity row of UI 001–013 and the legacy inventory.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | The app uses only contract operations: `getAlias`, `listAliases`, `getDomainTemplate`, `getMailboxTemplate`, and `listSieveFilters` with an `id` filter once gap SF is pinned (contracts §1). The missing Sieve-filter lookup is gap SF, specified in mailcow-rest-v2 first, with no paging workaround; until then M31 arrives on the filters list as a fallback. Classic pages appear only as link targets: the entry and the excluded addresses. The operator tool calls only the anonymous `getReadiness` and `getPublicConfig`. | PASS (SF recorded) |
| II. Mobile-first | The arrival notice and the API keys note are designed at 360 px first, without horizontal scrolling, with 44 × 44 targets. FR-045's end-to-end tests run on the 360 px project. `ArrivalPage` shows only a loading state, and `classic-target` shows the target's own loading, not-found and error states. | PASS |
| III. Accessibility | The notice is non-modal, has a heading, is announced through the polite live region and is keyboard-dismissible. axe runs on every arrival and note state in both themes (SC-009). Focus follows UI 001's rule after the replace. | PASS |
| IV. i18n and branding | New text (`cutover.*`) exists in en-gb, cs-cz and sk-sk, and `i18n:check` gates it. The wording is "the classic interface", "klasické rozhraní" and "klasické rozhranie" (FR-039). The runbook's announcement texts are written in all three languages, and the operator places them through the existing branding announcement. Nothing is brand-specific. | PASS |
| V. Security in the browser | Device storage holds only the three notice counters, never tokens or identifiers. Tokens pass through the fragment, are handed to the target, which removes them at once, and are never logged again. No `v-html`. The entity decoding uses an inert `DOMParser` document, never rendering. The pass is not a credential. The redirect can only lead to `/ng/arrival/<row>`, and raw values are charset-checked, which excludes `\` (R2). Hiding the API keys note from other roles is a convenience; the classic interface enforces its own sign-in. | PASS |
| VI. Test-first | `tasks.md` puts every test before its implementation: units, end-to-end on both viewports, the nginx harness against the real upstream image, and the smoke suite against the real API (R15). Mocks stay contract-validated, as UI 001 requires. | PASS |
| VII. Performance budgets | The arrival and `classic-target` routes are lazy. The notice component is small and loaded with the layouts. The redirect costs nothing in the app. Server state reuses the delivering features' query keys, and the resolver's lookups are single requests. | PASS |
| VIII. Simplicity | No new dependency. Stock nginx maps instead of a proxy container or modules. One JSON source with generated outputs. A bash CLI only where Docker is needed, and zero-dependency Node elsewhere. | PASS (see Complexity Tracking) |
| Technology constraints: deployment | The static app is unchanged in kind. The redirect lives in nginx-mailcow through its documented includes. No upstream file is patched (R1). | PASS |
| Technology constraints: no backend code | The repository gains deployment artefacts (nginx configuration) and an operator tool that runs on demand, outside the app. UI 001 already has `deploy/` and `docker/nginx/`. No server process or runtime service is added. | PASS (recorded in Complexity Tracking) |
| Workflow and gates | The CI gains `cutover` (generate check, register checks), `nginx` (the harness) and, for release tags, `cutover-gates`. Each uses existing gate categories: lint, tests and end-to-end. Commits go to `main`. GPL-3.0: the vendored mailcow templates are GPL-3.0. | PASS |
| `docs/conventions.md` | Wording. "Where features meet": 014 adds the API keys note to UI 001's screen through a designated area, and the single sign-on token hand-over to UI 007's auth feature; UI 005 already reads the Mail app setup preselection (FR-050). The "Shared building blocks and canonical names" rules are kept: 014 reuses UI 001's `classic-links.ts`, `useAnnouncer` and storage module and creates no renamed copy. The contract-pin rule is applied (baseline commit below). The not-found and no-access states belong to the targets. No list, bulk or secret patterns are involved. | PASS |
| mailcow-rest-v2 constitution V (Coexistence) | Internal endpoints, `/api/v1`, SOGo, autodiscover and the OAuth2 provider stay in php-fpm and are never redirected (X02–X11, X15). Sessions stay separate. Both interfaces write the same data. The API is not modified, except for SF, which is additive. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, the contracts README and the
quickstart introduce no violation. Decisions that touched gates:

- carried values in the fragment, so no new personal data appears in access records (V, and spec
  FR-046);
- SF raised in mailcow-rest-v2 instead of paging through filters (I);
- the real upstream nginx image in tests rather than a re-implementation (VI);
- two cookies instead of a signed expiry, so no secret and no module is needed (VIII, V).

## Dependencies and order

**UI 014 is implemented last.** Its tasks may start only when all of these hold. Phase 1's gate
task checks them and records the evidence:

1. UI features 001–013 are implemented, released and deployed on the test installation, together
   with the API releases they pin (FR-001). Their navigation catalogue entries are all
   `available`.
2. The pinned contract contains API features 001–013, at or after the baseline commit below. Row
   M31 resolves to the filter itself only once the pin contains SF; until then it arrives on the
   filters list as a fallback (owner question 1).
3. The routers of UI 002–013 expose the target routes of data-model §5. Where a name differs, the
   mapping is reconciled. Where a screen is missing, 014 adds the route in that feature's area.
4. mailcow-rest-v2 still routes `/ng/` and `/api/v2/` through `site.restv2.custom` (API research
   R23), and the app image still serves under `/ng/` (UI 001 R29).

**Files of earlier features that 014 changes**, each covered by a task:

| File | Feature | Change |
|---|---|---|
| `src/features/api-keys/pages/ApiKeysPage.vue` | 001 | a designated "related" area below the page header, holding `ClassicApiKeysNote` (FR-035) |
| `src/app/navigation/classic-links.ts` | 001 | reduced to the entry (`/classic?to=api-v1-keys`) and the excluded targets. Placeholder classic links are removed (FR-037) |
| `src/app/states/PlaceholderPage.vue` | 001 | removed, together with its route generation, once no entry is `placeholder` (FR-003) |
| `src/app/layouts/AuthLayout.vue`, `src/app/layouts/ShellLayout.vue` | 001 | render `ArrivalNotice` below the announcement |
| `src/app/router/routes.ts` | 001 | register `cutoverRoutes` |
| `src/shared/platform/storage.ts` | 001 | allow the three notice keys |
| `docker/Dockerfile`, `docker/nginx/default.conf` | 001 | the `CUTOVER_READY` build argument, and `location = /ng/release.json` with `no-cache` |
| `package.json`, `.github/workflows/ci.yml`, `scripts/smoke/stack-up.sh` | 001 | the scripts and CI jobs of R15, and `--with-cutover` |
| `src/features/auth/index.ts` (and the module of `captureSsoToken()`) | 007 | export a function that puts a single sign-on token into the landing's memory holder, unless 007 already exports one (research R3, M13) |
| the routes of 002–013, as needed | 002–013 | the target routes of data-model §5 that are missing |

## API dependency and gaps

UI 014 depends on no mailcow-rest-v2 feature of its own. The roadmap lists none.

**Baseline commit** (conventions, contract-pin rule): mailcow-rest-v2
`e4f74adce7318ac5ced8f87ba8303cddf9c78e52` (2026-10-18). UI 014's seven operations were checked
there (contracts/README.md §1). Pins only move forward, so 014 uses the pin that UI 001–013 have
reached, which must be this commit or later, and T001 re-checks the operations against it.

UI 014 relies on:

- the deployment of API research R23;
- the reset page default of API 005;
- the tokens of API 007, accepted by both interfaces;
- the OAuth2 endpoints that API 012 keeps in legacy;
- the anonymous `getReadiness` and `getPublicConfig`.

There is one gap:

- **SF: look up a Sieve filter by ID**. The classic `/edit/filter/{id}` (M31) carries only the
  filter ID, and the contract reaches a filter only below its mailbox.
  - **Proposed to mailcow-rest-v2, API 005**: a repeatable `id` filter on `listSieveFilters`, to
    be registered as the next entry of mailcow-rest-v2's `docs/api-gaps.md` (G1–G5 are taken).
  - **Effect**: until it is pinned, M31 arrives on the `filters` list as a fallback arrival, as
    UI 005's plan expects (its gap AG2). Nothing else is affected.
  - Details are in [contracts/README.md](./contracts/README.md#api-gap-sf-look-up-a-sieve-filter-by-its-id).

## Owner-level questions (defaults applied)

1. **M31 while API gap SF is open**: should M31 (`/edit/filter/{id}`, administrators and domain
   administrators) lead to the Filters list as a fallback arrival, or should the cutover wait?
   - **Default**: the fallback arrival on `filters`, with the notice saying the page has no exact
     counterpart. UI 005's plan already expects this (its gap AG2). A rarely used administrator
     deep link should not block the whole cutover, and nothing is worked around: the contract is
     extended first (constitution I). The deviation from FR-010 is recorded as a `changed` entry
     in the readiness register, so the owner accepts it explicitly at sign-off. Once SF is
     pinned, `classic-target` opens the filter itself.
   - If the owner prefers to wait, the `cutover-gates` job treats the interim as a failure and
     the cutover waits for SF.
2. **The classic interface entry's address**: `/classic` and `/classic/exit`. Users see these
   addresses and operators document them.
   - **Default**: `/classic`. It answers `404` in the classic interface today, so nothing changes
     for other paths.
   - Another name changes only the generator's constants and the runbook.
3. **Distribution of the operator tool**:
   - **Default**: a release asset `mailcowui-ng-cutover-<version>.tar.gz` attached to each
     GitHub release of `FELDSAM-INC/mailcowui-ng`, built from `deploy/cutover/` of the same
     commit as the image, so the mapping digests match. Operators extract it to
     `/opt/ng-cutover`.
   - The alternative of shipping the tool inside the app image and extracting it with
     `docker compose cp` was not chosen. It hides the files from review, and the app image is a
     non-root static server.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds these details, verified in the baseline code
(research R17, R18):

1. The classic `/edit/alias/…` links use the numeric alias ID, and the classic page accepts the ID
   or the address. The app accepts both (M16 resolver).
2. `/edit/<type>/<value>/` (trailing slash), `/user/`, `/index.php/` and `/reset-password/`
   answer `404` in the classic interface today. After cutover they reach their targets. This is
   an improvement (FR-007).
3. In the classic OAuth2 sign-in, cancelling the second factor, or meeting a pending action, ends
   on `/`. After cutover, `/` leads to the app, and the user restarts the authorisation from the
   application. The runbook notes this.
4. A plain classic single sign-on (`?iam_sso` without a pending OAuth2 request) ends on `/user`,
   which leads to the app once mailbox users are switched on. Webmail and OAuth2 flows are
   unchanged.
5. While API gap SF is open, `/edit/filter/{id}` lands on the Filters list instead of the filter
   (owner question 1).

## Project Structure

### Documentation (this feature)

```text
specs/014-cutover/
├── spec.md              # Feature specification (with clarifications, mapping and exclusions)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R18
├── data-model.md        # Phase 1: mapping, nginx variables, state, route contract, registers, records
├── quickstart.md        # Phase 1: gates, harness checks, smoke suite, test-installation rehearsal
├── contracts/README.md  # Phase 1: operations used, gap SF, exposed interfaces
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
cutover/
├── mapping.json                       # authoritative mapping: rows, exclusions, entry targets, verifiedAgainst (R11)
├── mapping.schema.json
├── readiness-register.json            # FR-002 (R9)
├── readiness-register.schema.json
├── classic-links.json                 # FR-036 (R9)
└── classic-links.schema.json
deploy/cutover/
├── bin/ng-cutover                     # bash CLI: install, apply, status, smoke, collect, report, uninstall, version (R5)
├── lib/{http,mapping,preflight,smoke,collect,report}.mjs   # zero-dependency Node modules
├── nginx/{ng-cutover.conf,site.ng-cutover.custom}          # GENERATED (R2, R6, R7)
└── data/{smoke-cases.json,mapping.json}                    # GENERATED / copied
docs/cutover/
├── runbook.md                         # operator runbook with announcement texts en/cs/sk (R16)
├── mapping.md                         # GENERATED documented mapping (FR-029)
└── readiness-register.md              # GENERATED view for the owner's sign-off
scripts/cutover/
├── generate.mjs  check.mjs            # mapping → generated files; up-to-date check
├── readiness.mjs                      # validate, --scaffold, --render (R9)
├── classic-links-scan.mjs             # static classic-link scan (R9)
├── release-manifest.mjs               # dist/release.json (R8)
├── gates.mjs                          # runs every cutover-ready gate
├── vendor-nginx-templates.sh          # copies mailcow nginx templates at a tag (R15)
├── harness.sh                         # up/down for the nginx harness
└── package-tooling.sh                 # release asset tarball
src/features/cutover/
├── index.ts                           # cutoverRoutes, ArrivalNotice, ClassicApiKeysNote
├── routes.ts                          # arrival, classic-target
├── mapping.ts                         # typed view of cutover/mapping.json targets
├── fragment.ts                        # raw fragment parsing per carry kind
├── classic-decode.ts                  # decodeAsClassic (rawurldecode + entity decoding)
├── resolve-arrival.ts                 # (row, fragment) → route location or resolver
├── arrival-state.ts                   # in-memory arrival and device counters
├── api.ts                             # lookups for classic-target
├── pages/{ArrivalPage.vue,ClassicTargetPage.vue}
└── components/{ArrivalNotice.vue,ClassicApiKeysNote.vue}
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json   # cutover.* keys
tests/
├── unit/cutover/{mapping,generate,readiness,classic-links,release-manifest,smoke,report,preflight}.spec.ts
├── unit/features/cutover/{fragment,classic-decode,resolve-arrival,arrival-state,targets,no-placeholders,ArrivalNotice,ClassicApiKeysNote,ClassicTargetPage}.spec.ts
├── unit/features/auth/sso-token-handover.spec.ts
├── e2e/cutover/{arrival-targets,arrival-notice,api-keys-note,classic-link-crawl}.spec.ts
├── nginx/
│   ├── compose.yaml                   # real mailcow nginx image + stubs + app image
│   ├── global-setup.ts                # certificates, compose up, readiness wait
│   ├── upstream/2026-09a/templates/   # vendored nginx.conf.j2, sites-default.conf.j2 + SHA256SUMS
│   ├── fixtures/{web,api,ng,sogo,rspamd,mailcow}/   # stub docroots, fake mailcow dir for the CLI
│   └── {redirects,exclusions,entry,cli,smoke-tool,report-tool}.spec.ts
└── smoke/cutover.smoke.spec.ts
vitest.nginx.config.ts
```

**Structure Decision**:

- App code lives in one feature folder, `src/features/cutover/`, reached through its `index.ts`
  (UI 001 R3).
- The single source of truth and the registers live in a top-level `cutover/` data directory,
  because the app, the generator and the checkers all read them.
- Operator deliverables sit in `deploy/cutover/` next to UI 001's `deploy/` artefacts.
- Documents for operators and the owner live in `docs/cutover/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Operator tooling (a bash CLI and zero-dependency Node scripts) and generated nginx configuration live in a repository whose constitution says "no backend code". | The spec requires an apply step that refuses unsafe changes (FR-023), a read-only smoke test (FR-043) and a log report (FR-046), all generated from the same mapping as the app (FR-029). They run on demand on the operator's host and never as a service. UI 001 already ships deployment artefacts (`deploy/`, `docker/nginx/`). | Putting them in mailcow-rest-v2 was rejected: the API repository does not own the app's routes or the mapping, and FR-029 would cross repositories. Manual nginx editing by operators was rejected: it violates FR-020, FR-023 and FR-029 and is error-prone on a server where a broken configuration stops mail clients and webmail. |
| The app gains an intermediate arrival route instead of nginx redirecting straight to final screens. | Exact classic decoding (FR-006) needs no transcoding when values keep their path or query semantics. The app's route names are checked against the router, so a renamed route cannot silently break bookmarks. Tokens stay out of new log lines (research R3). | Direct nginx targets were rejected: nginx cannot turn `+` into a space for query-form values, would hard-code app paths without a check, and would log carried values again. |
