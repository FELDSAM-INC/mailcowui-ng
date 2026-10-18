# Analysis: UI feature 008 Sync jobs

The plan agent ran `/speckit-analyze`. The orchestrator recorded the results here, because the
harness would not let the subagent write this file.

## Result

All 56 FRs, every acceptance scenario of US1 to US6 and the buildable SCs map to tasks. No CRITICAL
findings.

**HIGH, all fixed:**
1. Deactivating without confirmation conflicted with the binding conventions.
2. The first draft used local copies of shared parts and the old i18n check mechanism. It now
   reuses the UI 002 to 006 parts.
3. The inactivity limit is aligned with UI 011: the lower of 15 minutes and the idle timeout.
4. Keeping the selection after a dropped connection differed from UI 002. It is now cleared, as in
   UI 002.

## Remaining (below HIGH)

- **MEDIUM:** naming drift between UI 002 and UI 003 (`coverage.json` versus `enum-scope.json`,
  `useLeaveGuard` versus `useUnsavedChangesGuard`). Resolved by the orchestrator in
  `docs/conventions.md`: UI 002's names win.
- **MEDIUM:** UI 003's action-area table doesn't list UI 008's header action. By convention, later
  features add their entries.
- **MEDIUM:** `useInactivity` is created by UI 008 and reused by UI 011 (convention).
- **MEDIUM:** bulk-limit behaviour. Convention: selection is disabled at the limit, with a message.
- **MEDIUM:** whether browsers really refuse to autofill the remote password can only be checked
  through attributes.
- **LOW:**
  - the rules `required`, `tooShort` and `immutable` are covered by unit tests only;
  - clipboard content cannot be asserted on WebKit;
  - T004 finds the location of UI 006's picker;
  - the estimates.

## API gaps

None open.

## Owner question

Review of the new cs-cz and sk-sk strings before release (owner).
