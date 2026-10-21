# Mailbox Columns menu viewport correction

The frozen full browser run found that the long Columns menu could extend below the viewport,
making Created on unreachable. Its local `70vh` maximum replaced the shared dropdown's maximum
based on the space available around the trigger. Removing that override restores the shared
scrolling and collision behavior; no menu items or column choices change.

The original desktop optional-column/reload test now passes. A new keyboard flow passes on
Chromium mobile/desktop and WebKit at 1366×900, 780×360 and 780×225: End reaches the final Tags
option fully within the viewport, Space changes it, and Escape returns focus to Columns. All
four palette/theme accessibility scans remain enabled at every size. Result: four passes,
two existing mobile skips for the desktop-specific persistence case, zero retries.

Scoped lint/formatting and the production build pass. The initial JavaScript remains within
budget at 189,670 / 204,800 gzip bytes. Evidence is in the API workspace under
`storage/app/restart-2026-10-20/u013-column-viewport/run1/`; the original failure remains in
the frozen browser run's shard 16.
