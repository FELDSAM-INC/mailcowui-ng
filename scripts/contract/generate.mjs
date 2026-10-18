// Regenerates contract/openapi.json and src/api/generated/schema.ts from the vendored bundle
// (research R6, R7). Run through `npm run contract:generate`; never edit the outputs by hand.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const bin = (name) => join(root, 'node_modules/.bin', name)
const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, REDOCLY_TELEMETRY: 'off' },
  })

run(bin('redocly'), ['bundle', 'contract/openapi.yaml', '--ext', 'json', '-o', 'contract/openapi.json'])

mkdirSync(join(root, 'src/api/generated'), { recursive: true })
run(bin('openapi-typescript'), [
  'contract/openapi.yaml',
  '-o',
  'src/api/generated/schema.ts',
  '--root-types',
  '--root-types-no-schema-prefix',
  '--enum-values',
  '--read-write-markers',
  '--alphabetize',
])
