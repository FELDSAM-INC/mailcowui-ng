# Analysis: UI feature 005 Account self-service

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

All 68 acceptance scenarios have end-to-end tests. 123 of 124 FRs have tasks; FR-096 is out of
scope by design. The moderated SCs are checked by hand (T152). No CRITICAL findings.

**HIGH, fixed:**
- two legacy keys the spec reuses were mapped by no task;
- the reset token's exposure in logs and history: `#token=` is now accepted, and the image does not
  log the query string (T154);
- `data-model.md` contradicted FR-004 on read-only mailbox sections;
- FR-006 clashed with sections that share one address;
- request-side secrets went through the mutation cache. They now use `useSecretRequest`
  (convention).

**MEDIUM, fixed:** explicit tests for FR-010, FR-011, FR-015 and FR-123, multi-role coverage, and a
checkpoint contradiction.

## Remaining (below HIGH)

- Bulk TLS (T107) depends on API gap G22, which API 005's implementation fixes first.
- The UI 003 action-area paths depend on UI 003's implementation.
- FR-014 versus FR-015 for the Pushover switch.
- FR-008 cannot be checked automatically.
- The recent-login service filter values (G24).

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`: G22 to G27. AG6 (per-object history granularity) is
covered by G3 and G15.

## Orchestrator decisions on owner questions

1. A signed-out bookmark of `/ng/` counts as the front door, so it forwards to webmail. Any other
   address is a deep link.
2. Bulk TLS ships, because API 005 fixes G22 before UI 005 is implemented.
