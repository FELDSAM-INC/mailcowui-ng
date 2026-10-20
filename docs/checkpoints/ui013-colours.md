# UI013 Colours checkpoint

The Colours page is a sibling under Customize (`/system/customize/colours`, route
`system-settings-colours`), with administrator-only access inherited from SettingsLayout.
It implements US3's colour form and preview, plus the contrast foundation (T013/T026).

Six-digit colours accept either case and an optional `#`, then save as lowercase. Empty values
clear the theme. The capabilities supply the reference surfaces and minimum ratio. Exact WCAG
arithmetic determines whether a colour passes; the displayed rounded value never turns a
failure into an apparent pass. A suggested adjustment preserves HSL hue and saturation and
finds the nearest passing lightness. A failing draft remains visible in the picker and report;
interactive preview examples retain a usable palette until the draft passes.

The two previews explain the API's light-to-dark fallback rule. Saves use partial merge patches,
If-Match, the shared version-conflict workflow, draft retention, demo-mode restrictions and the
leave guard. Successful saves refresh the public configuration and audit queries. The History
link uses targetType=brandColors. No API changes or service restart are required.

Public configuration updates six CSSOM properties on the document root. Semantic accent tokens
apply to primary actions, existing branded links, selected navigation, and checked controls.
Existing native checkbox/radio classes use the same token as the shared primitives. Branded
links have an explicit white/dark reference surface, including on otherwise muted cards, so
colours accepted at the contrast boundary remain readable. Focus and status palettes remain
independent. Missing or null public colours remove the properties and restore built-in defaults.

The shared accessibility fixture checks both saved and limit palettes in both themes and
restores prior properties in finally. The palette sweep covers sign-in, the actual role landing
(System & Containers replaces the removed Home page), domain list/form, mailboxes, aliases,
account, quarantine, administrators, API keys, sync jobs, routing, DNS, operations, identity
provider, OAuth2 apps, audit, spam filter, settings catalogue, Colours and password settings.
The dirty-leave test covers a dialog. Browser fixtures continue to enforce strict CSP.

## Validation

- Focused colour, branding and component tests: **70/70** (16 files).
- Shared problem-formatting regressions: **205/205** (7 files); the two new contrast-message
  checks also pass after the final lint correction.
- Broader shared-component, settings and shell regressions: **432/434**. The two unrelated
  baseline failures were the shell test not waiting for its lazy user menu (already fixed on
  integration main) and a regex diff timing test just over its 50 ms threshold under concurrent
  work (verified separately by the parent with one worker: 5/5).
- Browsers: **159 distinct cases pass** across mobile Chromium (360 px), desktop Chromium and
  mobile WebKit. The full first run passed 146/159; the targeted final rerun passed **15/15**,
  covering all 13 original failures plus the two already-passing WebKit sign-in cases. There
  were no automatic retries. The strengthened shell case also checks actual quarantine
  attachment/hash link colours and contrast in both themes.
- Real API: **1/1** local smoke. It saved light blue with no dark override, checked effective
  public colours, cleared both, and restored/verified the original light and dark values in
  `finally`. No shared deployment was changed.
- Typecheck, scoped ESLint, formatting, translation completeness and build pass. Initial
  JavaScript is **187692/204800 bytes gzipped** for this isolated build.

Logs and browser artifacts are under
`mailcow-rest-v2/storage/app/restart-2026-10-20/colours/` (first matrix, focused red link check,
final retry, smoke and static-check logs). The final frozen output was `dist-u013-colours-2`;
build output is excluded from the commit.

The first browser matrix exposed an actual missing mapping of API insufficientContrast
parameters in the shared formatter. A focused red test demonstrated the missing ratio,
minimum and surface in English and Czech number formatting; the fix passes the existing
problem-formatting regression suite. Three browser selector assumptions were corrected.
A focused browser red check then confirmed that quarantine attachment/hash links still used
fixed blue; their accent tokens and the corresponding recipient/release-note links now follow
the same safe surface rules as other links.

## Localization and release gates

Existing action labels use the installation's translations. New `systemSettings.colours.*` and
`validation.insufficientContrast` wording uses explicit English source fallback in cs-cz and
sk-sk under the owner's interim authorization. Those keys await human wording review; this is
not a completed translation claim.

This checkpoint extends every existing expectAccessible call, but its isolated validation is a
representative palette matrix. T076's whole-repository browser rerun remains an integrated
release gate; this note does not claim that the entire suite has run.

## Task evidence

T013/T026 are covered by the contrast arithmetic and adjustment units. T066 supplies contract-
validated mock GET/PATCH behaviour, including contrast refusals, stale versions and demo mode.
T067–T070 cover the form, persisted shell colours, component logic and representative palette
matrix. T071 extends the shared accessibility fixture; T072 is the reversible real-API smoke.
T073–T075 implement the semantic tokens, runtime public configuration subscription, form and
previews. T076's wording/checks are implemented with the documented localization fallback; its
whole-repository browser requirement remains the integrated release gate above.
