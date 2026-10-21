# Aliases native containment evaluation

The candidate is rejected. Native `content-visibility: auto` on mobile Alias cards
breaks Back navigation restoration in all three browser profiles. The identical
checks pass against the unchanged control. No performance measurements were run,
and the Lighthouse performance gate remains 80.

## Candidate and control

Both frozen builds use base `b234a18d0defc613bbed242cd0bb0d5014548a6f`.
The only product change is scoped CSS on `AliasCard.vue`: native automatic content
visibility, a remembered intrinsic block size with a 22rem initial estimate, and
`content-visibility: visible` while a descendant has focus. The rule applies only
on screen and only when both CSS properties are supported. All existing DOM,
labels, actions and content remain present; desktop tables are unchanged.

| Build | Entry asset | Initial gzip bytes |
| --- | --- | ---: |
| Control | `index-CznlyNPL.js` | 189,629 |
| Final candidate | `index-DXsSPkj5.js` | 189,630 |

The candidate also adds a lazy Aliases stylesheet of 261 bytes, or 157 bytes gzip.
Both builds pass the existing bundle limits. The candidate patch SHA-256 is
`f9aa317235605de008e2c9b5507678bb9f4658a944d367ac8e39a6729bc75a5f`.

## Correctness results — 2026-10-21

The existing Aliases page unit suite passes **31/31**. Isolated semantic test
typechecking, scoped lint and formatting pass. The corrected browser matrix uses
one worker and zero retries across mobile Chromium, desktop Chromium and mobile
WebKit. It checks repeated scrolling, keyboard operation of the last of 25 cards,
Back restoration, native find, fresh fragment navigation, narrow/landscape
resizing, theme accessibility, immutable row replacement and failed-refresh
retention. WebKit's unsupported Playwright mouse-wheel operation is replaced by
native `window.scrollBy` in its scroll check.

The final candidate passes **12/15** cases. All three failures are the same real
Back restoration defect: after reaching the last card with the keyboard, opening
Edit and returning, the saved row/action is outside the viewport. Screenshots
show earlier rows in place of the previously focused last card. The exact same
three Back checks pass **3/3** against the frozen control. This is not merely a
numerical tolerance failure.

An earlier candidate also failed fresh fragment navigation in WebKit; the narrow
`:focus-within` rule corrected that case. It did not correct the final Back
regression. No custom restoration logic or fixture-size tuning was added to make
the experiment pass.

The matched cold comparison and conditional Lighthouse runs were therefore
cancelled before execution. This checkpoint makes no latency or score claim and
does not close any remaining performance acceptance task.

## Platform rationale and limits

The [CSS containment specification](https://drafts.csswg.org/css-contain/#content-visibility)
requires `auto` content to remain available to find, focus and accessibility.
[Safari 18 introduced support](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/).
Those semantics justify testing the native mechanism; they do not guarantee
application-level scroll restoration when a list is unmounted and recreated.
The control/candidate comparison above is the decisive evidence for rejection.

## Reproducible evidence

The exact candidate patch and tests, build/check logs, browser traces and
screenshots, integrity manifest, and prepared but unexecuted timing runner are
archived in the API repository at:

`storage/app/restart-2026-10-20/settings-integration/alias-card-containment-b234a18d/`

Frozen `dist-control` and `dist-candidate` outputs remain in the private
`013-alias-containment` worktree. Product and browser-test changes remain private;
only this evaluation document is intended for integration.
