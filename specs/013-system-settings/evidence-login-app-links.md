# Login page and App links implementation evidence

Scope: UI013 US4, T077–T085. Routes are `system-settings-sign-in-page`
(`/system/customize/login-page`) and `system-settings-app-links`
(`/system/customize/app-links`). Both are administrator-only siblings of Logos and
UI texts under the existing Customize tabs. No sidebar or topbar layout changes.

The login page retains the classic checkbox order: hide mailbox-user link, hide
domain-administrator link, hide administrator link, then force single sign-on.
T083's two editable sections preserve those meanings and send only changed fields.
The single-sign-on note reads the public configuration and links to the registered
Identity provider destination. Read state uses text, with demo mode disabling edits.

App links retain classic name, link, user-link and hide-on-login order. The hide
checkbox deliberately inverts `showOnLoginPage`. Optional user links are stored as
null and fall back to Link. Custom entries are saved as one ordered list; built-ins
remain separate and read-only. Read state uses cards below `md` and a table above
it. Editing uses a responsive card per entry, with labelled move and remove actions,
focus restoration and a position announcement. New entries focus their name.

Both pages use the existing versioned settings section and leave guard. Successful
saves refresh public configuration, so the existing sign-in quick links and Apps
menu update without a reload. A stale version keeps the draft until an explicit
Save again; it never retries a write automatically.

Implementation decisions and boundaries:

- T077's handlers and scenarios live in isolated `settings-login-links.ts` modules
  to keep the concurrent Logos/UI texts/Colours work independent. The existing
  `idp-none` scenario is reused, not registered twice.
- T080 specifies `%u` only for User link, so client validation reserves it there.
  The current API accepts that placeholder in either URL. This deliberately stricter
  input guidance follows the approved UI task; stored links remain readable.
- Every existing field/help/action/success text uses its legacy key. Newly authored
  explanations and reorder labels use the English source in cs/sk as the temporary
  fallback authorized by the parent for current settings slices; legacy locale
  values are untouched.
- No new dependency or sanitizer is needed: URLs are validated using the existing
  safe URL boundary, and all names, URLs and previews are rendered as plain text.
- Audit target links belong to the separate root audit integration. These pages
  expose History targets `loginPage` and `appLinks`, with no target ID.

Validation:

- Test-first URL/API tests failed before implementation, then both component test
  files failed because their components did not exist. The final focused unit
  suite passes **26/26** checks in four files.
- **39 distinct browser executions pass** across mobile Chromium, desktop Chromium
  and mobile WebKit. The first matrix passed 33/39; the six failures identified the
  same real axe accessible-name issue. Visible “Move up”/“Move down” text was not
  contiguous in the accessible label. A focused unit regression reproduced it,
  and labels now read “Move up: {name}” / “Move down: {name}” in all three locales.
  The final affected matrix passes **12/12**, including touch/keyboard movement,
  indexed validation, saved removal and explicit conflict retry. Checks include
  light/dark axe, 320/360px reflow, 50-link limits, literal stored names, demo mode,
  transient errors and immediate public-config propagation.
- The isolated local API smoke passes **1/1**: it changes the domain-admin login
  flag through the page, verifies public configuration, restores the original
  value in `finally`, and verifies all four original public login flags. It uses
  API18580 through private preview4245; no maildev setting was touched. Containers
  and previews were stopped afterward.
- Typecheck, scoped ESLint, Prettier, i18n and build pass. Final initial JavaScript
  is **186,730/204,800 bytes gzipped**. Existing untranslated audit/problem coverage
  warnings belong to the separate root audit integration.

Artifacts:

`/home/feldsam/Projects/mailcow-rest-v2/storage/app/restart-2026-10-20/u013-login-links/`
contains `browser.log`, `browser-final.log`, `smoke.log` and their result folders.
The initial failing axe traces are retained for review. Static logs are
`/tmp/u013-login-links-{types-final,lint-final,i18n-final,units-final,build-final,budget-final}.log`.

This covers T077–T085. Task checkbox changes are left to root to avoid conflicts
with concurrent UI013 story integration.
