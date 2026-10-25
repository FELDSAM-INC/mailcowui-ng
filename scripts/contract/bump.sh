#!/usr/bin/env bash
# Pins a mailcow-rest-v2 contract (research R6).
#
#   scripts/contract/bump.sh <tag-or-commit>
#
# Resolves the ref in $MAILCOW_REST_V2_DIR (default ../mailcow-rest-v2), or in a fresh clone when
# that directory is missing, extracts api/ with `git archive`, lints and bundles it with the API's
# own Redocly version, writes contract/VERSION.json and regenerates the client types.
# Never pin "the latest commit": later features share the tree and the 0.1.0 version.
set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "usage: $0 <tag-or-commit>" >&2
  exit 2
fi

ref="$1"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
api_dir="${MAILCOW_REST_V2_DIR:-$root/../mailcow-rest-v2}"
repository="FELDSAM-INC/mailcow-rest-v2"
bundler="@redocly/cli@2.64.1"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export REDOCLY_TELEMETRY=off
api_git=(git)

if [[ ! -d "$api_dir/.git" ]]; then
  echo "No checkout at $api_dir; cloning $repository" >&2
  if [[ -n "${MAILCOW_REST_V2_TOKEN:-}" ]]; then
    # Git reads the token through askpass; argv and the saved remote URL stay public.
    # Disable credential helpers so the temporary token is not persisted elsewhere.
    cat > "$work/git-askpass" <<'ASKPASS'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$MAILCOW_REST_V2_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
    chmod 700 "$work/git-askpass"
    api_git=(env GIT_ASKPASS="$work/git-askpass" GIT_TERMINAL_PROMPT=0 git -c credential.helper=)
  fi
  "${api_git[@]}" clone --quiet --filter=blob:none "https://github.com/${repository}.git" "$work/repo"
  api_dir="$work/repo"
fi

commit="$(git -C "$api_dir" rev-parse --verify --quiet "${ref}^{commit}" || true)"
if [[ -z "$commit" ]]; then
  "${api_git[@]}" -C "$api_dir" fetch --quiet --tags origin || true
  commit="$(git -C "$api_dir" rev-parse --verify "${ref}^{commit}")"
fi
echo "Pinning $repository at $commit (ref $ref)" >&2

mkdir -p "$work/src"
git -C "$api_dir" archive "$commit" api | tar -x -C "$work/src"

redocly="$root/node_modules/.bin/redocly"
(cd "$work/src" && "$redocly" lint api/openapi.yaml)
(cd "$work/src" && "$redocly" bundle api/openapi.yaml -o bundle.yaml)

mkdir -p "$root/contract"
cp "$work/src/bundle.yaml" "$root/contract/openapi.yaml"

sha256="$(sha256sum "$root/contract/openapi.yaml" | cut -d' ' -f1)"
node --input-type=module - "$root" "$repository" "$ref" "$commit" "$sha256" "$bundler" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [root, repository, ref, commit, sha256, bundler] = process.argv.slice(2)
const yaml = readFileSync(join(root, 'contract/openapi.yaml'), 'utf8')
const contractVersion = /^info:\n(?:[ ].*\n)*?[ ]+version:\s*['"]?([^'"\n]+)['"]?$/m.exec(yaml)?.[1]
if (!contractVersion) throw new Error('info.version not found in the bundle')
const record = {
  repository,
  ref,
  commit,
  contractVersion,
  sha256,
  bundler,
  pinnedAt: new Date().toISOString(),
}
writeFileSync(join(root, 'contract/VERSION.json'), JSON.stringify(record, null, 2) + '\n')
console.error(`contract ${contractVersion} sha256 ${sha256}`)
NODE

(cd "$root" && npm run --silent contract:generate)
echo "Pinned. Now run: npm run typecheck && npm run test:unit && npm run test:e2e" >&2
