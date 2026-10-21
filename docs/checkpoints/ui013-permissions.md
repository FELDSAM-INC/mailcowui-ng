# UI013 role and capability coverage

This checkpoint closes the remaining T168 assertions against FR-002. It preserves the owner's
grouped sidebar and shared content tabs. No product route, permission or guard changes are made.

The existing story checks remain the evidence for administrator access and operations across
the 16 catalogue destinations (Password Settings contains the reset e-mail section). The shared
`/system` route requires `admin`, inherited by its children. Existing router/role unit tests cover
that mechanism; this checkpoint does not duplicate metadata assertions.

| Capability | Existing evidence | Additional assertions |
| --- | --- | --- |
| Settings pages, administrators only | `navigation/foundation`, `passwords/password-policy`, `server/cors`, `server/rspamd-web-interface`, `spam/rules` and `global-sieve/global-sieve` deny both non-admin roles; Logos denies domain administrators; the original polish case denies newer Customize pages to mailbox users. | `polish/permissions` covers the remaining role/page combinations: UI texts, quota notifications, filter maps and detail, mass-mail compose/jobs/detail, rule creation/detail/effective map, Customize/reset redirects, domain-admin Colours/login/App links and mailbox Logos. Denial must precede every settings, capabilities, preset or mass-mail request; the sidebar offers no settings destination. |
| Quota copies: all domains for admin, own domains for domain admin without a flag, none for mailbox users | `quota/quota-copies` saves for an in-scope domain administrator, refuses an out-of-scope domain, and opens another domain for an administrator. `quota-api` also checks alias-domain rejection. | Save own-domain copies with **every** domain-admin permission flag false, checking the actual write and no settings capabilities request. A mailbox user opening its own domain gets No access, no copies section and no copies read/write. |
| Sieve examples only where the filter editor is offered | `spam/sieve-presets` exercises all eight examples for admin and domain admin with `filters`, and denies global creation without that flag. The original polish case denies both global/scoped creation to mailbox users. | Direct mailbox-scoped creation without `filters` is denied with no form, picker, preset request or creation request. |
| Settings History, administrators only | `quota/quota-copies` verifies admin History and domain-admin absence; `history/history` covers settings target routing. | Denied settings pages and the mailbox domain route have no History; all-flags-off domain-admin copies also have no History. The separate FR-091 target-content requirements are unchanged. |

A separate existing WebKit failure in `mailbox-self-service/filters` inspected `pre` immediately
after a detail link click while the list still contained 20 previews. Its failure snapshot already
showed the correct detail. The test now waits for the requested detail URL and for the list to
unmount before asserting the read-only script. Script content, accessibility and off-scope checks
remain intact; no sleep, retry or product change is added.

The focused browser batch passed **21/21** executions across mobile Chromium, desktop Chromium
and mobile WebKit, with two workers, zero retries and no skips. That comprises 18 permission
executions and the existing filter detail flow on all three profiles. Original frozen broad-suite
results remain separate from this corrected-source evidence.
Scoped ESLint, fresh test TypeScript checking, Prettier and `git diff --check` also pass.

The test-only checkpoint reused the validated `c3e9d8db` production output. Its manifest hash
matched before and after copying and after the browser run:
`48c8b946859d4cfcb6ee6ace2ec57d7424b606dcf57d5f72067fdeaf40d70b25`.
Artifacts are under the API repository's
`storage/app/restart-2026-10-20/u013-full-browser/settings-permissions/` (`results.json`,
`browser.log`, `runtime-copy.txt`). No API settings or production environment were changed.
