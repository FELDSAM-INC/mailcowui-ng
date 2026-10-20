# Customize: logos and UI texts

This checkpoint implements UI013 US2 (T052–T064) under the existing admin-only Options → Customize destination. The child pages use the shared section navigation. Logos precede UI texts; the UI text form retains the classic field order: page title, product name, Apps heading, help, announcement, footer. Colors (US3, T066–T076) remain a separate follow-up.

Logo selection detects content independently of the browser's MIME label, checks the advertised byte and raster limits, and previews only through image elements. The server remains responsible for SVG safety and image decoding. Candidate object URLs are revoked on cancellation, replacement, successful upload and disposal, including an unfinished decode. Upload and deletion send the stored version and explicitly recover from stale versions. Public configuration is refreshed after every successful write.

The UI text sections send only changed fields in a merge patch. Drafts survive temporary errors and version conflicts, and editing is disabled if demo mode becomes active. Empty title/product fields show the deployment defaults returned by the API. Operator HTML uses the same allowlist as its eventual app rendering; the preview explains removed content without altering the saved source. Announcements remain plain text and a null type uses the contract's neutral style. Preview collapse state never changes the live announcement's visit preference.

## Recorded contract and plan differences

- **T053 / FR-022 deletion preview:** the pinned `LogoSetting` and public configuration expose the current image URL only. While a custom image exists, no operation returns the default image URL. The owner-approved confirmation therefore names the variant, shows the **current image**, and explains that deletion restores the default. After deletion, the app refreshes public configuration and displays the actual returned default. Product code does not invent a default URL. This differs from the original requirement to show the default image *before* deletion.
- The header and sign-in previews use the sizes of the current app (40 px and 48 px), preserving the compact sidebar's 44 px cap. Legacy logo guidance remains verbatim; additional guidance distinguishes the app's sizes and the server's limits.
- The announcement label uses the existing plain-text `admin.text`, consistent with the API and actual legacy rendering. The legacy help and type labels remain verbatim.
- `sanitizeHtmlWithReport` lives in a separate lazy module, so its preview reporting does not become a shell dependency. Its HTML output delegates to the single authoritative sanitizer and is checked against the existing sanitizer vectors.
- Canonical addresses are `/system/customize/logos` and `/system/customize/ui-texts`, preserving the user's requested Options grouping. Audit route names remain `system-settings-logos` and `system-settings-ui-texts`.

## Localization status

Legacy labels, actions and established outcomes come from the installation's translations. New `systemSettings.logos.*` and `systemSettings.uiTexts.*` explanatory keys use English source wording in all three feature message files under the owner's interim authorization. Czech and Slovak wording still awaits human review; this is not a completed translation claim.

## Validation

- Final focused unit run: **272/272** tests across 32 files (settings, branding, shell, identity transitions, navigation and sanitizer regression coverage).
- Typecheck, scoped lint, formatting and i18n checks pass. Build2 passes at **204666/204800 bytes** initial gzip. Active announcements load their component lazily; inactive announcements do not load it.
- First browser run: **59/63**. Three failures were an incorrect sign-in heading assertion; one reproduced an unbounded long-text preview on mobile. The assertion was corrected and previews now wrap inside a bounded, keyboard-scrollable region.
- Final browser run: **78/78**, no retries, two workers, 360px Chromium, desktop Chromium and 360px WebKit. This includes 69 logo/UI-text checks and nine existing live-announcement/collapse regressions, both-theme axe, 320/360 reflow, raw-upload contract validation and CSP assertions.
- Real API smoke: **1/1** on the isolated local u005 stack. Product name changed through the UI, appeared in public configuration/header, and was restored in `finally`. The successful change event was retained for the separate read-only audit smoke; no maildev write or service restart occurred.
- Evidence is under `storage/app/restart-2026-10-20/customize/` in the API workspace. Browser1, browser2 and smoke results are retained separately. Containers and previews were stopped after completion.

T065's shipped logo/text flows are verified by the tests above. The original pre-deletion default-image preview remains the approved contract limitation described earlier. US3 colors and its application-wide palette sweep are outside this checkpoint.
