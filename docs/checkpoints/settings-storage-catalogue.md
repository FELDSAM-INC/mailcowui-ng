# Settings with denied browser storage

T172 now exercises all sixteen consolidated settings destinations with both `localStorage` and
`sessionStorage` throwing `SecurityError`. Cases use real page controls and returned data:
edit/cancel flows, sign-in/IP flags, logo-reset cancellation, a mock license verification, rule/map
search, a map editor, a completed job's outcome filter and compose recipient entry. Each case
checks uncaught page errors, production CSP, contract responses, both-theme/limit-palette axe,
and 320/360px page reflow. Independent cases replace the former four-page representative loop.
The existing mass-mail secret check still follows subject/body/selection through confirmation,
job creation and a fresh compose session. Existing Rspamd secret storage/history/URL tests remain
part of the combined T172 evidence.

The first run passed 45/51. Three logo failures were a new test expectation error: the named
fixture is a 350-byte PNG, not SVG. Three compose failures revealed a real untranslated mobile
step heading whose long raw key expanded the page to 333px at a 320px viewport. The product fix
uses the existing legacy `admin.recipients` label and explicit translated step labels, with unit
coverage of all four steps and Back focus. It adds no width clipping or new translation.

The focused second run passed all nine executions: six previously failing storage cases plus
three enhanced HTML-compose cases. Thus all **51 distinct storage/secret executions pass**;
the second command did not rerun all 51. The three HTML cases belong to T174 and are counted
separately. Both runs used two workers and zero retries. The browser containers have stopped.

App/test types, scoped lint/format and the production build pass. The compose owner's ten
component/composable checks passed after a failing raw-heading regression. Evidence is under
`storage/app/restart-2026-10-20/u013-storage-catalogue/{run1,run2}` in the API workspace;
compose unit/static evidence is under `u013-settings-parity/compose-*.log`. No live messages,
license requests or settings writes were needed. The full release and Lighthouse gates remain
independent.
