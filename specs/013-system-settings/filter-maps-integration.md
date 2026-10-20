# Global Filter Maps integration — 2026-10-21

Integrated the versioned map editor with the latest TailAdmin shell, Rspamd rules, Sieve
presets, and quota/password settings. The sidebar Global Filter Maps entry is available.
Lists load lightweight summaries; opening a map fetches its contents. Editing supports
structural checks, server validation, added/removed-line review, explicit stale-version
recovery, and unavailable-file feedback without discarding the draft.

Validation on integrated main:

- 163 focused system-settings/navigation unit tests passed, followed by 24 navigation and
  mailbox-route checks (12 overlap the navigation run).
- 58 browser executions passed across mobile Chromium, desktop Chromium, and mobile WebKit;
  two desktop-only rail checks were skipped on mobile. Coverage includes maps, line layout,
  Sieve presets, encoded mailbox links, shared tabs, page widths, and shell controls.
- Typecheck, focused lint, formatting, i18n completeness, production build, and bundle budget
  passed. Initial JavaScript is 186,865 of 204,800 bytes gzip.
- The map worker's read/validate-only API smoke passed against an absent-only temporary fixture
  in the isolated local stack. Contents and version stayed unchanged; the fixture was removed.

The large-file typing latency target is still open, particularly on WebKit. The editor is
functional up to its size limit; this release does not claim the under-100 ms performance
target is met. New cs/sk map explanations remain documented English source fallbacks.

Integration evidence:
`mailcow-rest-v2/storage/app/restart-2026-10-20/filter-maps/integration/`.
