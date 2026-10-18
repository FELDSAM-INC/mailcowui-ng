# Analysis: UI feature 014 Cutover

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

All 50 FRs and 10 SCs map to tasks (100 %). No CRITICAL findings.

**HIGH, all fixed:**
1. Target route names are aligned with the UI 002 to 013 plans (12 mismatches).
2. The SSO token is handed to UI 007's landing in memory (T024, T029).
3. The target for mailbox links is `mailbox-overview`, not the parent route.
4. The CLI tests use a fixture baseline.
5. The nginx test setup gets a `phpfpm` alias and `ENABLE_IPV6=false` (T005).
6. A new `no-placeholders.spec.ts` replaces a missing gate file.
7. The gap label is renamed to avoid a collision. It is mailcow-rest-v2's G23.

**MEDIUM, fixed:** the letter-case test, independence from the switch state, the container-restart
check, an error state, and quickstart details.

## Remaining (below HIGH)

- `/edit/filter/{id}` (M31) opens the exact filter once API gap G23 is done in API 005, which comes
  before UI 014. No fallback is needed.
- The M16 alias is carried by address or ID. Both are accepted.
- Naming across UI plans: the route flag and the mailbox parameter are resolved in
  `docs/conventions.md` (`meta.public`, `:address`).
- T014 reconciles route names with the shipped routers.
- **LOW:** the end of the browser session is checked through cookie attributes only; one research
  quote shows an earlier `Location` form.

## Orchestrator decisions on owner questions

1. M31 maps directly to the filter (G23 is fixed in API 005 first). The readiness register needs no
   fallback acceptance.
2. The classic entry is `/classic` and `/classic/exit`.
3. The operator tool ships as `mailcowui-ng-cutover-<version>.tar.gz` on each GitHub release, built
   from the same commit as the image.
