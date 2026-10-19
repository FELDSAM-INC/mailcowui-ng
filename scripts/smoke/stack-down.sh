#!/usr/bin/env bash
# Removes everything scripts/smoke/stack-up.sh started (research R25).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
api_dir="${MAILCOW_REST_V2_DIR:-$root/../mailcow-rest-v2}"
work="${SMOKE_WORKDIR:-$root/.smoke/api}"
project="${SMOKE_PROJECT:-mailcowui-ng-smoke}"
container="${project}-ng"

docker rm -f "$container" >/dev/null 2>&1 || true
if [[ -d "$work" ]]; then
  # UI 011: the outbound fakes that stack-up.sh switched on.
  if [[ -f "$work/.env" ]]; then sed -i '/^RESTV2_FAKE_OUTBOUND=/d' "$work/.env"; fi
  # UI 012: also the `idp` profile that SMOKE_IDP=1 started; UI 009: the `routing` profile of
  # SMOKE_COMPOSE_PROFILES.
  (cd "$work" && docker compose -p "$project" --profile idp --profile routing down -v \
    --remove-orphans)
  git -C "$api_dir" worktree remove --force "$work" 2>/dev/null || rm -rf "$work"
fi
echo "smoke stack removed"
