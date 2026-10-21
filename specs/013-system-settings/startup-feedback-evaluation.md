# Static startup feedback

This candidate provides honest feedback while the entry script, bootstrap and
initial route load. It does not change the work required before the real page is
usable. The matched experiment demonstrates earlier feedback, with essentially
unchanged usable-content timing and a lower Lighthouse score. No usable-content
speed improvement is claimed, and the performance gate remains 80. The candidate
remains private pending a separately justified startup improvement.

## Implementation

The initial HTML contains a non-focusable status inside a temporary `main` within
`#app`. Vite substitutes the exact existing English snapshot value
`datatables.loadingRecords` (`Loading...`) into the status and initial document
title at build time. Text is HTML-escaped, including markup and replacement-token
edge cases. The status explicitly declares English as its language. The actual
page still uses the installation's translations and resolved user preferences.

Existing external CSS styles the status in the current light or dark theme.
There is no extra request, runtime script, inline style, animation, percentage,
fake page content or forced paint delay. The existing Vue mount replaces all
placeholder children. No role or busy state is put on the persistent `#app`
container. Bootstrap, session initialization and router sequencing are unchanged.

The visible status remains ordinary accessible text with polite status semantics;
automatic announcement of initially present live-region text is not established
by automated checks. Existing bootstrap failures replace it with the recoverable
error page. This change does not add recovery for a failed entry-script download.

## Functional checks — 2026-10-21

- **14/14** focused units pass: snapshot reuse, escaping, build failure for missing
  text/placeholder, safe initial HTML and the existing bootstrap ordering suite.
- Isolated semantic app/test and Node typechecks, scoped lint/formatting, both
  production builds and the existing bundle budgets pass.
- **12/12** production-browser executions pass with one worker and zero retries:
  mobile Chromium, desktop Chromium and mobile WebKit. These prove visible
  feedback while the entry JavaScript is blocked; zero API requests then; only
  CSRF requested while its response is held; both themes and strict CSP; removal
  and real title replacement; sign-in and authenticated focus; the real 25-row
  Aliases list, keyboard navigation and Back focus; and bootstrap 503/retry.

These browser runs took place alongside other functional work and are not timing
evidence.

## Frozen comparison builds

The unchanged control is `c70250b6a7d61b53fb8875c7a56402b34464dcf7` (runtime
`457a241d`). The candidate is `96b9c309ec8b4fb2214470696706f38f9cfb1ce8` and contains
only this static feedback change and tests.

| Build | Entry asset | Initial JS gzip | Entry CSS gzip | HTML bytes |
| --- | --- | ---: | ---: | ---: |
| Control | `index-BsxS_2_P.js` | 189,720 | 22,857 | 1,306 |
| Candidate | `index-BgHVKgEK.js` | 189,693 | 22,887 | 1,524 |

The small JavaScript compression difference follows generated asset references;
no application runtime module was removed. The CSS addition is 30 gzip bytes and
the HTML addition is 218 raw bytes. Frozen outputs remain `dist-control` and
`dist-candidate` in the private `013-startup-status` worktree.

## Matched quiet measurements — 2026-10-21

Six alternating pairs used fresh Chromium processes and disabled browser caches,
the same `aliases-60` fixture, 360×780 viewport, device scale factor 3, 4× CPU
slowdown, 150ms network latency, 1.6 Mi-bit/s download and 750 kbit/s upload. No
other heavy team work ran during the measurements. Every launch verified its
actual entry asset against the corresponding frozen build. There was no tracing,
warm-up or synthetic delay. Content readiness remains two animation frames after
the heading, ready list state and all 25 real entries exist.

| Pair | Control ready (ms) | Candidate ready (ms) | Candidate − control (ms) | Control FCP (ms) | Candidate FCP (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 3637.7 | 3547.5 | −90.2 | 3052 | 892 |
| 2 | 3522.5 | 3547.1 | +24.6 | 3012 | 976 |
| 3 | 3574.3 | 3571.6 | −2.7 | 3044 | 884 |
| 4 | 3527.3 | 3526.2 | −1.1 | 3028 | 888 |
| 5 | 3597.2 | 3568.9 | −28.3 | 3004 | 892 |
| 6 | 3566.3 | 3561.8 | −4.5 | 2992 | 980 |

Median first contentful paint improved **3020 → 892ms**, while median real-list
readiness was **3570.3 → 3554.6ms**. All first-paint pairs improved by 2012–2160ms.
The small readiness difference is not a material content-speed claim. The runner
also records feedback DOM appearance/removal; these are explicitly not paint
timings and are not substituted for FCP.

The following three alternating Lighthouse pairs used the same frozen control
and candidate, in the same quiet window, with the unchanged repository Lighthouse
settings. These use Lighthouse's simulated mobile throttling, so their FCP values
are separate from the directly throttled cold-browser measurements above.

| Pair | Build | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Control | 71 | 2951 | 4015 | 423 | 0.0029 |
| 1 | Candidate | 65 | 2259 | 4170 | 758 | 0.0024 |
| 2 | Candidate | 66 | 2254 | 4148 | 754 | 0.0029 |
| 2 | Control | 71 | 2895 | 4135 | 433 | 0.0029 |
| 3 | Control | 71 | 2940 | 4139 | 406 | 0.0024 |
| 3 | Candidate | 66 | 2297 | 4156 | 703 | 0.0029 |

Accessibility was 99 in every run. Layout shifts were unchanged, and LCP stayed
around four seconds. The score falls because earlier FCP includes more startup
work inside the blocking-time window. This interpretation is consistent with
the unchanged application startup code and the cold runner's whole-startup
long-task evidence: median blocking before content readiness, without an FCP
cutoff, was **581.5 → 572.0ms**; summed long-task duration was **831.5 → 813.0ms**.
These totals do not establish an independent CPU optimization.

The candidate provides real feedback sooner, but **does not clear the 80 gate**.
There was no broad eleven-URL sweep and no threshold change. Further startup
latency work must address the actual work before the real page becomes usable.

Functional logs, all 12 cold samples, six Lighthouse JSON/HTML reports, exact
runner and patch, build identifiers and integrity manifest are
archived in the API repository at:

`storage/app/restart-2026-10-20/settings-integration/startup-feedback-c70250b6/`
