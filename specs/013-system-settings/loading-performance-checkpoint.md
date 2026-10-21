# Settings loading performance checkpoint

The first combined 23975541 Lighthouse collection passed accessibility (99–100) but failed
performance on several pages. Its largest layout shifts came from the announcement loading
above already-rendered content and the root bookmark mounting a loading page before redirecting
to the administrator dashboard.

The announcement is now part of the initial shell. The session guard resolves the role-specific
root destination before navigation completes; requested deep links still take precedence.
Route registration imports each feature's route definitions directly, keeping unrelated feature
API/composable exports out of the startup graph.

The root Lighthouse scenario now seeds monitoring data for System & Containers. The old
Home-only script-transfer assertion no longer applies to that dashboard destination; it uses
the direct dashboard's checks and per-chunk budget. The shared initial JavaScript ceiling stays
204,800 bytes gzip, and performance/accessibility thresholds remain 80/90 everywhere.

Verification so far:

- 73 router/shell checks pass, including all three role destinations before the first completed
  navigation. Scoped lint, formatting and production build pass.
- Initial JavaScript after narrowing route imports: 187,389 / 204,800 bytes gzip.
- The announcement/redirect diagnostic reduced layout shift to roughly 0.006–0.018 from up to
  0.743. Sign-in scored 83–87 with accessibility 100. Dashboard and Domains remained below 80
  during concurrent browser work, so the performance gate remains open pending a quiet complete
  collection. No performance threshold was reduced.
- HTML rendering enforcement also passed full repository lint and 21 focused checks.

Evidence: `mailcow-rest-v2/storage/app/restart-2026-10-20/settings-integration/` contains the
initial and diagnostic Lighthouse reports, including failures. The final release checkpoint
must record the complete collection's outcome; this document does not claim deployment.

## Quiet combined baseline and rendering follow-up (2026-10-21)

The complete quiet collection on pushed `62b9e988` ran all eleven URLs three times while other
agents' browser, build and typecheck jobs were paused. Accessibility passed at 99–100. Performance
still failed on Domains (71–73), Aliases (72–76), Mailboxes (76–77), relayhosts (77) and Quarantine
(77). Sign-in scored 85–87, Password 80 and UI texts 81–82. Root/dashboard and DKIM had individual
runs below 80, although their best runs reached the configured assertion's threshold. The gate is
still open; this is not a passing release collection.

A separate CPU profile identified the sticky header's synchronous geometry read during mount.
The header now uses the border-box size supplied by ResizeObserver, keeping the existing CSS
height fallback until the first notification. Dropdown content creates its portal machinery on
first opening and keeps it thereafter, preserving Reka's closing animation and focus lifecycle.
These changes need a fresh quiet performance measurement before any improvement is claimed.

- 33 focused shell/dropdown units pass, including first keyboard opening, Escape/focus return,
  initial-open/force-mount behavior and observed header dimensions. A partial ResizeObserver
  test fixture was completed after TypeScript rejected it; fresh test types then passed.
- 25 distinct browser executions pass across the three profiles, with zero retries; two
  desktop-only rail executions are intentionally skipped on mobile. The first run passed 19,
  exposing a stale assertion that Options still contained a disabled tab and a real selected-
  language contrast defect in dark mode. Options now verifies every destination is a link.
  The selected language supplies its theme-specific foreground, and its checkmark inherits the
  row's text colour. The six affected checks pass on the final build, including the four-palette
  accessibility fixture. Keyboard menus, section History, tabs and sidebar regressions pass.
- Scoped lint/formatting, production build and bundle budget pass: 189,170 / 204,800 bytes gzip.

The complete baseline reports and scores are archived under
`mailcow-rest-v2/storage/app/restart-2026-10-20/settings-integration/lighthouse-62b9e988-quiet/`.
CPU-profile evidence is in `/tmp/ui-settings-startup-profile/`; browser logs are
`/tmp/ui-settings-shell-render-browser.log` and `/tmp/ui-settings-language-tabs-final.log`, with
failure and final artifacts preserved under `/tmp/ui013-shell-render-results/`.

## Startup follow-up and current release gate

The quiet three-URL comparison on `593d85a2` did not establish a performance win:
root scored 79/79/77, Domains 76/73/73 and Aliases 75/73/71. Accessibility remained
99–100. The reports, including failures, are preserved in
`settings-integration/lighthouse-593d85a2-render/` under the API evidence directory.

Startup now begins the identity read as soon as the session response allows it, while public
configuration can still be loading. CSRF remains first; applying preferences and mounting the
route still wait for both reads. A delayed-configuration regression verifies that identity can
finish independently without declaring bootstrap ready early.

Confirmation, idle-warning and mobile-navigation hosts now mount on first use and stay mounted
afterward for closing/focus handling. Their imports remain static: an experimental lazy-import
version passed interaction checks, but review identified an offline chunk-failure risk that
could leave a confirmation promise pending or hide an idle warning. That version is not shipped.

The integrated startup/loading/focus changes pass 40 focused units, app and test types, scoped
lint, production build and the bundle budget (189,569 / 204,800 bytes gzip). All 18 integrated
browser executions pass across the three profiles, with zero retries: first drawer opening,
keyboard navigation, confirmation cancel/focus return, idle warning/stay/expiry, keyboard
settings saves and the short-screen confirmation. Evidence is in `/tmp/ui013-first-use-browser/`.
Quiet performance results for this integration are recorded separately as they finish. The 80/90
Lighthouse thresholds remain unchanged, and no new deployment is claimed by this checkpoint.


The subsequent quiet three-URL collection on `19af02f7` scored root **80/80/80**, Domains
**77/78/77** and Aliases **76/74/73**, with accessibility 99–100. Domains blocking time fell
to 235–268 ms and its LCP was 3.93–4.00 s, but the overall performance gate remains open.
Evidence is archived under `settings-integration/lighthouse-19af02f7-startup/`. The broad
browser regression starts from this frozen functional baseline; subsequent narrow startup
changes receive their own targeted regression and performance measurements.
