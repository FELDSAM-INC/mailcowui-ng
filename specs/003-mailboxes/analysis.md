# Analysis: UI feature 003 Mailboxes

The plan agent ran `/speckit-analyze` with an independent read-only reviewer and a mechanical trace.
The orchestrator recorded the results here, because the harness would not let the subagent write
this file.

## Coverage

FR 75/75, SC 11/11, acceptance scenarios 61/61, edge cases 26/26.

| Finding | Resolution |
|---|---|
| C1 (CRITICAL): the spec hard-coded the product name ("mailcow's garbage area") | Neutral wording |
| H1: the plan kept outdated bulk items selected, against the spec's clarification | Superseded by an orchestrator decision: the conventions apply, and outdated items stay selected |
| H2: search history replaced the entry, so Back could not restore the previous list | Committed searches use `router.push` |
| H3: "refused" is not an `AuditOutcome` value | "failure" plus the translated reason |
| H4: spec text not aligned with the plan | Aligned |
| H5: deactivating had no confirmation | Confirmation added |
| H6: shared names differed from UI 002 | Canonical names adopted |

All 20 MEDIUM and 19 LOW findings were fixed or accepted.

## Accepted below HIGH

- History shows audit detail values raw until `docs/audit-events.md` documents them (G3).
- The pre-hashed notice is a hint for any `{SCHEME}` prefix until G31 is done.
- The smoke suite is not a merge gate yet (inherited from UI 001).

## API gaps

Tracked in mailcow-rest-v2 `docs/api-gaps.md`: G3, G31, G32 and G33.

## Orchestrator decisions on owner questions

1. The page size is kept in the address only (conventions). The spec is aligned.
2. After a bulk action, failed, refused **and outdated** items stay selected for a retry, per
   `docs/conventions.md`, which is binding and supersedes the earlier clarification.
