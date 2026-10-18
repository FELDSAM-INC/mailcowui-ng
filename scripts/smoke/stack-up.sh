#!/usr/bin/env bash
# Starts a real mailcow-rest-v2 dev stack with this repository's image attached as `ng-mailcow`,
# for the smoke suite (research R25):
#
#   scripts/smoke/stack-up.sh && npm run test:smoke && scripts/smoke/stack-down.sh
#
# The API is checked out at contract/VERSION.json's `commit`, or at SMOKE_API_REF, in a separate
# git worktree under .smoke/api, so the developer's own checkout and dev stack are never touched.
# It runs as its own Compose project (SMOKE_PROJECT) on its own ports (SMOKE_WEB_PORT, and
# SMOKE_WEB_TLS_PORT for the API's HTTPS listener, which would otherwise take the developer's 18443).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
api_dir="${MAILCOW_REST_V2_DIR:-$root/../mailcow-rest-v2}"
work="${SMOKE_WORKDIR:-$root/.smoke/api}"
project="${SMOKE_PROJECT:-mailcowui-ng-smoke}"
port="${SMOKE_WEB_PORT:-18480}"
tls_port="${SMOKE_WEB_TLS_PORT:-18483}"
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

compose() {
  (cd "$work" && RESTV2_WEB_PORT="$port" RESTV2_WEB_TLS_PORT="$tls_port" \
    RESTV2_UID="$(id -u)" RESTV2_GID="$(id -g)" docker compose -p "$project" "$@")
}

# 1. The API dev stack and the setup commands of the API quickstart (Part A, steps 1-2), then the
#    dev database with the DevelopmentSeeder accounts (Part B).
compose up -d --build
compose run --rm app composer install --no-interaction
compose run --rm app sh -c 'test -f .env || cp .env.example .env'
compose run --rm app php artisan key:generate --force
compose run --rm app scripts/dev/reset-dev-database.sh

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

# 5. UI 012 (research R25): with SMOKE_IDP=1, the API's `idp` profile (OpenLDAP, and Keycloak for
#    the manual single sign-on checks), for the identity provider smoke tests tagged @idp.
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
  if [[ -z "${SMOKE_SSO_USERNAME:-}" ]]; then
    echo "idp: SMOKE_SSO_USERNAME and SMOKE_SSO_PASSWORD are not set; the single sign-on smoke" \
      "test (@sso) will be skipped"
  fi
fi

echo "ready: http://localhost:${port}/ng/"
echo "run:   SMOKE_BASE_URL=http://localhost:${port}/ng/ npm run test:smoke"
