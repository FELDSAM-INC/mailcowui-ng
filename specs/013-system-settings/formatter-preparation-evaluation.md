# Authenticated-bootstrap formatter preparation: rejected candidate

2026-10-21. This bounded experiment used baseline `19af02f7` in a private worktree. It did
not change main, release gates, API behavior, language resolution, or the loading UI. The
candidate production and test changes were removed after evaluation; its patch remains with
the evidence for reproduction.

The Domains CPU profile identified one 57.2 ms first `Intl.NumberFormat` construction during
rendering. The candidate prepared the same cached default formatter in a task after `/me` was
dispatched, only for active or restricted sessions. A remembered/default language was a cache
hint; the existing server and profile language rules remained authoritative. Bootstrap did not
await preparation, and cancelled queued preparation on completion or failure. Anonymous
startup did no preparation.

## Matched cold content timing

There were three alternating baseline/candidate pairs per page, each in a fresh Chromium
process: 24 launches, no trace or screenshots, 4× CPU slowdown, 150 ms network latency,
1.6 Mibit/s downlink, 750 kbit/s uplink, and a 360×780 viewport at device scale factor 3.
Each run verified the expected entry asset. Readiness required the real host and container
data, 25 domain/alias entries, or usable sign-in controls, followed by two animation frames.
FCP was recorded separately. Values below are medians in milliseconds.

| Page | Content ready, baseline | Content ready, candidate | Difference | FCP, baseline | FCP, candidate |
| --- | ---: | ---: | ---: | ---: | ---: |
| System & Containers through `/` | 3631.1 | 3563.5 | -67.6 | 3176 | 3140 |
| Domains | 3762.9 | 3688.4 | -74.5 | 3108 | 3092 |
| Aliases | 3789.7 | 3683.3 | -106.4 | 3140 | 3132 |
| Sign-in | 2565.3 | 2575.2 | +9.9 | 2568 | 2576 |

Both lists were faster in all three paired content samples. The sample is small and individual
deltas varied substantially; it does not establish the same benefit on other routes. FCP gains
were smaller and inconsistent between pairs.

## Unchanged Lighthouse settings

The candidate ran three collections for each of four URLs with the repository's existing
mobile settings and every default audit. Both baseline and candidate used Lighthouse 12.6.1
and Headless Chrome 156. The baseline was the earlier exclusive `19af02f7` collection; it was
not recollected alongside the candidate. The API invocation's report channel/output differed
(`node`, JSON and HTML versus `cli`, JSON); emulation and throttling settings were identical.

| Page | Baseline performance | Candidate performance | Baseline median TBT | Candidate median TBT |
| --- | --- | --- | ---: | ---: |
| `/` | 80, 80, 80 | 79, 79, 80 | 130.5 ms | 141.0 ms |
| Domains | 77, 78, 77 | 75, 78, 79 | 257.5 ms | 246.2 ms |
| Aliases | 76, 74, 73 | 78, 76, 76 | 367.0 ms | 304.6 ms |
| Sign-in | Not collected in this baseline archive | 87, 86, 87 | — | 175.5 ms |

Candidate accessibility was 99–100. The initial JavaScript budget passed at 189,584 of
204,800 gzipped bytes. The candidate did not clear the performance gates.

## Decision and evidence

Reject the broad bootstrap scheduling. The modest data-page improvement does not justify
initializing numbers for every active/restricted session: mailbox Password and forced-action
routes can incur that work without displaying numeric data. Those routes were not measured
in this bounded comparison. A future alternative would need to follow an actual numeric
list consumer and overlap its real pending data read, without charging unrelated routes.

Before evaluation, 26 focused formatting/bootstrap tests, semantic typechecking, scoped lint
and formatting, the production build, and the bundle budget passed. Tests covered cache reuse,
separate locale/options, actual `/me` dispatch before preparation, profile language precedence,
anonymous exclusion, and cancellation after fast startup. No candidate code was merged.

Evidence lives in the API repository under
`storage/app/restart-2026-10-20/settings-integration/formatter-preparation-19af02f7/`:

- `candidate.patch` and `comparison.cjs` reproduce the rejected candidate and runner.
- `reports/timing.json` contains every cold sample, API resource timing and observed long tasks.
- `reports/lighthouse.json` and the individual JSON/HTML reports contain all 12 collections.
- The unit, typecheck, lint, formatting, build, budget and measurement logs are retained beside
  the reports.

The earlier Lighthouse baseline remains in the adjacent `lighthouse-19af02f7-startup/` archive.

## Source-only assessment of a narrower alternative

Both list pages have a possible overlap window: their `useQuery` starts the list read during
setup, while Domains' `countText` and the lists' numeric pagination are only rendered after
initial loading. A page-opted-in composable could queue the real default formatter immediately
after query creation, only while `isPending && isFetching`. It would use the active locale,
which bootstrap has already resolved, and cancel the task when the read settles, the locale
changes, or the page's scope is disposed.

That scope would exclude Password, forced actions, sign-in, the dashboard, cached list visits,
background refreshes, and offline-paused reads. It should not attach to API query factories or
introduce a whitelist of benchmark URLs. A slow empty/error response could still make the
preparation unused, since its outcome is not yet known; this is a limited remaining cost.
This alternative was assessed from source only. It has not been implemented or measured.
