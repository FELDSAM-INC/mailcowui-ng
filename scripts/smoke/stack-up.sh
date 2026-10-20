#!/usr/bin/env bash
# Starts a real mailcow-rest-v2 dev stack with this repository's image attached as `ng-mailcow`,
# for the smoke suite (research R25):
#
#   scripts/smoke/stack-up.sh && npm run test:smoke && scripts/smoke/stack-down.sh
#
# The API is checked out at contract/VERSION.json's `commit`, or at SMOKE_API_REF, in a separate
# git worktree under .smoke/api, so the developer's own checkout and dev stack are never touched.
# It runs as its own Compose project (SMOKE_PROJECT) on its own ports (SMOKE_WEB_PORT, and
# SMOKE_WEB_TLS_PORT for the API's HTTPS listener, which would otherwise take the developer's 18443;
# SMOKE_KEYCLOAK_PORT for the Keycloak of SMOKE_IDP=1, which would otherwise take 8081).
# UI 005/006: the API's `mail` profile (mailpit) receives password-reset messages and quarantine
# releases; its web UI is published on SMOKE_MAILPIT_PORT instead of the API's fixed 8025.
# SMOKE_MAIL=0 leaves it out.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
api_dir="${MAILCOW_REST_V2_DIR:-$root/../mailcow-rest-v2}"
work="${SMOKE_WORKDIR:-$root/.smoke/api}"
project="${SMOKE_PROJECT:-mailcowui-ng-smoke}"
port="${SMOKE_WEB_PORT:-18480}"
tls_port="${SMOKE_WEB_TLS_PORT:-18483}"
keycloak_port="${SMOKE_KEYCLOAK_PORT:-18481}"
mailpit_port="${SMOKE_MAILPIT_PORT:-18425}"
image="mailcowui-ng:smoke"
container="${project}-ng"
ref="${SMOKE_API_REF:-$(node -p "require('$root/contract/VERSION.json').commit")}"

if [[ ! -d "$api_dir/.git" ]]; then
  echo "mailcow-rest-v2 checkout not found at $api_dir (set MAILCOW_REST_V2_DIR)" >&2
  exit 1
fi

echo "API ref: $ref" >&2
if [[ -d "$work" ]]; then
  git -C "$work" fetch --quiet "$api_dir" "$ref" 2>/dev/null || true
  git -C "$work" checkout --quiet --detach "$ref"
else
  mkdir -p "$(dirname "$work")"
  git -C "$api_dir" worktree add --detach "$work" "$ref"
fi

# SMOKE_COMPOSE_PROFILES starts optional services of the API stack (COMPOSE_PROFILES), such as
# `routing` for the SMTP test target of UI 009's connection tests (mailpit).
profiles="${SMOKE_COMPOSE_PROFILES:-}"

# UI 006: mailpit's web UI on the smoke port, not the API's fixed 127.0.0.1:8025.
cat > "$work/compose.smoke-mail.yaml" <<YAML
services:
  mailpit:
    ports: !override
      - "127.0.0.1:${mailpit_port}:8025"
YAML

compose() {
  (cd "$work" && RESTV2_WEB_PORT="$port" RESTV2_WEB_TLS_PORT="$tls_port" \
    RESTV2_KEYCLOAK_PORT="$keycloak_port" \
    RESTV2_UID="$(id -u)" RESTV2_GID="$(id -g)" COMPOSE_PROFILES="$profiles" \
    docker compose -f compose.yaml -f compose.smoke-mail.yaml -p "$project" "$@")
}

# 1. The API dev stack and the setup commands of the API quickstart (Part A, steps 1-2), then the
#    dev database with the DevelopmentSeeder accounts (Part B).
compose up -d --build
compose run --rm app composer install --no-interaction
compose run --rm app sh -c 'test -f .env || cp .env.example .env'
# UI 011 (research R21, API 011 quickstart Part B): the outbound fakes stand in for dockerapi,
# Postfix and Rspamd, which the dev stack does not have. Development only; stack-down.sh removes it.
compose run --rm app sh -c \
  "grep -q '^RESTV2_FAKE_OUTBOUND=' .env && sed -i 's/^RESTV2_FAKE_OUTBOUND=.*/RESTV2_FAKE_OUTBOUND=y/' .env || echo RESTV2_FAKE_OUTBOUND=y >> .env"
