# Quickstart and Validation Guide: UI Feature 014

**Feature**: `specs/014-cutover` | **Plan**: [plan.md](./plan.md) |
**Contracts**: [contracts/README.md](./contracts/README.md)

This guide proves the cutover works. It refers to the spec, research and data model instead of
repeating them:

- **Part A**: the automated gates.
- **Part B**: manual checks per user story against the local nginx harness.
- **Part C**: the smoke suite against a real mailcow-rest-v2 dev stack.
- **Part D**: the rehearsal on a mailcow test installation, which is the precondition for a
  production cutover.

## Prerequisites

- UI features 001–013 are released, and their API features are deployed on the test installation
  (FR-001). The `contract/VERSION.json` pin contains API gap SF (contracts §1).
- Node.js 24 LTS and npm, Docker with Compose v2, and the browsers of UI 001's quickstart.
- A mailcow-dockerized checkout with upstream tags at `$MAILCOW_REPO` (default `../mailhosting`).
  It is used only to vendor the nginx templates.
- For Part C: a mailcow-rest-v2 checkout at `$MAILCOW_REST_V2_DIR` (default `../mailcow-rest-v2`).
- For Part D: a non-production mailcow host at the upstream baseline `2026-09a` or a later release
  listed in `cutover/mapping.json → verifiedAgainst`, with shell access in its
  mailcow-dockerized directory.

## Part A: automated gates

```bash
npm ci
npm run cutover:generate && git diff --exit-code   # the generated files are up to date
npm run cutover:check                              # the same check, as CI runs it (FR-029)
npm run lint && npm run typecheck && npm run i18n:check
npm run test:unit                                  # includes tests/unit/cutover and tests/unit/features/cutover
npm run build && npm run budget:check              # arrival chunk lazy; the initial JS budget is unchanged
npm run test:e2e                                   # includes tests/e2e/cutover on all three projects
npm run test:nginx                                 # Docker: the real mailcow nginx image with the cutover files
npm run cutover:readiness                          # the readiness register checker (FR-002)
npm run cutover:classic-links                      # the classic link register and the static scan (FR-036)
npm run cutover:gates                              # every cutover-ready gate (research R8); fails before sign-off
```

**Expected**:

- Every command exits with `0`, except `cutover:gates`, which fails with a list of open items
  until the readiness register is signed off.
- `test:nginx` prints one result per smoke case for each switch state: off, each role alone,
  administrators plus domain administrators, all on, and rolled back. Every exclusion keeps its
  status and content type.
- `dist/release.json` exists, with `cutoverReady: false` unless the build ran with
  `CUTOVER_READY=1`.

## Part B: manual checks against the nginx harness

```bash
scripts/cutover/harness.sh up        # the real mailcow nginx image, stub classic pages, an API stub and a static app stub
export NG_CUTOVER_HOME=$PWD/deploy/cutover
export NG_CUTOVER_COMPOSE="docker compose -p ngc-harness -f tests/nginx/compose.yaml"
deploy/cutover/bin/ng-cutover --mailcow-dir tests/nginx/fixtures/mailcow install
deploy/cutover/bin/ng-cutover --mailcow-dir tests/nginx/fixtures/mailcow smoke --record-baseline \
  --resolve mail.example.test:18443:127.0.0.1
```

The harness answers on `https://mail.example.test:18443` (`NGC_HARNESS_PORT`; use `--resolve` or an `/etc/hosts` entry). Its
certificate is self-signed, so use `curl -k`.

| Story | Check | Expected |
|---|---|---|
| US3 | `ng-cutover … apply admin` while the stub manifest says `cutoverReady: false` | refused with the reason, and `status` is unchanged (US3-AS1) |
| US3 | Switch the stub to the ready manifest, then `apply admin` and `status --probe` | admin on with a timestamp. `HEAD /admin` gives `302 /ng/arrival/M05`. `HEAD /domainadmin` and `HEAD /` answer as before (US3-AS2) |
| US1 | `curl -kI https://mail.example.test:18443/admin/queue` | `302`, `Location: /ng/arrival/M09`, `Cache-Control: no-store` |
| US1 | `curl -kI '…/edit/mailbox/john%40example.org'` with `apply admin,domainadmin` | `Location: /ng/arrival/M20#p=john%40example.org` |
| US1 | `curl -kI …/quarantine` with only admin on | the classic answer (US1-AS7). With `apply all`: `302 /ng/arrival/M14` (US3-AS3) |
| US2 | `curl -kI …/api/v1/get/status/version`, `…/qhandler/release/abc`, `…/Autodiscover/Autodiscover.xml`, `…/.well-known/mta-sts.txt`, and `/` with `Host: autodiscover.example.test` | the same answers as in the baseline (US2-AS1 to US2-AS9) |
| US2 | `curl -k -X POST …/admin` with all on | the classic answer, not a redirect (US2-AS8) |
| US4 | `curl -kI '…/classic?to=api-v1-keys'`, then repeat a mapped request with both cookies | `302 /admin/system` with two `Set-Cookie` headers. The mapped request is not redirected while both cookies are sent (US4-AS2) |
| US4 | `curl -kI …/classic/exit` | `302 /ng/`, with both cookies expired (US4-AS3) |
| US6 | `ng-cutover … smoke` after each change | `RESULT pass`. Break an exclusion with an extra operator snippet (for example `location ^~ /api/v1/ { return 418; }`), then smoke | that exclusion fails and `rollback-recommended=yes` (exit code 3) (US6-AS3) |
| US3 | `ng-cutover … apply none`, then `smoke` | everything is classic again and smoke passes (US3-AS4) |

