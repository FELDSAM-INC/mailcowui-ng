# Cross-feature UI conventions

These decisions apply to every UI feature. They were collected while UI features 001–014 were
being specified. A feature spec governs its own screens. Where a spec is silent, or contradicts
another UI spec, this document applies, and the next change to that spec aligns it. Every plan
reads this document next to the constitution. The API side has its own rules in
`../mailcow-rest-v2/docs/conventions.md`.

## Wording

- User-facing text calls the legacy UI **"the classic interface"**: "klasické rozhraní" in Czech,
  "klasické rozhranie" in Slovak. It is never called "legacy".
- FIDO2 credentials are called **passkeys**.
- The legacy name of a screen is kept where that lets existing translations carry over, for
  example "Sender-dependent transports" (UI 009).

## Lists

- List state (search, filters, sort, page, page size) lives in the page address and never in
  browser storage.
- Page sizes are 25 (the default), 50 and 100.
- Lists become cards below the tablet breakpoint and tables on wide screens.
- Every list has loading, empty and error states.

## Bulk actions

- Bulk actions need an explicit selection mode, and the selection covers the current page only.
  It clears when the page, search, filters, sort or page size change.
- The UI sends the API's bulk operation (up to 100 items) together with each item's version tag
  as listed.
- It shows a summary with one result per item. Failed, refused and outdated items stay selected,
  so they can be retried.
- A dropped connection is reported as "outcome unknown" and is never retried automatically.

## Editing and conflicts

- Detail screens are split into sections, each with its own edit and save.
- A save sends only the changed fields, plus the version tag that was read.
- When a save is refused as outdated:
  - the user's input is kept, the object is reloaded and the values that changed are marked, and
    the user saves again;
  - there is no automatic merge and no "overwrite anyway";
  - a refused deletion is confirmed again.

## Confirmations

- Deleting a single object needs a dialog that shows its impact, using the API's delete preview
  where one exists.
- Deleting one domain needs its name typed.
- A bulk deletion needs the number of objects typed.
- Other destructive or high-risk actions (deactivating, stopping a container, mass mail and so
  on) need one explicit confirmation.

## Secrets

- A generated secret is shown once, in a dialog with a copy button. This covers API key secrets,
  app passwords, OAuth2 client secrets and one-time sign-in links.
- Closing the dialog without copying asks for confirmation.
- Secrets never go into storage, the page address or browser history.
- Stored secrets are write-only:
  - the field starts empty and says whether a value is stored;
  - leaving it empty keeps the value, and typing replaces it;
  - an explicit action removes it.

## History and audit

- Objects get a **History** action that opens UI 001's audit log screen, filtered to that object
  by target type and target ID. That screen offers these filters.
- Each feature adds labels and translations for its own audit event types to the audit log
  screen. Unknown event types show a generic label.

## Errors and permissions

- API problem types and per-field rule codes are translated in the UI, because the API never
  localises them.
- Field errors are shown on their fields.
- Controls the caller may not use are hidden or shown read-only with the reason. This is a
  convenience only: the API enforces permissions.

## Where features meet

- A later feature adds its entry points into earlier features' screens when it is implemented,
  through each screen's designated action areas. Examples:
  - UI 004 adds the "Send as" link to UI 003's mailbox detail screen;
  - UI 007 adds "Sign in as" and "Open webmail as" to UI 003's lists;
  - UI 009 adds the relayhost sections to UI 002 and UI 003 detail screens;
  - UI 010 adds DKIM, MTA-STS and DNS to UI 002 detail screens.
- Until such a feature ships, the earlier screen shows nothing for it: no placeholder, no broken
  link.
- Capabilities and limits (bulk limits, field limits, enabled server features) come from each API
  feature's capabilities read. The UI never hard-codes them.