compose run --rm app php artisan key:generate --force
# UI 005/006: both kinds of outgoing mail go to Mailpit. The isolated API uses its committed
# upstream-template fixtures because it has no real mailcow template mount.
if [[ "${SMOKE_MAIL:-1}" != "0" ]]; then
  compose run --rm app sh -c \
    "sed -i -e 's/^RESTV2_RELEASE_SMTP_HOST=.*/RESTV2_RELEASE_SMTP_HOST=mailpit/' \
      -e 's/^RESTV2_RELEASE_SMTP_PORT=.*/RESTV2_RELEASE_SMTP_PORT=1025/' \
      -e '/^RESTV2_SMTP_HOST=/d' -e '/^RESTV2_SMTP_PORT=/d' \
      -e '/^RESTV2_MAILCOW_TPLS_DIR=/d' .env
    printf '%s\n' RESTV2_SMTP_HOST=mailpit RESTV2_SMTP_PORT=1025 \
      RESTV2_MAILCOW_TPLS_DIR=tests/fixtures/mailcow-tpls >> .env"
  compose --profile mail up -d mailpit
fi
# The dev database with the DevelopmentSeeder accounts and API 006's quarantine seed.
compose run --rm app scripts/dev/reset-dev-database.sh

# UI 011 (T077, API 011 quickstart Part B): a Postfix log line for the logs smoke test, which
# searches it case-insensitively (`ALICE@example.org`).
compose exec -T redis redis-cli -a "${REDISPASS:-devredispass}" --no-auth-warning -n 0 \
  LPUSH POSTFIX_MAILLOG \
  "{\"time\":\"$(date +%s)\",\"priority\":\"err\",\"program\":\"postfix/smtp\",\"message\":\"to=<alice@example.org> bounced\"}" \
  >/dev/null

# 2. This repository's image.
docker build -t "$image" -f "$root/docker/Dockerfile" "$root"

# 3. The image on the API stack's network, under the upstream name the API's nginx proxies /ng/ to.
docker rm -f "$container" >/dev/null 2>&1 || true
docker run -d --name "$container" \
  --network "${project}_default" --network-alias ng-mailcow \
  --read-only --tmpfs /tmp --tmpfs /var/cache/nginx \
  "$image" >/dev/null

# 4. Wait for the API and the app.
wait_for() {
  local url="$1" deadline=$((SECONDS + 180))
  until curl -fsS -o /dev/null "$url"; do
    if ((SECONDS > deadline)); then
      echo "timed out waiting for $url" >&2
      exit 1
    fi
    sleep 2
  done
}
wait_for "http://127.0.0.1:${port}/api/v2/health/ready"
wait_for "http://127.0.0.1:${port}/ng/"
if [[ "${SMOKE_MAIL:-1}" != "0" ]]; then
  wait_for "http://127.0.0.1:${mailpit_port}/"
  echo "mail: mailpit ready on port ${mailpit_port}"
fi

# 5. UI 012 (research R25, T101): with SMOKE_IDP=1, the API's `idp` profile, for the identity
#    provider smoke tests: OpenLDAP (@idp) and Keycloak with the API's realm import (@sso), which
#    the browser reaches through the smoke project's host mapping (playwright.config.ts).
if [[ "${SMOKE_IDP:-}" == "1" ]]; then
  compose --profile idp up -d
  deadline=$((SECONDS + 180))
  until compose exec -T openldap ldapsearch -x -H ldap://localhost:389 -b '' -s base \
    >/dev/null 2>&1; do
    if ((SECONDS > deadline)); then
      echo "timed out waiting for OpenLDAP" >&2
      exit 1
    fi
    sleep 2
  done
  echo "idp: openldap ready"
  wait_for "http://127.0.0.1:${keycloak_port}/realms/example/.well-known/openid-configuration"
  echo "idp: keycloak ready on port ${keycloak_port}"
fi

echo "ready: http://localhost:${port}/ng/"
echo "run:   SMOKE_BASE_URL=http://localhost:${port}/ng/ npm run test:smoke"
