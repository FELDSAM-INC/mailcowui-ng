# Resolve shell logo links before navigation

Clicking the logo from an edited Fail2Ban form asked to leave twice: the first component leave
confirmation accepted `/`, then the role-specific root redirect triggered the same guard again.
The extended existing browser case reproduced that behavior on all three profiles.

The shell now gives both logo links the current identity's existing default destination:
administrators open System and Containers, domain administrators open Domains, and mailbox users
open Password. The destination reacts to identity changes. During an unresolved identity switch
it remains `/`. Router, session and leave guards are unchanged; no confirmation is cached or
bypassed. The logo has a stable `data-shell-logo` hook in both layouts, replacing the old test's
assumption that a logo always lives inside the mobile header.

Validation:

- 44 shell/router unit checks pass, including both layouts for all roles, identity changes,
  unresolved identity fallback, and newly required pending actions still enforced by the router.
- The existing Fail2Ban dirty-form case now keeps its Stay/draft assertions and also follows
  one Leave confirmation to the dashboard: three of three profiles pass. The original three
  red duplicate-confirmation results are in `u013-full-browser/app-links-target/green`.
- The final twelve-case browser batch, including the independent assertion corrections,
  passes without retries in `u013-full-browser/logo-landing/browser.log`.
- Scoped lint, fresh test typecheck, production build and bundle budget pass. The private
  baseline build totals 189,721 of 204,800 initial gzip bytes; this is not a performance score.

The broad frozen suite remains a separate baseline with its original failures retained.
