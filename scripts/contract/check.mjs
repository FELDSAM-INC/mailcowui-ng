// CI check of the vendored contract (research R6): the bundle matches the checksum recorded in
// contract/VERSION.json, and the generated files are exactly what the generator produces.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const version = JSON.parse(readFileSync(join(root, 'contract/VERSION.json'), 'utf8'))
const actual = createHash('sha256')
  .update(readFileSync(join(root, 'contract/openapi.yaml')))
  .digest('hex')

if (actual !== version.sha256) {
  console.error(
    `contract/openapi.yaml sha256 ${actual} does not match VERSION.json ${version.sha256}.\n` +
      'The vendored contract was edited by hand. Pin it again with scripts/contract/bump.sh.',
  )
  process.exit(1)
}
console.log(`contract ${version.contractVersion} @ ${version.commit}: checksum ok`)

execFileSync(process.execPath, [join(root, 'scripts/contract/generate.mjs')], {
  cwd: root,
  stdio: 'inherit',
})

const paths = ['contract', 'src/api/generated']
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', ...paths], {
  cwd: root,
  encoding: 'utf8',
}).trim()
if (untracked) {
  console.error(`Untracked generated files (commit them):\n${untracked}`)
  process.exit(1)
}
try {
  execFileSync('git', ['diff', '--exit-code', '--stat', '--', ...paths], {
    cwd: root,
    stdio: 'inherit',
  })
} catch {
  console.error('Generated files differ from the vendored contract. Run npm run contract:generate.')
  process.exit(1)
}
console.log('generated files up to date')
