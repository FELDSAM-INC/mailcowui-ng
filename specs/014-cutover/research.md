# Research: Cutover from the Classic Interface

**Feature**: `specs/014-cutover` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here. The order of precedence is:

1. the two constitutions (this repository's and mailcow-rest-v2's principle V, Coexistence);
2. not breaking existing links and integrations;
3. legacy behaviour at the upstream baseline `2026-09a`;
4. best practice.

Each entry has a **Decision**, its **Rationale** and the **Alternatives considered**.

**Sources read**:

- mailcow's nginx templates at the baseline: `data/conf/nginx/templates/nginx.conf.j2` and
  `sites-default.conf.j2`;
- the nginx image's `bootstrap.py` and `docker-entrypoint.sh`;
- `docker-compose.yml`, `.gitignore` and `update.sh`;
- the watchdog and ACME scripts;
- the classic pages `index.php`, `edit.php`, `mobileconfig.php`, `reset-password.php`,
  `admin/*.php`, `domainadmin/*.php` and `oauth/authorize.php`;
- `inc/triggers.*.inc.php` and `inc/functions.inc.php` (`protect_route`, `identity_provider`);
- `js/site/{mailbox,user,admin}.js`, for how the classic interface builds its own links.

**Prototype check**: the nginx behaviours this design relies on were checked on 2026-10-18 with a
throw-away configuration on `nginx:1.28-alpine`. mailcow runs 1.30.4, and none of these behaviours
changed between those versions. The results are quoted where they matter:

- R2: server-level `if`/`return`;
- R2: regex maps with named captures over composite strings, and PCRE look-ahead;
- R2: `add_header` with an empty value;
- R6: `access_log … if=`;
- R5: a wildcard `include` inside a `map` block that matches no file.

---

## 1. Redirect mechanism

### R1. Deployment through mailcow's own extension points

- **Decision**: the cutover is three files in the operator's `data/conf/nginx/` directory, which
  nginx-mailcow mounts at `/etc/nginx/conf.d/`. The tool `ng-cutover install` (R5) installs them.

  | File | Included by (baseline template) | Context | Content |
  |---|---|---|---|
  | `ng-cutover.conf` | `include /etc/nginx/conf.d/*.conf;` in `nginx.conf.j2` | `http` | the generated maps, the log format and the entry allowlist (R2, R6, R11) |
  | `site.ng-cutover.custom` | `include /etc/nginx/conf.d/site.*.custom;` in `sites-default.conf.j2` | each public `server` | the redirect, the `Cache-Control` header, the redirect access log, and the entry and exit locations |
  | `ng-cutover-state.custom` | only by a wildcard `include` inside a map of `ng-cutover.conf` | inside a `map` | the three switch bits and the time each last changed (R5) |

  - `site.ng-cutover.custom` uses the same extension point as mailcow-rest-v2's
    `site.restv2.custom` (API research R23), as FR-028 requires. It is a separate file, so
    removing it leaves the routing of `/api/v2/` and `/ng/` untouched.
  - mailcow's `.gitignore` covers both suffixes (`data/conf/nginx/*.conf` and `*.custom`). The
    files therefore survive `update.sh`, whose only bulk Git operation is `git checkout .` on
    tracked files (FR-027). No file name collides with upstream's tracked names (`dynmaps.conf`,
    `meta_exporter.conf`, `site.conf`, `mailcow_auth.conf`).
  - Applying a change means rewriting the state file, then running `nginx -t` and
    `nginx -s reload` inside nginx-mailcow. Nothing is rebuilt or restarted, and no upstream file,
    template or service definition changes (FR-022).
- **Where the snippet applies**: `site.*.custom` is included only by `sites-default.conf`. The
  baseline includes that file in three kinds of `server` block:
  - the default server: `MAILCOW_HOSTNAME`, `autodiscover.*`, `autoconfig.*` and `mta-sts.*`;
  - one block per `ADDITIONAL_SERVER_NAMES` entry;
  - one block per extra certificate directory.

  It is **not** included in the internal servers on 8081 (Rspamd maps), 9081 (metadata exporter)
  and 9082 (Dovecot `mailcowauth.php`), so X15 holds by construction. The HTTP-to-HTTPS
  redirect server is also left out: it answers `301` to HTTPS before the cutover rules are
  reached, and the HTTPS request then follows them.

  One trap remains. The default server also listens on `127.0.0.1:65510`, the internal listener
  that `auth_request /sogo-auth-verify` calls for SOGo, ActiveSync and DAV. The rules therefore
  never redirect a request whose `$server_port` is `65510`. In addition, `/sogo-auth` is matched
  by no row (X03).
- **Rationale**:
  - These are the only extension points the baseline offers.
  - Both are documented for operator configuration and kept by updates.
  - Using them satisfies both constitutions: upstream files are never patched, and the change is
    added next to mailcow rather than into it.
- **Alternatives considered**:
  - Patching `sites-default.conf.j2`: forbidden by both constitutions.
  - A redirect container in front of nginx-mailcow: rejected. It changes published ports and
    service definitions, and adds a hop for SOGo, ActiveSync and `/api/v1`.
  - Redirect logic in the app's image: rejected. nginx-mailcow forwards only `/ng/` to it, so
    classic addresses never reach it.
  - Lua or njs: rejected. Dynamic modules need `load_module` in the main context, which only a
    template patch could add.
  - Environment variables of nginx-mailcow: rejected. Changing them recreates the container,
    which FR-022 forbids.

### R2. The redirect decision in nginx

