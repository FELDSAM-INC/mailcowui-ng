# Browser assertions after the account navigation changes

The original frozen full-suite failures remain in `u013-full-browser/shard-11` and
`shard-20`; the tests there were not edited or retried.

- The App links save/reflow case retains its saved-heading focus check, both-theme/two-palette
  axe scans, and width checks. The diagnostic reproduced the original axe failure: the mobile
  section trigger was 328 × 44 CSS pixels at y = −3, behind the 64-pixel sticky header after
  resizing. The test now scrolls the page before the scan without changing focus, verifies the
  actual 44-pixel targets, and exercises the responsive trigger with Enter and Space.
- Passkey-card counts now select list items containing the card heading. Account navigation
  also has list items; those do not represent registered credentials. The shared passkey flow
  helper and secret-storage test preserve their registration, storage, history and secret
  assertions.

Validation: nine distinct executions passed across mobile Chromium, desktop Chromium and mobile
WebKit (App links, unnamed passkey registration, passkey/API-key secret storage). These were part
of the twelve-case final batch in `u013-full-browser/logo-landing/browser.log`, with two workers
and zero retries. The initial App links red reproduction and geometry attachment are in
`u013-full-browser/app-links-target/red`; the first corrected three-profile run is superseded by
the final batch. Focused lint, fresh test typecheck and formatting pass. No runtime behavior was
changed for these test corrections.
