# Analysis: UI feature 010 DKIM, MTA-STS and DNS

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

- Coverage: all 92 requirements and every acceptance scenario of US1 to US8 have at least one task.
  21 requirements are covered only through acceptance-scenario tests. SC-014 (a moderated user
  test) is left to the owner.
- **Fixed HIGH:** the copy-target picker had no loading, empty and error states. It has them now.
- **Fixed MEDIUM:**
  - copy buttons for diagnostics record names;
  - status messages that never time out (FR-074);
  - action bars that stay visible on phones (FR-080);
  - input attributes (FR-081);
  - a cross-screen freshness test (FR-089);
  - a mock scenario that used an impossible status;
  - the copy source;
  - the domain-administrator copy page;
  - search timing aligned with UI 004.

## Remaining (below HIGH)

- **MEDIUM:** the paths of UI 002, 004 and 005 files come from their plans, not from code yet. T001
  verifies them.
- **LOW:** UI 001's spec catalogue still shows one "DKIM, MTA-STS and DNS" row. UI 010 splits it
  in code (T021), and UI 001's spec is aligned on its next change.
- **LOW:** an unknown diagnostics code shows the API's English text, marked `lang="en"`.

## API gaps (tracked in mailcow-rest-v2 `docs/api-gaps.md`)

- G3: the audit `details` keys are documented per event type in `docs/audit-events.md` as each API
  feature is implemented.
- G4: `/capabilities/dns` gains `dkim.bulkLimit`.
- A single key deletion reports its DNS publication outcome only in its audit record (by design).

## Orchestrator decisions on owner questions

1. A bulk deletion needs the number of keys typed, per `docs/conventions.md`.
2. The MTA-STS form pre-fills the server host name from `/capabilities/dns`.
