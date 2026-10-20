# Rspamd UI password checkpoint

This slice implements the Rspamd portions of T147, T148, T152, T154, T155 and T158. The CORS,
license and other US11 work remain open; the grouped task checkboxes do not claim them complete.

The page is a lazy administrator-only route at `/system/rspamd-web-interface`, reached from Access
and the system-settings catalogue. The legacy form map is unchanged: the reported interface link,
Password, Confirmation password (repeat), then Save. Plan D8 has no approval to remove confirmation,
so both fields remain. The optional logo is decorative and stays omitted as the approved plan says.
Show/hide affects both fields, each uses `autocomplete="new-password"`, and both are cleared after
each submitted request and on disposal. Client validation, fields, success and failure announcements
never include the entered value. Requests use the direct client through `useSecretRequest`; no
query/mutation cache or draft contains a password. Quoted text and spaces are preserved exactly.

The service's 204 confirms a password change and Rspamd restart. A 502 says the change could not be
confirmed and the password may take effect at the next start; a 504 says the outcome is unknown and
setting it again is safe. Retry focuses the empty field and requires a newly entered password.
Demo mode applies to branding/IP-check settings only (research R8 and the pinned API), so it does
not disable this operation. The page uses the existing dirty-form leave guard and audit History.

## Interim localization gap

The orchestrator approved explicit English fallback in Czech and Slovak while human wording is
pending (2026-10-20). These five keys have identical English source values in `en-gb`, `cs-cz` and
`sk-sk`; they are not claimed to be translated:

- `systemSettings.groups.spam-filtering`
- `systemSettings.rspamdUi.description`
- `systemSettings.rspamdUi.restarted`
- `systemSettings.rspamdUi.serviceFailure`
- `systemSettings.rspamdUi.outcomeUnknown`

All classic labels and success/validation messages use their original legacy keys at runtime.

## Validation scope

Component/API checks cover input validation, unmodified payloads, role refusals, control characters,
cache/log redaction, outcome handling, retries, concurrent submits, disposal and demo behavior.
The browser matrix covers all three required profiles, both-theme accessibility, reflow, touch
targets, the catalogue/Access entry, history/storage/console secrecy, password-manager attributes,
failure/unknown/network outcomes, leave protection, pending writes and direct role denial.

The real-API smoke is deliberately read/client-validation only. It installs an interception that
aborts any accidental password write; no smoke changes the Rspamd password or restarts a container,
as required by research R31.

Validated on 2026-10-20: 43 focused unit checks, typecheck, scoped ESLint and formatting, i18n key
completeness, production build, and the 202385/204800-byte initial gzip budget passed. All 27 unique
browser cases passed across mobile Chromium, desktop Chromium and mobile WebKit: 24 passed in the
full run, one WebKit case in the focused rerun, and two Chromium cases after correcting test-only
selectors/instrumentation. Chromium does not expose fetch(Request) bodies through Playwright;
the exact quoted/spaced payload is checked in component/API tests and WebKit, with the validated
redacted write checked in every browser. The read/validation-only real-API smoke passed (1/1).