- **Decision**:
  - **Where it runs**: one server-level rewrite statement in `site.ng-cutover.custom`:

    ```nginx
    if ($ngc_redirect) { return 302 $ngc_target; }
    ```

    It runs in the server rewrite phase, before mailcow's locations are selected. It therefore
    needs no change to them and cannot alter what any location does when it is false. A request
    that matches no mapping row or fallback family never gets a row, so it is never redirected.
    That covers every exclusion, ACME challenges and operator files (X16, FR-013).
  - **The decision pipeline**: a chain of generated `map` blocks in `ng-cutover.conf`. Each map is
    evaluated lazily, only when `$ngc_redirect` is read. The variables are listed in
    [data-model.md §3](./data-model.md#3-nginx-decision-variables).
    1. **Host kind** from `$host`: `autodiscover.` and `autoconfig.` prefixes are marked, so that
       the root is never redirected there (X14, FR-017). Classic `index.php` lowercases the host;
       nginx's `$host` is already lowercase.
    2. **Sign-in flow** from `$args`: `oauth`, `iam_sso`, `cancel_tfa_login` or
       `cancel_tfa_setup` as a key, or both `code` and `state` keys (a PCRE look-ahead) (FR-016,
       X08).
    3. **Row** from the normalised path `$uri`, the raw `$request_uri` and `$args`. Regex
       entries are generated from `cutover/mapping.json` in a fixed order (R11):
       - exclusion guards;
       - token rows (M13 before M10–M12, M03 before M04, M33 before M01);
       - plain rows;
       - the fallback families F1–F3.
    4. **Row enabled** from `"$ngc_row:$ngc_switches"`. One regex per row requires a `1` bit for
       each role in the row's used-by set (FR-021). For example, M14 needs `111`, M16 needs
       `11.` and M02 needs `..1`.
    5. **Redirect** from `"$request_method:$ngc_pass:$server_port:$ngc_row_on"`. It is `1` only
       when all of these hold (FR-008, X12, X13):
       - the method is `GET` or `HEAD`;
       - the classic pass is absent (R7);
       - the port is not `65510`;
       - the row is enabled.
    6. **Target** from the row and the extracted values (R3).
  - **Matching versus carrying**:
    - Rows are matched on the normalised `$uri`, which is what mailcow's locations and the
      classic pages see. A non-canonical path therefore behaves as it did before (for example
      `/edit/../api/v1/x`, X02).
    - Carried values are taken only from the raw `$request_uri` and `$args`, and only when the
      raw path has the canonical one-segment form. A value is never captured from `$uri` into a
      header: that is the classic CRLF-injection mistake, because `$uri` is decoded.
    - A raw value must match the carried-value character set of
      [data-model.md §2](./data-model.md#2-authoritative-mapping-cutovermappingjson): RFC 3986
      `pchar`, without `\`. Browsers turn `\` into `/` in special URLs, so allowing it would let a
      value climb out of the app.
    - When a value contains anything else, the row does not match, and the next applicable row or
      fallback decides. For example `/edit/mailbox/<value>` falls to F3, and
      `/reset-password?token=<value>` to M04.
  - **Form of the redirect**:
    - `302`, so it is never permanent (FR-005).
    - The `Location` is relative (`/ng/arrival/…`). mailcow sets `absolute_redirect off`, so the
      browser keeps the host name, scheme and port of the request (FR-004).
    - `Cache-Control: no-store` comes from a server-level
      `add_header Cache-Control $ngc_cache_control always;`, whose value is empty unless the
      request is redirected. The prototype confirmed two things:
      - nginx sends no header for an empty value, so every other answer is unchanged;
      - locations with their own `add_header` (mailcow's static files) are unaffected.
  - **Prototype results** (switch bits `110`):
    - `GET /edit/mailbox/john%2Btag%40example.org` answered `302 Location:
      /ng/arrival/M20/john%2Btag%40example.org` (the value form of the prototype) with
      `Cache-Control: no-store`.
    - `/edit/mailbox/a%2Fb` and `/edit//mailbox/x` fell to F3.
    - `POST`, a full classic pass and the `65510` listener were not redirected. Half a pass was
      redirected.
    - `/`, the ACME path and `/css/…` answered as before, and the static files' own
      `Cache-Control: public` was untouched.
- **Rationale**:
  - This is pure stock nginx: the rewrite and map modules.
  - It is decided per request in microseconds, needs no upstream call, and keeps working when the
    API or the app is down. The app's own error page then applies, as the spec's edge case says.
  - Lazy maps cost nothing for requests that never read the variable.
- **Alternatives considered**:
  - New `location` blocks for `/admin`, `/edit` and the others: rejected. mailcow already defines
    `location /`, `location /edit` and the regex locations, so the duplicates would fail
    `nginx -t` or change matching for excluded paths.
  - `rewrite … redirect` at server level: rejected. It cannot attach the per-role conditions
    without the same maps, and it appends the original query string unless told otherwise.
  - Matching on `$request_uri` only: rejected. It would disagree with nginx's own location
    choice for non-canonical paths and could redirect an excluded address.

### R3. Arrival address and resolution in the app

- **Decision**:
  - **The redirect target**: every redirect goes to one app address per row,
    `/ng/arrival/<row>`, for example `/ng/arrival/M20`. Carried values travel in the URL
    **fragment**, encoded as a query string:

    | Carried kind | Fragment | Example |
    |---|---|---|
    | path-form value (`/edit/<type>/<value>`) | `#p=<raw segment>` | `/ng/arrival/M20#p=john%40example.org` |
    | query-form value (`/edit.php?<type>=<value>`) | `#q=<raw query value>` | `/ng/arrival/M20#q=john%2Btag%40example.org` |
    | reset token (M03) | `#token=<raw>` | `/ng/arrival/M03#token=…` |
    | single sign-on token (M13) | `#sso_token=<raw>` | `/ng/arrival/M13#sso_token=…` |
    | profile options (M33) | `#only_email=1`, `#app_password=1` or both | `/ng/arrival/M33#only_email=1` |

    A row with nothing to carry has no fragment. The browser then keeps the original fragment, as
    FR-006 requires, and the app ignores it.
  - **Resolution in the app**: the app's lazily loaded `arrival` route
    (`src/features/cutover/`) does the following:
    1. It reads `window.location.hash` raw, before the router decodes it.
    2. It records the arrival, exact or fallback, in memory for the arrival notice (R10).
    3. It resolves the row's target from the same `cutover/mapping.json` that generated the
       nginx rules (R11).
    4. It calls `router.replace` to the target route. That one history entry replaces the arrival
       address, which removes the marker and the fragment (FR-014).

    The target is a named route of the delivering feature, so UI 001's guard keeps it through
    sign-in (FR-011, FR-031). An unknown row resolves to the fallback start screen.
  - **Decoding as the classic page did** (FR-006, FR-010):
    - Path-form values are decoded once, which matches nginx's `$uri` decoding before the
      classic `rewrite`. A `+` stays a `+`.
    - Query-form values are form-decoded, so `+` becomes a space, as PHP's `$_GET` does.
    - For the four rows whose classic code also applies `html_entity_decode(rawurldecode(…))`
      (alias, alias domain, mailbox and resource; `edit.php` lines 15, 103, 117 and 157), the app
      applies the same second step with `decodeAsClassic()`. That step is a tolerant
      `rawurldecode`, followed by HTML entity decoding through an inert `DOMParser` document.
      Neither step executes anything or renders HTML.
  - **Tokens** are handed to the target the way the target accepts them (data-model §5). Neither
    nginx nor the arrival route checks, uses or invalidates a token (FR-009).
    - **M03**: `router.replace` to `password-reset` with query `token`. UI 005 moves it to memory
      in the route's `beforeEnter` and removes it from the address at once (UI 005 FR-038). The
      navigation happens inside the app, so the token is never sent to the server again.
    - **M13**: UI 007 captures `sso_token` in `captureSsoToken()` in `src/main.ts`, and only when
      the page **loads** at `/ng/sign-in/sso-token`. A client-side navigation would skip that. The
      arrival page therefore hands the token to the same memory holder through the auth feature's
      public API (`@/features/auth`), then calls `router.replace` to `sign-in-sso-token` without
      the token in the address. If UI 007 exports no such function, 014 adds one next to
      `captureSsoToken()` (conventions "Where features meet"). The landing then behaves exactly as
      for a captured token: it asks first when a session exists, and exchanges only when the page
      is visible (UI 007 FR-059, FR-060).
    - Rejected: a full page navigation to `/ng/sign-in/sso-token?sso_token=…`. It would send the
      token to the server and log it a second time.
  - **Targets that need a lookup**:
    - `/edit/alias/<value>`: classic links use the numeric alias ID, while the classic page
      accepts the ID or the address (`alias_details`: `WHERE id = :id OR address = :address`).
    - `/edit/template/<id>`: the ID can be a domain template or a mailbox template.
    - `/edit/filter/<id>`: the classic link carries only the filter ID.

    These rows resolve to `classic-target`, an app route of this feature that needs a session.
    Every other row resolves directly. For a mailbox, the target is `mailbox-overview`, the
    default child of UI 003's `mailbox-detail` layout route, because navigating to the parent's
    name would render no section.
    It is an app address, so the guard keeps it through sign-in. It looks the object up through
    contract operations, then replaces itself with the detail screen:
    - aliases: digits mean `getAlias`, anything else `listAliases?address=`;
    - templates: `getDomainTemplate`, and on `404` `getMailboxTemplate`, the same order as
      `edit.php`;
    - Sieve filters: UI 005's filter detail needs the mailbox (`/filters/:mailbox/:filterId`),
      which only a lookup by ID can supply (API gap SF, UI 005 plan gap AG2). Until a pin offers
      it, `classic-target` with kind `sieve-filter` replaces itself with the `filters` list and
      marks the arrival as a fallback, as UI 005's plan expects (plan owner question 1).

    When nothing is found, it shows the target's "not found" state with a way to the list. For
    templates, that is the domain templates screen (FR-010, spec edge case).
- **Rationale**:
  - **The app owns its addresses**: target routes are checked by a unit test against the real
    router (`router.hasRoute` and `resolve`). If a later feature renames a route, the build
    breaks instead of every bookmark. nginx never needs to know an app path beyond
    `/ng/arrival/`.
  - **Exact decoding needs no transcoding in nginx**: a raw path value keeps path semantics and a
    raw query value keeps query semantics. nginx cannot turn `+` into a space, so putting
    query-form values into app paths would have changed their meaning.
  - **Fragments keep personal data and tokens out of new log lines**: browsers never send the
    fragment. The arrival request is logged as `GET /ng/arrival/M13`, with no token, so the access
    records gain no personal data (FR-046). Link scanners and prefetchers that follow the redirect
    receive the static `index.html` and consume nothing.
  - **The safety rule holds**: the target is fixed by the row (`/ng/arrival/<row>`), and only the
    fragment comes from the request. A redirect can never leave the app (FR-004).
- **Alternatives considered**:
  - nginx redirects straight to final app paths, such as `/ng/mailboxes/<value>`: rejected.
    - nginx would have to know every app route and could not check them.
    - Query-form values would change meaning, because nginx cannot transcode `+`.
    - Every route rename in UI 002–013 would silently break bookmarks.
  - Carrying values in the arrival path or query: rejected. Tokens and mailbox addresses would be
    logged a second time on the arrival request, and query-form values would need transcoding.
  - Resolving lookups in nginx (`auth_request` to the API): rejected. It needs a session, and it
    makes classic addresses depend on the API.

### R4. How the role is known at the redirect point

- **Decision**: redirects depend only on the address's **used-by set**, as the spec's clarification
  says. nginx does not try to learn who is signed in to the classic interface. The cutover switch
  is effectively one switch per role, applied through each row's used-by set (FR-021). After
  arrival, the app's own guard and catalogue decide access: "no access" or "not found" (UI 001
  FR-045, spec US1-AS9).
- **Rationale**:
  - The classic session is an opaque PHP session ID (`MCSESSID`) whose data, including
    `mailcow_cc_role`, lives in Redis. nginx cannot read it.
  - Every way of reading it would break a principle:
    - an `auth_request` to a new PHP endpoint puts files into the upstream tree;
    - an `auth_request` to the API makes the API read legacy sessions, against API constitution
      V's independent sessions, and makes every classic page depend on the API;
    - a role cookie would have to be set by the classic interface, which means patching it;
    - the app's session cookie says nothing about the classic session.
  - Used-by sets are static, testable and visible in the mapping. The cost is that shared
    addresses (`/quarantine`, `/edit/syncjob/…`) wait until every role that uses them is switched
    on. The spec accepts that.
- **Alternatives considered**: the four above, plus "redirect by the browser's `MCSESSID`
  presence". That was rejected: every visitor of any classic page has that cookie, signed in or
  not, so it carries no role.

### R5. Per-role switches, state and the apply step

- **Decision**:
  - **The setting** is `NG_CUTOVER_ROLES`:
    - `none` turns every role off (the rollback);
    - otherwise a comma list of `admin`, `domainadmin` and `user`;
    - `all` is a shortcut for all three.
  - **The apply step** is `ng-cutover apply <roles>`. `<roles>` falls back to the environment
    variable `NG_CUTOVER_ROLES` (FR-020).
  - **The state file** `data/conf/nginx/ng-cutover-state.custom` holds one map entry, `ngc "100";`,
    whose bits are administrators, domain administrators and mailbox users. Comment lines record
    each role's state and the UTC time of its last change (FR-026).
    - `ng-cutover.conf` reads the file through `map ngc $ngc_switches { default "000"; include
      /etc/nginx/conf.d/ng-cutover-stat[e].custom; }`.
    - The bracket makes the include a wildcard. A missing state file then means "all off"
      instead of a failed `nginx -t`, which the prototype confirmed. mailcow's ACME reload falls
      back to restarting the container when a reload fails, so a configuration that cannot load is
      the worst outcome. This design rules that outcome out for a missing file.
  - **What `apply` does**:
    1. It parses and validates the setting, and reads the current state.
    2. It runs the preflight checks (below), but only when at least one role turns **on**.
       Turning roles off is never refused, because rollback must always work.
    3. It writes the new state file through a temporary file and `mv`, keeping
       `ng-cutover-state.custom.bak`. The `.bak` suffix is ignored by mailcow's `.gitignore` and
       by both nginx globs.
    4. It runs `nginx -t` in nginx-mailcow. On failure it restores the backup, runs `nginx -t`
       again and stops with the error. Nothing is reloaded.
    5. It runs `nginx -s reload`, which is graceful: open connections, including ActiveSync long
       polls and webmail sessions, finish on the old workers (FR-022, SC-003).
    6. It prints each role's resulting state and last change (FR-023), and appends one line to
       `var/history.log` in the tool directory.
    7. It prints the follow-up the runbook requires: run the smoke test (FR-044).
  - **Preflight**, checked anonymously against `https://<MAILCOW_HOSTNAME>` (FR-023, FR-001). Each
    failure is a refusal that names the reason, and nothing changes:
    1. `GET /ng/release.json` answers `200` with `cutoverReady: true` (R8).
    2. That manifest's `mappingDigest` equals the digest in the installed `ng-cutover.conf`
       header, so the app and the rules come from the same mapping.
    3. `GET /ng/` answers `200 text/html` (the app answers).
    4. `GET /api/v2/health/ready` answers `200` (the API answers and is ready).
    5. A passing off-state baseline (R12) exists for every configured host name, recorded with the
       same mapping digest (FR-001).

    These are warnings only:
    - `GET /api/v2/public-config` has `announcement.active` false or `text` null (FR-023);
    - the installed mailcow release (`MAILCOW_GIT_VERSION` in
      `data/web/inc/app_info.inc.php`) is not in the mapping's `verifiedAgainst` list (FR-030);
    - the new state skips the recommended order: administrators, then domain administrators, then
      mailbox users.
  - **Other commands**:
    - `ng-cutover status` (FR-026) prints the three roles with on or off and the last change, the
      installed mapping digest and its verified releases. With `--probe`, it adds the observed
      behaviour: one `HEAD` per role on that role's sign-in row (M05, M10 and M02), reported as
      redirected or classic, so a stale reload is visible.
    - `ng-cutover install` copies the three files. It runs only while every switch is off, or when
      the new rules' digest equals the deployed app's digest, which is the upgrade path. It then
      runs `nginx -t`, reloads, and on failure removes what it added.
    - `ng-cutover uninstall` requires every switch to be off. It removes the server snippet first
      and then the other two files, with `nginx -t` and a reload, so the API and app routing never
      notice (FR-028).
  - **Durability (FR-027)**:
    - The state is a file read at every nginx start and reload.
    - Certificate renewals reload the same files.
    - mailcow updates recreate the containers from the same mounted directory.
    - Template changes that move the include points would show up in the smoke test, which the
      runbook requires after every update (FR-044).
  - **Implementation**: the CLI is a POSIX-friendly **bash** script, because it must run
    `docker compose exec` on the mailcow host. It finds the Compose command the way mailcow's
    helper scripts do (`docker compose`, then `docker-compose`) and reads `mailcow.conf` for the
    host names and ports. HTTP and JSON work (preflight, smoke test, report) is done by
    zero-dependency Node modules. They run on the host's Node 22+ when present, otherwise in
    `node:24-alpine` (pinned by digest) with `--network host`. A mailcow host needs nothing
    beyond what mailcow already requires.
- **Rationale**:
  - One setting and one step, safe in both directions.
  - Refusals happen before any change.
  - A broken configuration is never left loaded.
  - Rollback works even when the app, the API or the network is down.
- **Alternatives considered**:
  - Keeping the setting in `mailcow.conf`: rejected. It looks like a container variable and
    invites a restart.
  - The state inside the rules file: rejected. An upgrade of the rules would have to merge state.
  - A plain `include` of the state file: rejected. A missing file would stop nginx from starting.
  - Hand-edited state: rejected, because FR-023 needs refusals.
  - A Node-only CLI: rejected. It would need a Docker socket inside a container to reload nginx.

### R6. Access records of redirects

- **Decision**:
  - `ng-cutover.conf` defines `log_format ngc_cutover` with these fields:
    - the fixed prefix `ngc_cutover`;
    - `$time_iso8601`, `$host` and `$request_method`;
    - the normalised path `"$uri"`, with no query string;
    - `$status`;
    - `ngc_row=$ngc_row`.
  - The server snippet adds `access_log /var/log/nginx/access.log ngc_cutover if=$ngc_redirect;`.
    mailcow's own server-level `access_log` stays active, so every request is still logged in
    the `combined` format. Each redirect gains one extra line that names its row (FR-014).
  - The arrival request is logged by the same nginx as `GET /ng/arrival/<row>`, without the
    fragment.
- **Rationale**: the redirect line names the row and contains neither query values nor tokens.
  nginx escapes quotes and control characters in logged variables.
- **Alternatives considered**:
  - Relying on the follow-up arrival request: rejected. It is missing for `HEAD` requests and for
    clients that do not follow redirects.
  - Logging `Location`: rejected, because it would contain carried values.

---

## 2. Classic interface entry and pass

### R7. The classic interface entry and the classic pass

- **Decision**:
  - **Entry address**: `GET /classic?to=<key>`. It is neither a classic address (the classic
    interface answers `404` there today) nor an app address (FR-031). It is an exact-match
    `location = /classic` in `site.ng-cutover.custom`, which:
    1. sets the pass;
    2. sends `Cache-Control: no-store`;
    3. answers `302` to the target.

    The target comes from a generated map over `$arg_to` (FR-032). The map's keys are the classic
    interface entries that the readiness register keeps in the classic interface, and any other
    value leads to the default:

    | Key | Target | Source |
    |---|---|---|
    | default (missing or unknown) | `/admin` | the classic administrator sign-in |
    | `api-v1-keys` | `/admin/system` | the readiness register entry "API keys for `/api/v1`" (kept in the classic interface): the configuration page, where Access › Administrators holds the API section (`templates/admin/tab-config-admins.twig`) |

    When the browser is not signed in to the classic interface, `/admin/system` sends it to the
    classic administrator sign-in (`protect_route`). The browser carries the pass, so nothing is
    redirected, and the administrator continues in the classic interface as before (US4-AS2).
  - **The pass is two cookies**:
    - `classic_pass=1`, a session cookie with no expiry, which ends with the browser session;
    - `classic_pass_8h=1` with `Max-Age=28800`, which ends after 8 hours.

    Both are set with `Path=/`, `Secure`, `HttpOnly` and `SameSite=Lax`. A map makes `$ngc_pass` equal
    `1` only when both cookies are `1`. The pass therefore ends at whichever comes first, the end
    of the browser session or 8 hours (FR-033). The prototype verified that half a pass is
    redirected.
  - **Exit address**: `GET /classic/exit` expires both cookies (`Max-Age=0`) and answers `302` to
    `/ng/` (FR-033).
  - **What the pass carries**: no credential and nothing derived from one. A forged pass only
    means that the browser sees the classic interface, which still demands its own sign-in and
    permissions (FR-034). The entry therefore needs no signature, secret or integrity check.
- **Rationale**:
  - **Why two cookies**: nginx has no date arithmetic and no module for "session or N hours".
    A session cookie gives the first limit, a `Max-Age` cookie the second, and a map combines
    them.
  - **Why exact locations**: they take precedence over every mailcow location, so the entry and
    exit cannot collide with classic routing.
  - **Why `SameSite=Lax`**: the pass must survive top-level navigation from the app and from
    links, and `Lax` does that.
- **Alternatives considered**:
  - A signed expiry with `secure_link`: rejected. The entry cannot compute "now + 8 h" without
    njs or Lua.
  - `Max-Age` alone: rejected. The pass would survive the browser session.
  - The `__Host-` prefix: rejected, because nginx cookie variable names cannot contain `-`. It also
    adds nothing, since the pass grants nothing.
  - A classic address with a marker parameter, such as `/admin/system?classic`: rejected. FR-031
    requires an address that is not a classic address.
  - An entry under `/ng/`: rejected. FR-031 rules out app addresses, and the app's image would
    need cookie logic.
- **Deployment order**: the entry exists only while `site.ng-cutover.custom` is installed. The
  runbook therefore installs the cutover addition, with every switch off, **before** the
  cutover-ready release is deployed. The app's link to the entry then works in every switch
  state (FR-038).

  Installing with every switch off changes nothing for users except the new `/classic` and
  `/classic/exit` addresses. The off-state smoke test (FR-001) verifies the entry. If the
  addition is ever uninstalled, the API keys note's link answers `404`, while the classic
  interface itself stays reachable at its own addresses.

---

## 3. Release, readiness and classic links

### R8. Cutover-ready release and the release manifest

- **Decision**:
  - **The manifest**: the build writes `dist/release.json`, served at `/ng/release.json` with
    `Cache-Control: no-cache`. Its fields are `schema`, `version`, `commit`, `builtAt`,
    `cutoverReady`, `mappingDigest` and `mappingVerifiedAgainst` (data-model §7). A post-build
    script, `scripts/cutover/release-manifest.mjs`, generates it.
  - **How `cutoverReady` is set**: it is `true` only when the build receives `CUTOVER_READY=1`.
    The release workflow sets that variable only in a run whose `cutover-gates` job has passed.
    The gates are:
    1. No navigation catalogue entry has `status: 'placeholder'`, and no route renders
       `PlaceholderPage` (FR-003; UI 001 FR-044).
    2. The readiness register validates, has no entry without a disposition, and its sign-off
       digest matches its entries (R9, FR-002).
    3. The classic link register validates, and every remaining link is `kept-entry` or
       `kept-excluded` (R9, FR-037).
    4. Every mapping target resolves in the real router (R3).
    5. The rendered-link crawl finds no forbidden link (R9, SC-006).
  - **Release notes**: the release workflow writes "Cutover-ready: yes" into the release notes of
    such a release (FR-003).
  - **Docker build**: `docker/Dockerfile` passes `CUTOVER_READY` through as a build argument.
    `docker/nginx/default.conf` gains `location = /ng/release.json` with `no-cache`.
  - **Who reads it**: the apply step's preflight and the smoke test.
- **Rationale**:
  - The manifest is the only fact about the deployed app that an anonymous, read-only check can
    read.
  - Tying `cutoverReady` to a passed gate job makes "cutover-ready" an audited property rather
    than a label.
  - The digest makes FR-029 hold across the deployment, not only within the repository: rules and
    app from different mappings are refused.
- **Alternatives considered**:
  - Computing the gates in a Vite plugin: rejected. Loading `.vue`-importing modules in the build
    would need Vite's SSR module runner in a build hook, which is fragile. Vitest already does it.
  - A version range check instead of a digest: rejected, because it does not prove that the rules
    and the app agree.

### R9. Readiness register and classic link register

- **Decision**:
  - **Readiness register**: `cutover/readiness-register.json`, validated by
    `cutover/readiness-register.schema.json` with Ajv (already a dev dependency).
    - **Entries**: one per legacy screen or action. Each has the `source` key it covers, the
      delivering feature, exactly one disposition (`matched`, `improved`, `changed`, `dropped` or
      `kept-classic`) and the fields that disposition requires (data-model §8).
    - **Coverage sources**, from which `scripts/cutover/readiness.mjs` derives the `source` keys:
      - every table row in the "Legacy Parity" section of `specs/001-…/spec.md` to
        `specs/013-…/spec.md`. A row's key is
        `<spec dir>#<sub-heading slug>/<first-cell slug>`;
      - every bullet under "Features by role" in `docs/legacy-inventory.md`, with the key
        `inventory#<role slug>/<bullet slug>`.
    - **What the checker fails on** (FR-002):
      - a key covered by no entry, or by more than one;
      - an entry for a key that no longer exists (entries with a `014#<row>` source, which record
        owner-accepted deviations of the mapping, are exempt);
      - an entry with a disposition outside the list, or containing `deferred` or
        `placeholder`;
      - a parity row whose status still reads "Deferred" without an entry naming where it was
        delivered;
      - `dropped` without `ownerAcceptance` and `reason`;
      - `kept-classic` without an `entryTarget` that exists in the entry allowlist (R7).
    - **Sign-off**: the owner records `signOff: { owner, date, appVersion, entriesDigest }`. The
      checker recomputes the SHA-256 of the canonical `entries` array, so any later edit
      invalidates the sign-off until it is renewed.
    - **Commands**:
      - `npm run cutover:readiness -- --scaffold` writes missing entries with a disposition
        proposed from the parity status (Matched, Improved, Changed, Dropped), marked
        `proposed: true`. A proposed entry fails the check until a person confirms it.
      - `npm run cutover:readiness -- --render` writes `docs/cutover/readiness-register.md` for the
        owner's review.
  - **Classic link register** (FR-036): `cutover/classic-links.json`.
    - **Entries**: each entry has these fields:
      - `id` and `place` (the file, the component and the spec requirement);
      - `classicTarget` and `roles`;
      - `disposition`: `removed`, `replaced` (with the delivering requirement), `kept-entry` or
        `kept-excluded`.
    - **Initial entries**, from the specs (UI 001 R19 and the specs' classic mentions):

      | id | Place | Classic target | Disposition at cutover |
      |---|---|---|---|
      | CL01 | UI 001 FR-007, force-SSO notice (`SsoNotice.vue`) | `/` | replaced by UI 012 FR-041 (UI 012 deletes the component) |
      | CL02 | UI 001 FR-008, identity-provider hint (`IdpHint.vue`) | role sign-in pages | replaced by UI 012 FR-042 (UI 012 deletes the component) |
      | CL03 | UI 001 FR-009, "Forgot password?" | `/reset-password` | replaced by UI 005 FR-034 (UI 005 removes the constant from `classic-links.ts`) |
      | CL04 | UI 001 FR-039, second factor without passkey support | role sign-in pages | replaced by UI 005 FR-057 |
      | CL05 | UI 001 FR-040, forced password change | `/admin`, `/domainadmin`, `/` | replaced by UI 005 FR-029 |
      | CL06 | UI 001 FR-044, placeholder pages | UI 001 R19 table | removed: no placeholder remains |
      | CL07 | UI 014 FR-035, API keys note | `/classic?to=api-v1-keys` | kept-entry |
      | CL08 | UI 005 webmail hand-off (opened URL from the API) | `/SOGo/…` | kept-excluded (X03) |
      | CL09 | UI 012 FR-057, OAuth2 endpoint addresses (copyable) | `/oauth/authorize`, `/oauth/token`, `/oauth/profile` | kept-excluded (X07) |
      | CL10 | UI 013 `system-settings-rspamd-web-interface`, link to Rspamd's own interface from `capabilities.rspamdWebInterfaceUrl` through `safeHref()` | `/rspamd/` | kept-excluded (X09) |

    - **Checks**:
      - **Static**: `scripts/cutover/classic-links-scan.mjs` finds every export of
        `src/app/navigation/classic-links.ts`. 014 reduces that module to the entry and the
        excluded targets. The scan also finds every static `href="/…"` outside `/ng/` in `src/`.
        Each find must be registered. In cutover-ready mode, only `kept-*` dispositions may
        remain.
      - **Rendered**: an end-to-end crawl opens every route for each role against the mock API and
        collects every same-origin `a[href]` and `form[action]` outside `/ng/`. It allows only
        the entry, the excluded prefixes of X01, X02, X03, X07 and X09, and operator app links.
        Operator app links are data, rendered with `data-operator-link`, and the runbook asks
        the operator to review them. The crawl fails on any `PlaceholderPage` (SC-006).
- **Rationale**:
  - Machine-checked registers turn FR-002 and FR-037 into gates instead of review checklists.
  - Deriving the keys from the specs makes it impossible to forget a parity row.
  - The digest-bound sign-off is a cheap way to keep the owner's acceptance honest.
- **Alternatives considered**:
  - A Markdown register: rejected, because it cannot be validated.
  - YAML: rejected. It needs a new dev dependency, while JSON with a JSON Schema uses Ajv, which
    is already present.
  - Scanning `dist/` for classic paths: rejected. App route paths such as `/quarantine` are
    identical strings to classic addresses in the bundle.

### R10. Arrival notice

- **Decision**:
  - **Component**: `src/features/cutover/components/ArrivalNotice.vue`. It is rendered by UI
    001's `AuthLayout` and `ShellLayout` at the top of the main content, below the announcement.
  - **Accessibility**: a non-modal region with a heading, announced once through UI 001's
    `useAnnouncer` (polite). It never blocks the screen or traps focus (FR-042, FR-049).
  - **Content** (FR-041): the classic interface has moved to this app, sign in with the usual
    account, passkeys and second factors keep working, and update your bookmarks. A fallback
    arrival adds: "The page you opened has no exact counterpart; this is the closest screen."
  - **Actions**: "Close" hides the notice for this visit, and "Don't show again" hides it on this
    device. Both are at least 44 × 44 px.
  - **State**: the arrival state lives in memory. It is set by the arrival route and survives the
    sign-in screens, because the app is a single page. The notice therefore appears on the
    sign-in screen and stays until it is closed or the user leaves the target screen.
  - **Device memory**, conveniences only (constitution V; data-model §6):
    - `localStorage['mailcowui-ng.arrival-notice-visits']`: `0` to `3`;
    - `localStorage['mailcowui-ng.arrival-notice-dismissed']`: `'1'`;
    - `sessionStorage['mailcowui-ng.arrival-notice-counted']`: `'1'`, which counts a visit at
      most once per tab session.
  - **When the notice stops**: once the visits reach 3 or it is dismissed, an exact arrival shows
    nothing. A fallback arrival still shows the fallback sentence on its own, in the same
    component (FR-042). A direct visit, which never passes through the arrival route, shows
    nothing (US5-AS4).
  - **Translations**: the keys are under `cutover.arrival.*` in `en-gb`, `cs-cz` and `sk-sk`, and
    use "the classic interface" (FR-039, constitution IV).
- **Rationale**: the notice reuses the shell's announcement slot and live region. Storage holds
  only counters, which UI 001's storage allowlist test can extend.
- **Alternatives considered**:
  - A modal: rejected. It would block the screen, which FR-042 forbids.
  - A toast: rejected. It disappears before screen-reader users can act on it.
  - A server cookie set by nginx: rejected. The app would have to read a cookie, and a cookie
    cannot express "visits" without arithmetic.

---

## 4. Single source and verification

### R11. One authoritative mapping

- **Decision**:
  - **The source**: `cutover/mapping.json`, validated by `cutover/mapping.schema.json` (data-model
    §2). It holds:
    - the rows M01–M33 and F1–F3, each with its patterns, used-by set, carried values, decode
      rule, target route and samples;
    - the exclusions X01–X16, each with its samples;
    - the entry allowlist;
    - `verifiedAgainst`: the mailcow releases, with their nginx image and template checksums,
      starting with `2026-09a` (FR-030).
  - **The generator**: `npm run cutover:generate` (`scripts/cutover/generate.mjs`) writes these
    files deterministically:
    - `deploy/cutover/nginx/ng-cutover.conf` and `deploy/cutover/nginx/site.ng-cutover.custom`,
      each headed by `# mapping-digest: sha256:<hex>`;
    - `deploy/cutover/data/smoke-cases.json`;
    - `docs/cutover/mapping.md`, the documented mapping.
  - **The checks**:
    - `npm run cutover:check` fails when a generated file differs from a fresh generation, as
      `contract:check` does (FR-029).
    - The app imports the same JSON for resolution (R3).
    - The digest is the SHA-256 of the canonical JSON: sorted keys, no whitespace.
- **Rationale**: one file feeds the nginx rules, the smoke test, the documentation and the app, so
  they cannot disagree. The digest carries that guarantee into each installation.
- **Alternatives considered**:
  - A TypeScript mapping: rejected. The operator tooling and the generator would need TypeScript
    tooling, and the nginx side cannot use route types anyway.
  - Hand-written nginx rules: rejected by FR-029.

### R12. The cutover smoke test

- **Decision**:
  - **Implementation**: `ng-cutover smoke`, which wraps `deploy/cutover/lib/smoke.mjs`. It is
    zero-dependency ESM on `node:https`, with `lookup` and `servername` for `--resolve`-style
    pinning.
  - **Properties** (FR-043):
    - read-only;
    - no account or credential;
    - concurrency 4, about 400 requests per host, under one minute.
  - **Host names**: `MAILCOW_HOSTNAME` and every `ADDITIONAL_SERVER_NAMES` entry from
    `mailcow.conf`, or `--host` (repeatable). For X14 it also sends `autodiscover.<domain>` and
    `autoconfig.<domain>` as Host and SNI to the main host's address. `<domain>` comes from
    `--mail-domain` and defaults to the parent of `MAILCOW_HOSTNAME`. Certificate verification
    is skipped only for those two checks, and the report marks them.
  - **Cases**, from `smoke-cases.json`:
    - every row's samples in their canonical, `.php` and trailing-slash forms, plus the query
      form for M16–M32;
    - the token and flag variants;
    - every exclusion's samples;
    - a `POST` to M01 and M05 with an empty form body. The classic triggers act only on named
      fields, so nothing changes;
    - the entry with each allowlist key, an unknown key, and the exit;
    - a classic pass and half a pass on one row per role.
  - **Modes**:
    - `--record-baseline` requires every switch to be off. It records each case's status,
      content type and `Location`, and the mapping digest, in
      `var/baseline-<host>.json`, together with the result. It fails when
      `/ng/release.json` is missing or its digest differs, which is how it checks that every target
      exists in the deployed app.
    - Without the flag, the test reads the installed switch state from the state file, or
      `--switches` when run remotely, and compares:
      - for a row that is on: `302`, the exact `Location` (row and fragment) and
        `Cache-Control: no-store`;
      - for a row that is off: the baseline's status, content type and `Location`;
      - for every exclusion: the baseline's status and content type (SC-002).
  - **Output**:
    - a table, one line per case, host and state, with the expected and actual answers and pass
      or fail;
    - with `--json`, the same as JSON lines;
    - a final line `RESULT pass|fail rollback-recommended=yes|no`.
  - **Exit codes**: `0` pass, `1` fail, `3` fail with rollback recommended (an exclusion failed,
    FR-048), `2` usage error.
  - **Change detection**: after a mailcow update, every classic address that is not redirected is
    compared with the baseline. A changed answer is reported (US6-AS5). The installed release is
    compared with `verifiedAgainst` and reported.
- **Rationale**:
  - Status, content type and `Location` are the observable properties the spec names.
  - JSON lines and exit codes make the test usable from automation.
  - Running from the host with `--resolve`, or from anywhere against the public names, covers
    operators behind a reverse proxy.
- **Alternatives considered**:
  - A bash and curl test: rejected. It cannot be unit-tested well, and JSON handling would need
    `jq`, which mailcow does not require.
  - Playwright: rejected, because browsers would be needed on the mail host. The app's browser
    behaviour is covered by FR-045's end-to-end tests and the smoke suite.

### R13. Not-found and fallback monitoring

- **Decision**:
  - **`ng-cutover collect [--day YYYY-MM-DD]`**:
    1. It reads nginx-mailcow's records for the day (`docker compose logs --no-log-prefix --since
       --until nginx-mailcow`), or a file given with `--input`.
    2. It parses the `combined` lines and the `ngc_cutover` lines.
    3. It writes `var/collected/<day>.json`: per normalised address, the counts of `404` answers,
       fallback redirects (F1–F3) and redirects per row.
  - **Normalisation** (FR-046):
    - query values are replaced by `…`, keeping the parameter names;
    - row values are replaced by `{value}`, for example `/edit/mailbox/{value}`;
    - nothing else is stored, so the daily files hold no personal data beyond the addresses that
      the access records already hold.
  - **Why `collect`**: Docker's default `json-file` logs are lost when mailcow's update recreates
    the container. The runbook therefore has the operator schedule `collect` daily in the host's
    cron, starting at least 7 days before the first switch change.
  - **`ng-cutover report --days 14 --baseline-days 7`** reads the collected days. It prints:
    - each address with its daily counts;
    - the daily total of `404` answers for classic addresses (everything outside `/ng/` and
      `/api/v2/`), compared with the baseline's daily average. It flags more than 5 % above
      (SC-008);
    - each fallback address seen on 3 or more days that is not yet documented (FR-047).

    Operators document an address in `var/address-notes.json` as `mapped-request`, `expected` or
    `noise`, with a note. The report marks documented addresses, and `--json` gives the same data.
- **Rationale**: it is read-only, works from the records the operator already has, survives
  container recreation through the daily aggregates, and makes the SC-008 thresholds mechanical.
- **Alternatives considered**:
  - A log shipper or Prometheus exporter: rejected. It means a new container, which is out of
    proportion for a 14-day window.
  - Counting in the app: rejected. The static app has no backend, and redirects that browsers do
    not follow would be missed.

### R14. Rollback

- **Decision**:
  - **The rollback** is `ng-cutover apply none`, or a role list without the affected role for a
    partial rollback, followed by `ng-cutover smoke`. Turning roles off is never refused and
    needs neither the app nor the API. The runbook's procedure takes about 5 minutes (SC-010):
    status, apply, smoke and announcement.
  - **Why nothing else is needed** (FR-024, FR-025):
    - The switch touches no data path. Both interfaces always write the same mailcow database
      through their own code (API constitution V). The app's own data (`restv2_` tables: API keys,
      preferences, audit records, passkey names) is not touched and is there when cutover is
      turned on again.
    - Sessions live in Redis (classic) and in the API's store. A reload ends neither.
    - Redirects are `302` with `no-store` and were never cached, so browsers that followed them
      reach the classic pages at once (SC-004).
  - **Emergency path without the tool**: write `ngc "000";` into the state file, or delete the
    file (the wildcard include then means all off), then run
    `docker compose exec nginx-mailcow nginx -s reload`. The runbook documents both.
  - **Removal**: `ng-cutover uninstall` after `apply none`.
  - **Data check** (SC-004): on a test installation, the runbook rehearsal runs `CHECKSUM TABLE`
    over the mailcow tables before and after a switch change made without user activity. The
    checksums must be equal.
- **Rationale**: rollback is the same mechanism as the switch, with its preconditions removed.
- **Alternatives considered**: rollback by restoring backups or reverting releases. Rejected,
  because FR-024 forbids it and it is slower.

---

## 5. Testing

### R15. Test layers

- **Decision** (constitution VI; every layer is written first):
  - **Unit (Vitest)**:
    - mapping integrity against the spec's tables;
    - generator output and determinism;
    - `resolveArrival` and `decodeAsClassic`, table-driven;
    - arrival state and counters;
    - `ArrivalNotice`, `ClassicApiKeysNote` and the `classic-target` page with mocked
      operations;
    - the target routes against the real router;
    - the readiness and classic-link checkers, with valid and invalid fixtures;
    - the smoke runner's expectation logic against an in-process `node:http` server;
    - the report's parser and thresholds on fixture logs;
    - the release manifest writer;
    - the storage allowlist extension.
  - **End-to-end (Playwright, mock API)** on `mobile-chromium`, `desktop-chromium` and
    `mobile-webkit`, with axe in both themes:
    - every row's target opened through `/ng/arrival/<row>#…` with a classic identifier, signed
      out and signed in (FR-045, SC-005);
    - the arrival notice's lifecycle (US5);
    - the API keys note (US4);
    - the rendered-link crawl (SC-006).
  - **nginx configuration tests** (`npm run test:nginx`, Docker) run the **real** mailcow nginx
    image of each verified release (`ghcr.io/mailcow/nginx:1.30.4-1` for `2026-09a`, pinned by
    digest). Its own `bootstrap.py` renders the vendored upstream templates
    (`tests/nginx/upstream/2026-09a/`), so nothing is re-implemented. The stub services are:
    - `php-fpm-mailcow`: `php:8.4-fpm-alpine` on 9001 and 9002, with a fixture docroot that answers
      like the classic pages for status, content type and `Location`, including `404` on
      `autodiscover.` hosts;
    - SOGo and Rspamd: small HTTP stubs;
    - `restv2-mailcow`: a FastCGI stub with health and public-config fixtures;
    - `ng-mailcow`: the built app image, or a static stub with `release.json`.

    The tests drive every smoke case in the off, partial (each role alone, and administrators
    plus domain administrators), full and rolled-back states. They also cover:
    - the CLI commands, including the refusals and the restore on an invalid configuration;
    - durability across `docker compose restart nginx-mailcow`;
    - `nginx -T`, which must show the snippet only in public servers (X15);
    - the smoke tool and the report against the harness.
  - **Smoke suite (real mailcow-rest-v2)**: `scripts/smoke/stack-up.sh --with-cutover` adds the
    real mailcow nginx image to UI 001's smoke stack (API dev stack plus app image), with the
    cutover files and the classic stub. `tests/smoke/cutover.smoke.spec.ts` then follows real
    bookmarks through real sign-ins: one row per delivering feature, plus M13 with a token minted
    through `POST /domain-admins/{username}/sso-token` and M03 where the dev stack can issue a
    reset token.
  - **Vendoring**: `scripts/cutover/vendor-nginx-templates.sh <tag>` copies `nginx.conf.j2` and
    `sites-default.conf.j2` from a mailcow checkout (`git show <tag>:…`, `$MAILCOW_REPO`, default
    `../mailhosting`). It records their SHA-256 and the nginx image of `docker-compose.yml` at that
    tag in `mapping.json → verifiedAgainst`. Adding a release is a deliberate change, like a
    contract bump.
- **Rationale**: the real image with the real templates is the only faithful test of an include
  that runs inside upstream's configuration. Stubs keep the harness fast (about 2 minutes in CI)
  and free of mail services.
- **Alternatives considered**:
  - Rendering the templates with Jinja2 in a test: rejected. It re-implements `bootstrap.py` and
    needs Python.
  - Testing against a full mailcow stack in CI: rejected. It is too heavy, and the runbook
    rehearsal on a test installation covers it.

### R16. Runbook and announcement texts

- **Decision**: `docs/cutover/runbook.md` is the operator's document. It holds:
  - the preconditions (FR-001);
  - installation and its order (R7);
  - baseline collection (`collect` for 7 days, `smoke --record-baseline`);
  - the switch order and the shared-address note;
  - the smoke test after every change, rollback and update (FR-044);
  - the 14-day monitoring with daily `report`, and the rollback triggers (FR-047, FR-048);
  - the end-to-end checks of SC-002: mail client autoconfiguration, an `/api/v1` read with a key,
    a webmail sign-in, an ActiveSync sync, a quarantine quick release and an OAuth2 sign-in with a
    test application;
  - uptime monitors: point them at `/api/v2/health/live` or `/ng/` before switching mailbox users,
    because `/` becomes a redirect;
  - a review of operator app links that point to classic addresses;
  - uninstalling.

  The announcement texts are given in English, Czech and Slovak, for "before" (with the date
  placeholder, the new address `/ng/`, signing in again, passkeys and second factors, forwarded
  bookmarks, and unaffected webmail, mail apps and quarantine links) and "after" (with where to get
  help). The runbook recommends at least 7 days ahead and at least 14 days after (FR-040).
- **Rationale**: one document for the operator, whose commands are all `ng-cutover`
  subcommands.

---

## 6. Legacy flows checked

### R17. Classic flows that must keep working, and their outcome

| Flow (baseline code) | With cutover on | Result |
|---|---|---|
| OAuth2 provider: `/oauth/authorize` without a classic session answers `Location: /?oauth` (`oauth/authorize.php`) | `/?oauth` matches X08. The password form posts to the same URL (X12). A pending second factor renders on the `POST` answer and verifies by `POST`. Passkey sign-in reloads `window.location.href`, which still carries `?oauth`. Each success answers `Location: <oauth2_request>` (X07) | Works, including the second factor (US2-AS4) |
| OAuth2 with cancel of the second factor (`?cancel_tfa_login` answers `Location: /`) | The cancel itself is X08. The following `/` leads to the app's start | Accepted. The user restarts the authorisation from the application. Noted in the runbook |
| OAuth2 sign-in when the classic session has pending actions (`Location: /` to show the modal) | `/` leads to the app, whose pending-actions screen resolves them through the API (shared database) | Accepted. After that, the next authorisation attempt succeeds in the classic interface |
| Classic single sign-on: `?iam_sso` goes to the IdP, which returns to `/?code=…&state=…` (`triggers.user.inc.php`) | Both are X08. With an OAuth2 request pending, `index.php` forwards to it (X07). Otherwise to `/SOGo/so/` (X03) or `/user` (M02 when mailbox users are on, so the app) | Works for OAuth2 and webmail. A plain classic sign-in then lands in the app, as intended |
| `/mobileconfig.php` signed out answers `Location: index.php?mobileconfig[&only_email][&app_password]` (relative, so `/index.php?…`) | M33 leads to the app's Mail app setup with the options preselected (FR-050) | Works (US2-AS5). The download address itself is X04 |
| Webmail sign-out posts to `/`, then opens `/` | The `POST` is X12. The `GET` follows M01 | As the spec says |
| Domain administrator SSO: `?sso_token` on `/domainadmin`, `/domainadmin/mailbox` and `/domainadmin/user` (`triggers.domainadmin.inc.php`) | M13 leads to UI 007's landing | Works, with tokens accepted by both interfaces (API 007) |
| Login-as `?duallogin=` (`triggers.global.inc.php`, every page) | The parameter is dropped. It works only with a classic pass | As the spec's parity table says |
| `protect_route` sends unauthenticated requests to `/admin`, `/domainadmin` or `/` | Those are M05, M10 and M01, so the app's sign-in. With a classic pass they are classic | Works |
| Watchdog: `check_http` on port 8081 | Port 8081 is an internal server without the include | Unaffected |
| ACME: waits for 8081, then `curl http://nginx/` (output ignored); the challenge path is X05 | No row | Unaffected |

### R18. Edge decisions recorded by the plan

- **`/edit/…` splitting**:
  - The classic `rewrite ^/edit/(.*)/(.*)` is greedy, so the type is everything up to the last
    `/`. The rules follow that on `$uri`: a path with extra segments, or an encoded `/` in the
    value, has an unknown type and leads to F3.
  - The trailing-slash form `/edit/<type>/<value>/` is M16–M32 (FR-007), although the classic
    interface itself fails on it.
- **Extra parameters on the path form**, such as `/edit/alias/7?mailbox=x`: the path type wins
  and the parameters are dropped (FR-006). In this one case, `edit.php`'s `elseif` order could
  have chosen differently.
- **Query-form precedence**: for `/edit.php` with several type parameters, the generated regex
  order follows `edit.php`'s `if`/`elseif` order: alias, domainadmin, admin, domain, template,
  oauth2client, aliasdomain, mailbox, relayhost, transport, resource, bcc, recipient_map,
  tls_policy_map, then syncjob, filter and app-passwd. `/edit.php` with no known type, or with an
  empty value, is F3.
- **`/index.php/`, `/user/` and other trailing-slash forms**: they are redirected like the
  address itself (FR-007), where the classic interface answers `404` today. That is an
  improvement.
- **Removed addresses** `/debug`, `/queue` and `/mailbox` answer `404` today and are mapped (M06,
  M09, M15).
- **`/sogo-auth`** on any port matches no row, and the port guard covers `65510`.
- **IPv6, PROXY protocol and `TRUSTED_PROXIES`** do not matter. The decision uses only the
  method, the host, the path, the query string, the cookies and the local port.
- **Operator files** under `data/web/` are reachable at their paths. They are redirected only if
  they lie under `/admin/` or `/domainadmin/` (F1, F2), as the spec defines.
