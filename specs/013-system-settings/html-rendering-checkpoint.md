# HTML rendering checks

ESLint rejects `srcdoc` property access, object properties, `setAttribute` calls and Vue
attributes/bindings. It also rejects `document.write`/`writeln`, including explicit window,
iframe and owner-document access. The rules apply to application sources, tests and scripts.
`vue/no-v-html` remains enabled; only the existing sanitizing component has a local exemption.
This is a static check of explicit sinks, not a general dynamic data-flow analysis.

The 21 focused checks exercise the repository ESLint configuration on unsafe fixtures and
allow DOM text construction used by email previews. A source scan confirms the only `v-html`
attribute remains in `SanitizedHtml.vue`. Focused tests, scoped lint, formatting and a fresh
app/test typecheck and full repository lint pass.
