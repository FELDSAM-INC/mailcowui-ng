# Settings discovery follow-ups — 2026-10-21

## Section-fragment focus (T044/T047)

The existing Password Settings reset-email deep link now focuses the section heading, including
on an initial visit and when the section's data arrives later. A MutationObserver waits at most
three seconds; a missing or malformed target falls back to the ordinary page heading. Hash-only
navigation is handled, while query-only updates preserve the current control. Navigation and
user interaction cancel a pending wait. Fragment values are decoded safely and resolved as ids
inside main, never interpolated into CSS selectors. Scroll restoration remains authoritative;
other targets use native scrolling with the shell's existing sticky-header padding.

- The new regression initially failed six of eight cases. Final router suites: **18/18 passed**.
- Browser checks: **6 distinct executions passed** across mobile Chromium, desktop Chromium and
  mobile WebKit. Initial three failures were a keyboard assertion that skipped the existing
  History link before Edit; correcting that test produced **3/3** on the affected rerun without a
  product change. The checks cover delayed reset-email redirects, focus and header visibility,
  sequential keyboard access, missing-fragment fallback and normal navigation.
- Full typecheck, scoped lint, Prettier, production build and bundle budget pass. Logs are
  `/tmp/u013-focus-hash-*.log`. Browser logs and traces are in
  `/home/feldsam/Projects/mailcow-rest-v2/storage/app/restart-2026-10-20/u013-discovery/`.
- No settings writes or API mutations were needed. The user's grouped sidebar and shared tabs
  are unchanged; this fills the remaining deep-link accessibility behavior.
