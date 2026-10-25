# mailcowui-ng

A mobile-first Vue 3 and TypeScript web app for mailcow-dockerized. It builds to static files
served at `/ng/` by default; its backend is [mailcow REST API v2](https://github.com/FELDSAM-INC/mailcow-rest-v2), served at `/api/v2`
on the same origin. The classic UI and `/api/v1` continue to work alongside it.

The application has routes for feature areas 001–013: sign-in and account self-service; domains,
mailboxes, aliases and resources; quarantine and spam policy; administrators; sync jobs; routing;
DKIM/MTA-STS/DNS; operations; identity providers/OAuth2; and system settings. See the
[roadmap](docs/roadmap.md), [route registry](src/app/router/routes.ts) and
[settings catalogue](src/features/system-settings/catalogue.ts). This describes implemented
areas, not completion of every acceptance task. The [cutover plan](specs/014-cutover/spec.md)
remains separate; deploying this app does not redirect the classic UI.

The [community installation helper](https://github.com/FELDSAM-INC/mailcow-modern-ui/blob/main/docs/installation.md#optional-use--instead-of-ng)
can optionally serve browser routes at `/`. It validates `public/deployment.json` against
the installed image and forwards only registered UI namespaces, preserving mailcow's
internal endpoints. The external `app-config.js` bootstrap selects the router base;
assets stay under `/ng/`. Existing `/ng/` bookmarks and credential callbacks are normalized
in the browser before bootstrap, without an HTTP redirect carrying their credentials.
The classic interface remains available at `/index.php` in this mode.

Compatibility: **mailcow 2026-09a or newer**, including **2026-10**. Older releases
remain untested: `2026-09` shares the accepted schema, while releases through `2026-07b`
currently fail the API's schema check. See the [compatibility guide](https://github.com/FELDSAM-INC/mailcow-modern-ui/blob/main/docs/compatibility.md).

Start with the [constitution](.specify/memory/constitution.md) and
[conventions](docs/conventions.md), especially translations, legacy forms, secrets and feature
boundaries. Feature `specs/NNN-*/tasks.md`, `quickstart.md` and [checkpoint notes](docs/checkpoints)
record remaining work and the revisions actually checked.

## Local development

Use Node 24 LTS and npm, matching CI and the Docker build. `package.json` also permits Node
22.13 or newer within the 22.x line. Dependencies have exact versions and a committed lockfile.
From the repository root:

```bash
npm ci
npm run dev:mock
```

Open `http://localhost:5173/ng/` (or the URL Vite prints). This starts Vite and the
contract-validated mock API, with no running mailcow instance required. To open a seeded session
or failure state, choose a scenario from [`tests/mocks/scenarios/`](tests/mocks/scenarios):

```bash
APP_URL=http://localhost:5173/ng/ npm run mock:scenario -- admin-active
```

Open the printed URL. `MOCK_PORT` defaults to 4010. Mock state is selected by a browser cookie;
use separate browser contexts when comparing independent scenarios. For the production build
and CSP locally:

```bash
npm run build
npm run preview:mock
```

The preview defaults to `http://localhost:4173/ng/`; its port can be set with `PREVIEW_PORT`.
`npm run dev` instead proxies `/api/v2` and `/lang/` to `API_PROXY_TARGET` (default
`http://localhost:8080`). Point it at a disposable API dev stack when needed. Real sessions use
Secure cookies and WebAuthn needs a secure context; use the HTTPS API/smoke setup for those flows
rather than treating a plain-HTTP proxy as a production-equivalent authentication environment.

## Project structure

| Path                             | Purpose                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/api/`                       | HTTP client, contract types and shared problem handling; generated imports stay within this boundary |
| `src/app/`                       | Bootstrap, router, navigation, shell, session, preferences and branding                              |
| `src/features/`                  | Feature pages, queries and forms; public `index.ts` exports and declarative `routes.ts`              |
| `src/shared/`                    | Reused components/composables, security helpers and copied TailAdmin primitives                      |
| `src/i18n/`                      | App messages, legacy translation snapshot and CSP-safe legacy formatter                              |
| `contract/`                      | Vendored OpenAPI bundle and the exact API revision in `VERSION.json`                                 |
| `tests/unit/`, `tests/mocks/`    | Vitest components/logic and contract-validated MSW scenarios                                         |
| `tests/e2e/`, `tests/smoke/`     | Mock-backed browser stories and real-API smoke checks                                                |
| `docker/`, `deploy/`, `scripts/` | Static image, mailcow integration and development/release tools                                      |
| `docs/`, `specs/`                | Shared conventions, evidence and per-feature plans/tasks                                             |

Features expose APIs through their `index.ts`; the application route registry may import each
feature's declarative `routes.ts` directly to avoid loading its forms at startup. Generated files
in `src/api/generated/` and `contract/` are not edited manually. Legacy text comes from mailcow's
same-origin `/lang/lang.<code>.json`, with the bundled snapshot as fallback. Reuse existing keys
and the approved legacy form map; new wording follows the conventions and human review process.
Some new cs/sk descriptions explicitly retain English source fallback pending that review, as
recorded in the feature checkpoints; key coverage alone does not prove translated wording.

The sidebar grouping is defined in [`sections.ts`](src/app/navigation/sections.ts), separately
from route access in the [navigation catalogue](src/app/navigation/catalogue.ts). There is no
standalone Home screen: the default landing is System & Containers for administrators, Domains
for domain administrators, and the account password page for mailbox users. Requested deep links
still take precedence.

## Build and checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm run contract:check
npm run i18n:check
npm run licenses:check
npm run audit
npm run test:unit
npm run build
npm run budget:check
```

`test:unit` runs Vitest with coverage. To check only a changed component without a whole-project
coverage run, use `npx vitest run tests/unit/<path>.spec.ts`. `typecheck` checks the project
references, including tests. The production output is `dist/`; the static image removes hidden
source maps before serving it. `budget:check` measures the built initial JavaScript against the
200 KiB gzip limit and the configured lazy-chunk budgets.

Browser stories use the production build and its CSP, not the Vite development server:

```bash
npx playwright install --with-deps chromium webkit
npm run build
npm run test:e2e -- --workers=2 --retries=0
```

The three projects are mobile Chromium (360 px), desktop Chromium (1366 px) and mobile WebKit
(360 px). WebKit excludes cases tagged `@virtual-authenticator`. Playwright starts the mock and
preview servers; `MOCK_PORT`, `PREVIEW_PORT` and `PREVIEW_OUT_DIR` allow isolated runs. Do not
rebuild an output directory while a browser run is using it. `npm test` runs unit and browser
checks, but does not build `dist/` first. CI defaults to one retry; the command above explicitly
requests zero retries.

### Separate validation categories

`npm run lhci` performs Lighthouse measurements against a production preview. Its configured
mobile thresholds are performance 80 and accessibility 90; run timing measurements with an idle
machine. Dedicated editor/timing checks also exist in the test suite. They are separate from the
static bundle-size check.

The full `test:e2e` suite includes accessibility and contrast scans through
[`expectAccessible`](tests/e2e/fixtures/a11y.ts), in light/dark themes with saved/limit palettes.
Lighthouse runs separately via `npm run lhci`. The [CI workflow](.github/workflows/ci.yml)
configures quality, build, browser, image and conditional smoke jobs. Performance/Lighthouse
and browser accessibility checks are opt-in through the repository variables documented in the
[CI setup guide](https://github.com/FELDSAM-INC/mailcow-rest-v2/blob/main/docs/ci-and-images.md).
The [Codex Security workflow](.github/workflows/codex-security.yml) uses the API only for trusted
pull-request diffs. Its estimated stop threshold defaults to $5, configurable with
`CODEX_SECURITY_PR_MAX_COST`; add the `CODEX_SECURITY_API_KEY` Actions secret to activate it.
Full scans use your ChatGPT subscription locally:

```bash
npx --yes @openai/codex-security@0.6.0 login
```

```bash
node scripts/security/scan-local.mjs
```

The helper requires Node 22.13+ and Python 3.10+, explicitly selects ChatGPT authentication,
removes API keys from the child environment, and waits before retrying rate-limit failures.
It allows at most three attempts with a shared 15-minute wait budget. Retries start a new scan
and consume more plan usage. Reports stay in the private temporary directory printed by the
command. See the [scan guide](https://github.com/FELDSAM-INC/mailcow-rest-v2/blob/main/docs/ci-and-images.md#codex-security)
for limits, dry runs and model selection.

### Real-API smoke checks

The smoke helper uses a separate API worktree and Compose project, pinned to
[`contract/VERSION.json`](contract/VERSION.json), and builds this UI's Docker image. Docker with
Compose v2 and a sibling API checkout are required; set `MAILCOW_REST_V2_DIR` for another location.

```bash
scripts/smoke/stack-up.sh
npm run test:smoke
scripts/smoke/stack-down.sh
```

Use cleanup even if the tests fail. These scripts seed/reset their disposable database and remove
its volumes on teardown. They are not instructions for testing against production or an existing
shared stack. The default smoke project uses HTTP port 18480, HTTPS port 18483 and Mailpit port
18425; see the script for `SMOKE_PROJECT`, `SMOKE_WORKDIR` and port overrides. Mailcow outbound
services absent from the dev stack use development fakes, so this is a real API integration test,
not proof against every live mailcow daemon. Smoke runs serially because cases share seeded users.

Identity-provider checks require `SMOKE_IDP=1`; routing checks use
`SMOKE_COMPOSE_PROFILES=routing`. Set these consistently when starting the stack and running the
suite. The scripts and feature quickstarts document additional fixtures for narrower smoke cases.

## API contract workflow

The API contract is the only interface for application data and actions. If an operation or field
is missing, specify and implement it in the API repository first; do not bypass it through a
legacy PHP endpoint. Same-origin legacy translations and the documented opt-in password breach
check are the exceptions described in the constitution.

If no local API checkout is available, the script clones the public repository. For authenticated
access, an exported `MAILCOW_REST_V2_TOKEN` is passed through a temporary Git askpass helper;
the token is kept out of command arguments, remote URLs and credential stores.

After the API contract change is committed, pin an explicit tag or commit:

```bash
scripts/contract/bump.sh '<api-tag-or-commit>'
npm run typecheck
npm run i18n:check
```

The bump script reads the sibling API repository (or `MAILCOW_REST_V2_DIR`), lints and bundles its
contract, records its revision/checksum in `contract/VERSION.json`, and regenerates the client
types. Review and commit the generated changes with the feature. Then run `npm run contract:check`
and the relevant unit/browser checks. `contract:check` regenerates files and checks their Git diff,
so a deliberately uncommitted contract bump is expected to be reported as a difference. Mocks
validate requests and responses against the pinned contract; keep scenarios aligned with it.

## Public images

CI publishes `ghcr.io/feldsam-inc/mailcowui-ng:latest` for Linux AMD64 and ARM64 after the
quality, build and container checks pass. `latest` follows `main`; `sha-<full-commit-sha>`
identifies a commit build and `v*` Git tags publish matching version tags without the `v`.
Pin a digest when the exact image contents must stay fixed. See the
[CI setup guide](https://github.com/FELDSAM-INC/mailcow-rest-v2/blob/main/docs/ci-and-images.md)
for the required one-time public package visibility setting.

For an existing installation, select the image version in `mailcow.conf`, then run:

```bash
docker compose pull ng-mailcow
docker compose up -d --no-deps --wait ng-mailcow
```

## Deployment to maildev

**First installation:** [Install the API and new UI, one command at a time](https://github.com/FELDSAM-INC/mailcow-rest-v2/blob/main/docs/installation.md).
The guide covers both projects on an existing mailcow server.

First add the [`ng-mailcow` service](deploy/docker-compose.override.yml) to the host's mailcow
Compose override. The API repository's `deploy/nginx/site.restv2.custom` must already route `/ng/`
to this static service and `/api/v2` to the API. See
[the initial installation guide](specs/001-sign-in-app-shell/quickstart.md) and
[the API README](https://github.com/FELDSAM-INC/mailcow-rest-v2/blob/main/README.md#installation).

To deploy a reviewed, committed UI revision to an already configured host:

```bash
REF='<reviewed-commit-or-tag>' scripts/deploy/push-to-mailcow.sh '<maildev-ssh-host>' '<mailcow-directory>'
```

The [helper](scripts/deploy/push-to-mailcow.sh) builds from `git archive` (`REF` defaults to
`main`), transfers the image over SSH, updates only `ng-mailcow`, and runs Compose with
`--no-deps`. It verifies container health, the public `/ng/` response and its CSP. Uncommitted
files are excluded, and it does not run the test suite or deploy the API. Configure
`pull_policy: never` when using locally loaded images. `PUBLIC_URL` overrides the public URL;
`HEALTH_TIMEOUT` defaults to 180 seconds.

This is a remote deployment, not a dry run. The old image is retained and its tag is printed for
manual rollback; rollback is not automatic. Keep SSH credentials and host configuration outside
this repository. Deploy the compatible API revision first when the UI needs new operations.

## Further reading

- [Roadmap](docs/roadmap.md) and [legacy inventory](docs/legacy-inventory.md)
- [Cross-feature conventions](docs/conventions.md) and [constitution](.specify/memory/constitution.md)
- [Feature plans, task lists and quickstarts](specs/)
- [Recent validation checkpoints](docs/checkpoints/)
- [License](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md)

Historical planning prompts and old per-feature test counts are retained in the specs. They are
not the current release status or a substitute for checking the code and the latest evidence.
