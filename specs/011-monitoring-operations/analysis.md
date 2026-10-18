# Analysis: UI feature 011 Monitoring and operations

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

Every FR (91) and every buildable SC (12 of 13) maps to tasks. SC-013 is a post-launch usability
study.

**Fixed (CRITICAL or HIGH):**
- Four reused legacy keys had changed meaning. They now get new keys (constitution IV).
- Typed presenters were planned on undocumented audit detail shapes. Details are now shown as
  stored (constitution I).
- The CI gates (translation, budget, Lighthouse) are kept green between stories.
- The FR-003 check moved into US1.
- The queue's link to a container card is rendered only once US1's route exists.
- Building blocks are aligned with the canonical names.
- SC-003 has a task (T150).
- The ambiguities in FR-021 and "mid-range phone" are resolved.

## Remaining (below HIGH)

- Oldest-first log paging may skip entries when mailcow trims the log (API gap G6).
- History details show raw keys and values until `docs/audit-events.md` documents them (G3).
- The names of UI 002, 003, 006 and 008 parts come from their plans. T001 checks them.
- SC-003 needs a mailcow host.
- **LOW:**
  - FR-090 is asserted for logs only;
  - containers sort by state in enum order;
  - re-check `marked` 18.1.1 at T003;
  - control characters are shown as visible markers while copying stays exact.

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md` as G3 and G6 to G11. Two were declined by the API:
acting on every message that matches a filter, and showing the version to non-admins.

## Orchestrator decision

A bulk queue deletion needs the number of messages typed, per `docs/conventions.md`, which is
binding. "Delete all" keeps its explicit acknowledgement, plus the typed count.
