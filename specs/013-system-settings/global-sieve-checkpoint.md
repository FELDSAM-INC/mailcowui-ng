# Global Sieve filters checkpoint

US9 adds independently editable pre-filter and post-filter scripts with server validation,
line navigation, byte limits, and a single confirmation offering restart now or apply at the
next restart. An empty script is explained before saving. The UI distinguishes successful,
failed, and deferred restarts; a failed restart does not claim the saved script was rolled
back. Missing files and stale versions preserve the draft. A stale save reloads the current
version and requires explicit Save again and a new restart choice.

The existing Filters sidebar entry now has Filters and administrator-only Global Sieve
filters tabs. This keeps the requested sidebar groups and shared Routing-style tabs; it does
not add a sidebar entry. Each script has its own filtered History link. No Sieve examples are
offered here, completing the global-filter part of T108.

Plan deviation 11 uses the specified FR-070 restart choice under the user's instruction to
continue the remaining features. This is an implementation decision, not a claim of a new
owner approval or a change to the API. New `systemSettings.globalSieve.*`, the mail-filtering
group name, and `nav.globalSieve` have explicit English source fallbacks in cs/sk pending
wording review. Existing validation/save/outcome labels reuse legacy translations.

Parser messages are quoted as text; control/bidi characters become visible code-point
markers. Scripts are kept in memory, with unsaved-navigation guards and no automatic restart
or retry. Check sends `validateOnly=true` and cannot store or restart anything.

Validation:

- 80 focused unit tests passed (including navigation, API contracts, restart-choice defaults,
  quoted parser messages, refusal/cancel behavior, byte limits, and restart outcome messages).
- All 24 browser executions passed on mobile Chromium, desktop Chromium and mobile WebKit,
  including both themes' axe checks, 320px reflow, touch targets, oversize rejection, navigation
  cancellation with both scripts dirty, stale versions, missing files, and role denial.
- Local read/validate-only smoke passed 1/1 for both scripts. The isolated stack had no script
  files, so two exclusively created temporary fixtures were used and removed in `finally`.
  Contents and ETags stayed unchanged; no save or restart was allowed by the smoke test.
- Fresh app/test typecheck, scoped lint, formatting, i18n completeness, production build,
  and bundle budget passed. Initial JavaScript is 186,958 of 204,800 bytes gzip.

The first browser run found a missing button-variant argument; component tests reproduced it
and the rerun above passed after the fix. The large-editor latency gate remains tracked by
its separate checkpoint. New fallback strings are not claimed as reviewed translations.

Evidence: `mailcow-rest-v2/storage/app/restart-2026-10-20/global-sieve/`.