The browser side of US1 and US5 (sign-in, target screen, arrival notice) is not part of the harness.
The end-to-end tests in Part A cover it against the mock API, and Part C covers it against the real API.

`scripts/cutover/harness.sh down` removes the harness.

## Part C: smoke suite against mailcow-rest-v2

```bash
scripts/smoke/stack-up.sh --with-cutover   # UI 001's stack plus the mailcow nginx image, the cutover files and the classic stub
npm run test:smoke -- --grep @cutover
scripts/smoke/stack-down.sh
```

**Expected**: `tests/smoke/cutover.smoke.spec.ts` passes. Classic bookmarks lead through the real
sign-in to the real objects of the API's `DevelopmentSeeder`: at least one row per delivering
feature, plus M13 with a token minted through `issueDomainAdminSsoToken`.

## Part D: rehearsal on a mailcow test installation

This is the runbook (`docs/cutover/runbook.md`) carried out once on a test host. Time the
rollback (step 9).

1. **Install the tooling**:
   `tar -xzf mailcowui-ng-cutover-<version>.tar.gz -C /opt/ng-cutover`, then
   `cd /opt/mailcow-dockerized && /opt/ng-cutover/bin/ng-cutover install`. Every switch is off.
   Only `/classic` and `/classic/exit` are new.
2. **Collect the baseline**: add `ng-cutover collect` to the host's cron, once a day, for at least
   7 days. Then run `ng-cutover smoke --record-baseline`. **Expected**: `RESULT pass`, which also
   confirms the deployed app's `release.json` digest (FR-001).
3. **Announce**: activate the "before" announcement text from the runbook in UI 013 and check it in
   both interfaces, in English, Czech and Slovak (US5-AS1).
4. **Check the data**: take a data checksum with
   `docker compose exec mysql-mailcow sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" mailcow -e "CHECKSUM TABLE …"'`
   over every mailcow table, with no user activity.
5. **Switch administrators on**: `ng-cutover apply admin`, then `ng-cutover status --probe` and
   `ng-cutover smoke`. **Expected**: refused if anything in FR-023 fails. Otherwise applied within
   1 minute, and smoke passes (US3-AS2).
6. **Run the end-to-end checks of SC-002**: mail client autoconfiguration, an `/api/v1` read with a
   key, a webmail sign-in, an ActiveSync sync, a quarantine quick release from an old notification,
   and an OAuth2 sign-in with a test application including a second factor. Then follow the API
   keys note in the app to the classic interface and regenerate a test `/api/v1` key (US4).
7. **Switch domain administrators and mailbox users on**: `ng-cutover apply admin,domainadmin`,
   then `ng-cutover apply all`, each followed by `smoke`. Then work in the app: create a domain and
   change a mailbox (US3-AS5).
8. **Check the monitoring**: open an unknown `/admin/old-page` a few times and an unknown `/foo`.
   The next day, run `collect`, then `report`. **Expected**: the F1 address and the `404` appear
   with counts, and no query values are shown (US6-AS4).
9. **Roll back, timed**: `ng-cutover apply none` and `ng-cutover smoke`. **Expected**:
   - classic addresses answer as in the baseline within 1 minute, also in a browser that followed
     redirects before (SC-004);
   - the new domain and the changed mailbox are visible in the classic interface;
   - the whole procedure takes under 15 minutes (SC-010).
10. **Repeat the data checksum** with no user activity. The tables that step 7 did not change are
    identical, and the changed rows are exactly the ones made in step 7 (SC-004).
11. **Check sessions**: sessions open in both interfaces during steps 5–9 are still signed in
    (US3-AS6).
