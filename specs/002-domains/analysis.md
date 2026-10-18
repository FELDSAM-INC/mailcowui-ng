# Analysis: UI feature 002 Domains

The plan agent ran `/speckit-analyze` with an independent read-only reviewer. The orchestrator
recorded the results here, because the harness would not let the subagent write this file.

## Result

1 CRITICAL, 2 HIGH, 5 MEDIUM and 11 LOW findings, all fixed. 100 % of FRs have at least one task.

- **C1:** an API gap must be specified in mailcow-rest-v2 first. T001 step 6 checks the gaps at pin
  time. The gaps are tracked in mailcow-rest-v2 `docs/api-gaps.md`.
- **H1:** a 503 was modelled on section saves that document none. Those paths now test network
  failure and 500.
- **H2:** fully required enumerations would have failed `i18n:check` before their labels existed.
  Each is registered in `coverage.json` by the task that adds its labels.
- **MEDIUM:**
  - a 5,000-domain scenario;
  - limits in `limits.ts` with contract tests;
  - a confirmation when `?edit=` is removed with unsaved changes;
  - a consistent domain-admin scope in mocks;
  - loading and error states.

## Remaining (below HIGH)

- **MEDIUM:** FR-063 and US8 acceptance scenario 1 are partly blocked by audit details being
  undocumented (API gap G3, which API 002's implementation fixes in `docs/audit-events.md`).
- **LOW:** SC-002 parity needs a mailcow host (T108). SC-007 in cs and sk rests on `i18n:check`.

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`: G3, G28 (footer summary on `Domain`), G29 (template
defaults in capabilities) and G30 (bulk deletion preview).

## Orchestrator decisions on owner questions

1. The conventions and the contract supersede the two earlier clarification answers (one request
   per domain without tags, and an acknowledgement instead of a typed count). The spec keeps them
   visible, with a dated alignment note.
2. A coverage manifest scopes translation checks to delivered values.
3. The pin is the API 002 release tag if present, otherwise the first commit whose API 002
   quickstart Part A passes.
