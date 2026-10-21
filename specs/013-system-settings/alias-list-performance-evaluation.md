# Aliases shallow-query and first-use filters evaluation

The combined candidate is rejected for now. Its matched cold comparison did not
show a consistent improvement in when the 25-row Aliases list becomes usable.
The candidate remains private; this checkpoint does not change the performance
gate of 80 or close any remaining performance acceptance task.

## Exact comparison

- Control: `68342f9627d40253353db37273f4e7d435091b33`, with entry
  `index-CsPbyN8C.js` and initial gzip size **189,629 bytes**.
- Candidate: `76e73a71ccf16994fcabe802d33d7bdbcd2f1237`, with entry
  `index-DJ_7OpRU.js` and initial gzip size **189,658 bytes** (**+29 bytes**).
- The only candidate changes were local `shallow: true` for the Aliases query
  (`ee489451`, replayed as `e1ab15ac`) and mounting AliasFilters controls on first
  use (`38c3ddcb`, replayed as `76e73a71`). No formatter preparation was included.
- Both builds passed the existing bundle budgets. The combined 36 focused Alias
  unit tests, semantic test typecheck, scoped lint and formatting checks passed.
  These tests cover immutable nested cache replacement updating an existing
  keyed card, refresh failure retaining rows, and filter mount/retention behavior.

## Matched cold result — 2026-10-21

The exclusive quiet window contained six alternating control/candidate pairs,
with a fresh Chromium process and disabled browser cache for each launch. Both
variants used the same `aliases-60` mock fixture, 360×780 mobile viewport, device
scale factor 3, 4× CPU slowdown, 150 ms network latency, 1.6 Mi-bit/s download and
750 kbit/s upload. No tracing, screenshots, synthetic edits or warm-up were used.
The loaded entry asset was verified against the corresponding frozen build in
all 12 launches.

Content readiness means two animation frames after the Aliases heading, ready
list state and all 25 actual list entries are present. FCP was measured separately.

| Pair | Control ready (ms) | Candidate ready (ms) | Candidate − control (ms) | Control FCP (ms) | Candidate FCP (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 3634.2 | 3623.0 | −11.2 | 3076 | 2996 |
| 2 | 3651.8 | 3756.0 | +104.2 | 3060 | 3072 |
| 3 | 3596.0 | 3571.4 | −24.6 | 3068 | 2992 |
| 4 | 3705.5 | 3610.0 | −95.5 | 3108 | 3024 |
| 5 | 3617.7 | 3703.7 | +86.0 | 3064 | 3104 |
| 6 | 3676.3 | 3670.0 | −6.3 | 3152 | 3076 |

Median content readiness was **3643.0 → 3646.5 ms (+3.5 ms)**. The mean paired
change was **+8.8 ms**, while individual paired changes ranged from −95.5 to
+104.2 ms. Median FCP was **3072 → 3048 ms (−24 ms)**. The small FCP improvement
did not produce a coherent usable-content improvement, so it does not justify
retaining the combined complexity as a performance change.

The conditional three matched Lighthouse pairs were **not run** because their
required content-readiness signal was absent. No score from an older baseline is
used for attribution, and this experiment makes no Lighthouse score claim.

## Reproducible evidence

The exact runner, raw samples (including resource timings and long tasks), build
and check logs, candidate patch, full commit identifiers and integrity manifest
are archived in the API repository at:

`storage/app/restart-2026-10-20/settings-integration/alias-shallow-filters-68342f96/`

The runner records the actual throttling rates in bytes per second. Frozen
outputs remain `dist-control` and `dist-candidate` in the private
`013-alias-performance` worktree. The original component changes remain available
for a future separately justified experiment; this result does not establish
their individual performance effects.
