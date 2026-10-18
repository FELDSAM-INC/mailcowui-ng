#!/usr/bin/env bash
# Builds this repository's image from a clean `git archive main` and deploys it to a mailcow host
# without a registry (research R29):
#
#   scripts/deploy/push-to-mailcow.sh <ssh-host> <mailcow-dir>
#   scripts/deploy/push-to-mailcow.sh root@maildev.feldhost.cz /root/mailhosting
#
#   1. exports main into a temporary directory, so uncommitted files and other worktrees never
#      reach the image;
#   2. builds docker/Dockerfile as mailcowui-ng:<short sha>;
#   3. streams it to the host with docker save | ssh docker load;
#   4. sets that tag as the `image:` of ng-mailcow in <mailcow-dir>/docker-compose.override.yml,
#      checked with `docker compose config -q` before the file is replaced;
#   5. runs `docker compose up -d --no-deps ng-mailcow`, so no other mailcow container is started,
#      recreated or restarted;
#   6. waits for the container's health check, then requests /ng/ through nginx-mailcow at
#      https://<MAILCOW_HOSTNAME> and checks its Content-Security-Policy header.
#
# The service must already be in the override, with `pull_policy: never` (first installation:
# deploy/docker-compose.override.yml and quickstart Part D), and mailcow-rest-v2's
# site.restv2.custom must route /ng/. The previous image stays on the host for a rollback; its tag
# is printed.
#
# Environment: REF (default main), HEALTH_TIMEOUT in seconds (default 180), PUBLIC_URL (default
# https://<MAILCOW_HOSTNAME of the host's mailcow.conf>).
set -euo pipefail

SERVICE=ng-mailcow
IMAGE_NAME=mailcowui-ng
DOCKERFILE=docker/Dockerfile
HEALTH_PATH=/ng/

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <ssh-host> <mailcow-dir>" >&2
  exit 2
fi

host="$1"
mailcow_dir="$2"
ref="${REF:-main}"
health_timeout="${HEALTH_TIMEOUT:-180}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

commit="$(git -C "$root" rev-parse --verify "$ref^{commit}")"
image="$IMAGE_NAME:$(git -C "$root" rev-parse --short "$commit")"

# Fail before the build when the host, the directory or the service is not there. The arguments
# of the remote bash are quoted here, on the client (SC2029 is intended).
# shellcheck disable=SC2029
hostname_on_host="$(ssh "$host" "bash -s -- $(printf '%q ' "$mailcow_dir" "$SERVICE")" <<'PREFLIGHT'
set -euo pipefail
cd "$1"
if ! grep -q "^  $2:\$" docker-compose.override.yml 2>/dev/null; then
  echo "error: service $2 not found in $1/docker-compose.override.yml; install it first" >&2
  exit 1
fi
sed -n 's/^MAILCOW_HOSTNAME=//p' mailcow.conf | tr -d "\"' "
PREFLIGHT
)"
public_url="${PUBLIC_URL:-https://$hostname_on_host}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "==> building $image from $ref ($commit)"
git -C "$root" archive "$commit" | tar -x -C "$work"
docker build -f "$work/$DOCKERFILE" --label "org.opencontainers.image.revision=$commit" \
  -t "$image" "$work"

echo "==> loading $image on $host"
docker save "$image" | gzip -1 | ssh "$host" 'gunzip | docker load'

echo "==> deploying $image as $SERVICE in $host:$mailcow_dir"
# shellcheck disable=SC2029
ssh "$host" "bash -s -- $(printf '%q ' "$mailcow_dir" "$SERVICE" "$image" "$health_timeout")" \
  <<'REMOTE'
set -euo pipefail
dir="$1" service="$2" image="$3" timeout="$4"
cd "$dir"
override=docker-compose.override.yml

# The first `image:` line inside the service's block (services are indented by two spaces).
current="$(awk -v svc="  $service:" '
  $0 == svc { inside = 1; next }
  inside && /^  [^ #]/ { exit }
  inside && /^    image:/ { print $2; exit }' "$override")"
if [[ -z "$current" ]]; then
  echo "error: no image: line in the $service block of $dir/$override" >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
awk -v svc="  $service:" -v img="$image" '
  $0 == svc { inside = 1; print; next }
  inside && /^  [^ #]/ { inside = 0 }
  inside && !done && /^    image:/ { sub(/image:.*/, "image: " img); done = 1 }
  { print }' "$override" > "$tmp"
# Relative paths resolve against docker-compose.yml's directory, so the copy validates as is.
docker compose -f docker-compose.yml -f "$tmp" config -q
cat "$tmp" > "$override"    # keeps the file's owner and mode
docker compose config -q
echo "image: $current -> $image"

docker compose up -d --no-deps "$service"

cid="$(docker compose ps -q "$service")"
deadline=$((SECONDS + timeout))
while :; do
  status="$(docker inspect -f \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
  [[ "$status" == healthy ]] && break
  if [[ "$status" == unhealthy || "$status" == exited ]] || (( SECONDS >= deadline )); then
    echo "error: $service is $status" >&2
    docker compose logs --tail 40 "$service" >&2
    echo "roll back: set image: $current in $dir/$override," \
      "then docker compose up -d --no-deps $service" >&2
    exit 1
  fi
  sleep 3
done
echo "$service: healthy ($image)"
echo "previous image kept for a rollback: $current"
REMOTE

echo "==> checking $public_url$HEALTH_PATH"
for _ in 1 2 3 4 5; do
  headers="$(curl -sS -o /dev/null -D - "$public_url$HEALTH_PATH" || true)"
  [[ "$headers" =~ ^HTTP/[0-9.]+\ 200 ]] && break
  sleep 2
done
if [[ ! "$headers" =~ ^HTTP/[0-9.]+\ 200 ]]; then
  echo "error: $public_url$HEALTH_PATH did not answer 200" >&2
  exit 1
fi
if ! grep -qi "^content-security-policy: default-src 'none'" <<<"$headers"; then
  echo "error: $public_url$HEALTH_PATH has no Content-Security-Policy header" >&2
  exit 1
fi
echo "deployed $image to $host:$mailcow_dir; $HEALTH_PATH answers 200 with the CSP"
