# Freshness and individual History targets — 2026-10-21

The effective-map flow now verifies real in-app navigation with Date held inside the query's
30-second freshness window. Returning before a write reuses the cached map. Saving an active
rule invalidates that cache; returning then makes exactly one new read and displays the changed
rule content. No full document navigation or elapsed freshness window can make this test pass.

This flow exposed inherited light-theme text on WebKit after repeated navigation and theme
changes. Rspamd list/filter labels, return links, the Active checkbox label and preset summaries
now apply their light/dark text colours directly. Existing form submission, presets and cache
invalidation did not need changes. The initial Chromium failures were a test locator that omitted
the rule description from the Edit link's accessible name; that locator is corrected.

The remaining individual-resource History checks cover rule ID, completed job ID and quota-copy
domain. Each follows the actual link and verifies both the browser address and every Audit Log
request's target type and ID. The source and destination retain the four-palette accessibility,
reflow and touch-target checks. Existing password-reset and domain-administrator quota checks
continue to cover the consolidated reset section and absence of History for that role.

Validation:

- All **12 new browser executions pass** across mobile Chromium, desktop Chromium and mobile
  WebKit: nine individual History checks and three map-freshness checks. Three existing preset
  insertion/confirmation checks also pass on the final build. All runs used zero retries.
- The first run's three failures and the second run's remaining WebKit failure are retained.
  The second run supplied the nine History passes; the final run passed all six freshness/preset
  executions. These complementary results are not a claim that one command ran all 15 checks.
- App/test types, scoped lint/formatting and production builds pass. No API writes or real mail
  were needed: all writes in these flows use the contract-validated mock.

T173 is complete together with the existing Customize cache/shell-refresh, password-policy
consumer and job-refresh evidence. A source audit finds `MassMailJobPage` as the only settings
page with a periodic query; existing job tests cover hidden, idle, unmounted and completed states.
T161/T166's combined catalogue release results remain with the ongoing frozen browser inventory.

Evidence in the API workspace:
`storage/app/restart-2026-10-20/u013-effective-map-freshness/` and
`storage/app/restart-2026-10-20/u013-settings-freshness-history/`.
