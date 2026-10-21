# Queue action accessibility scan positions

The frozen desktop browser suite reported target-size violations after Hold, Flush and an
unknown action outcome. The three failures reproduce against the unchanged runtime. Geometry
attachments show the controls already meet the target requirement: the selection label is
44 × 44 CSS pixels, and Show message links are approximately 87–91 × 44 pixels. The post-action
scroll position leaves those controls partly behind the sticky header (label y = 34–78, or link
y = 21–65).

The three tests now reveal the queue before their final accessibility scan while retaining the
action focus, and explicitly check actual 44-pixel targets. All original light/dark and palette
axe analyses remain. The request-count, outcome, list-refresh and no-automatic-retry assertions
are unchanged. No application code changes were needed.

All nine distinct profile executions pass with two workers and zero retries. The three desktop
red reproductions and geometry attachments remain in `u013-full-browser/queue-targets/red`;
final results are in `u013-full-browser/queue-targets/green/browser.log`. Scoped lint, fresh test
typecheck, formatting and diff checks pass. Original frozen shard17 results remain unchanged.
