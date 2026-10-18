# Analysis: UI feature 006 Quarantine, spam policy and rate limits

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

86 FRs, 11 SCs and 57 acceptance scenarios all map to tasks. No CRITICAL findings.

**HIGH, fixed:**
1. Cross-page selection contradicted the conventions. The spec is aligned to page-only selection.
2. FR-066 needed undocumented audit `details` members. It now shows details as stored until
   `docs/audit-events.md` documents them.
3. SC-008's outdated-save check was untested for the spam score and rate limits (T081, T098).

**MEDIUM, fixed:**
- typed counts for bulk deletions;
- all five bulk outcomes listed;
- the statistics counting period;
- tests for a withdrawn permission, a 100-item bulk run, a store `503`, and the parity run;
- an import cycle removed;
- debounce figures corrected;
- raw U+202E characters in the docs replaced with visible notation.

## Remaining (below HIGH)

- **MEDIUM:** "Remove hash" on the rate-limited log is delivered by UI 011.
- **MEDIUM:** a typed presentation of audit details waits for API 006 to document its keys (G3).
- **LOW:**
  - the naming "Remove hash" versus "Reset rate limit";
  - FR traceability through scenario IDs;
  - the mailbox route parameter `:address` versus `:mailbox` (harmless);
  - T010 and T011 resolve earlier features' file paths.

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`: G3 and G15 (allow/block list audit records target
the owner).

## Orchestrator decisions on owner questions

1. No template preview. Spec FR-063 says the template is never previewed.
2. The owner reviews the new cs-cz and sk-sk strings before release (T141 lists them).
