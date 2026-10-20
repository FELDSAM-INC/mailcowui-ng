# Settings integration checkpoint

This batch combines Customize logos/UI texts, System mails, CORS, License, settings audit
details and the lazy editor for initially large global filter maps. The requested sidebar
destinations now all open implemented pages. Customize's Colours and Login page/App links
are still separate work in progress at this checkpoint.

CORS opens from API Keys and keeps Access → API Keys selected. License opens from System &
Containers and keeps that existing tab selected. Its link appears only when settings
capabilities enable it. Non-administrator dashboards make no settings-capability request;
the dashboard never reads the license status just to decide whether to show a link.

History checks now include Customize logos/UI texts, the System mails list, CORS and License
alongside the earlier settings pages. Singleton audit targets link only when their route is
registered. The account performance collection follows the direct Password destination, and
Lighthouse now also collects Customize → UI texts under the existing 80 performance / 90
accessibility thresholds.

Integrated verification:

- Fresh combined app/test typecheck passed. Full lint found one obsolete type assertion in
  the editor timing test; the corrected file and the new integration tests pass scoped lint.
  Formatting, i18n completeness, production build and bundle budget pass.
- All 646 distinct unit checks pass across the selected settings, audit, dashboard, navigation,
  shell, editor, security and limits suites. The first combined run passed 644: one navigation
  assertion still treated the newly available System mails entry as pending, and a 50 ms
  map-diff timing check exceeded its limit under parallel CPU load. The updated navigation
  suite passes 3/3 and the unchanged map-diff suite passes 5/5 in an isolated one-worker run.
  An earlier integration run also exposed a unit test that did not await the lazy user menu;
  its corrected focused suite and the combined run pass.
- All 30 integrated browser executions pass across mobile Chromium, desktop Chromium and
  mobile WebKit, with zero retries. They cover extended History links and safe details,
  keyboard entry to CORS/License, disabled-license no-request behavior, public branding
  refresh, mock recipient preview/confirmation and failed editor-download recovery.
- The component checkpoints separately cover 78 Customize, 48 System mails and 39 CORS/License
  browser cases. Real isolated-API checks passed for reversible branding, preview-only System
  mails, reversible CORS, read-only License and the real UI-text audit event. Original settings
  were restored, and no real mail job or external license verification was requested.
- Initial JavaScript is **188,491 / 204,800 bytes gzip**. The large-map editor remains lazy;
  its failed download can fall back to the already loaded native editor with the full draft.

Lighthouse collection is the next release check; its scores will be recorded separately.
The independent cold-first-key WebKit editor latency gate remains open. Newly authored cs/sk
copy retains the documented English source fallback. This checkpoint does not claim physical
device, IME or manual screen-reader validation.

Evidence: `mailcow-rest-v2/storage/app/restart-2026-10-20/settings-integration/` and the component
checkpoint paths recorded in the same feature's documentation.
