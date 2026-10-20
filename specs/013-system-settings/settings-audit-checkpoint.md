# Settings audit checkpoint

The audit log labels all 22 settings event types and 17 target types in the pinned API.
The earlier plan count of 21 omitted `passwordPolicyUpdate`. Known details show field labels,
old → new values, binary sizes for content changes, logo metadata, Dovecot restart outcomes,
Rspamd confirmation, mail-job counts and license results. Passwords and large text are reduced
to change/size summaries even if an incompatible server includes their contents. Unknown
detail members retain the generic plain-text renderer and control-character markers.

Singleton targets now link to their settings pages without requiring a target ID. Rules,
maps, jobs and quota-copy recipients keep their individual IDs. The existing route-existence
check suppresses links to pages not yet registered. Deleted targets are not linked. All 17
target types are offered by the existing enumeration-derived audit filter.

The Global Filter Maps list gains History in addition to each map's existing History link.
The browser table verifies the current maps, rules, quota, password, IP-check and Sieve pages;
full T161/T164 coverage will be extended as Customize, System mails, CORS and License land.
Quota-copy administrator/domain-administrator visibility is already covered by the quota
checkpoint and is not duplicated here.

New event, target and detail copy uses English source fallbacks in cs/sk. Existing target
names and sender/subject/description/active labels use verified classic-interface translation
keys. These source fallbacks are not claimed as reviewed Czech or Slovak translations.

Validation:

- 95 audit unit tests passed across 11 files, including the new settings formatter cases.
- All 15 distinct browser cases pass on mobile Chromium, desktop Chromium and mobile WebKit.
  The first run passed 11/15; a screen-reader prefix required a marker locator and the WebKit
  accessibility scan required scrolling the sticky-header page back to its top. The six
  affected browser executions then passed. No product behavior changed for those assertions.
- Fresh app/test types, scoped lint, formatting, i18n completeness, production build and
  bundle budget passed. Initial JavaScript is 188,282 of 204,800 bytes gzip at this checkpoint.
- Local audit smoke passed 1/1 using the event saved by the reversible Customize smoke,
  verifying the real product-name change, target filter, old/new values and timestamp without
  another settings write. Initial test assumptions about an unsupported request-ID URL filter,
  the event label and timestamp precision were corrected; their failed runs are retained.

Evidence: `mailcow-rest-v2/storage/app/restart-2026-10-20/settings-audit/`.

T160, T162, T163 and T165 are complete here. T161, T164 and T166 remain open for the full screen
catalogue.
