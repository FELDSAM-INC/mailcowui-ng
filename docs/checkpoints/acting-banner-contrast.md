# Acting banner contrast regression

The frozen full-browser run at `19af02f7`, shard12, found the desktop persistent-banner flow
rendering the label and role in the light foreground (`#7a2e0e`) on the dark background
(`#4e1d09`). Those nested spans inherited their colour through the name button; the username
and domain already used the semantic foreground directly.

The label, role and expanded name now also apply `text-acting-fg` directly. The existing light,
dark and brand tokens are unchanged. This is a three-class correction in `ActingBanner.vue`.

The original failing flow was rerun unchanged against the private build from `af8c4d22` plus
this fix. All three profiles pass, with two workers and zero retries: mobile Chromium,
desktop Chromium and mobile WebKit. The flow retains every light/dark and saved/limit palette
axe analysis, the persistent banner across restricted pages, touch targets, reflow and return
to the original filtered list. The existing component test, scoped lint, formatting and build
also pass.

Original failure: API workspace `storage/app/restart-2026-10-20/u013-full-browser/shard-12/`.
Correction: `storage/app/restart-2026-10-20/u013-full-browser/acting-contrast/` (3/3,45.6s).
Static logs: `/tmp/u013-acting-contrast-{format,lint,units,build}.log`.
The private browser container and ports4090/4256 were stopped after verification. The frozen
checkout and its original failure remain unchanged.
