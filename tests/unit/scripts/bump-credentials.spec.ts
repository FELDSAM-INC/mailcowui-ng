import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = join(process.cwd(), 'scripts/contract/bump.sh')
const token = 'test-only-contract-token'

interface GitCall {
  args: string[]
  askpass?: string
  authenticated: boolean
}

describe('contract update credentials', () => {
  it.each([
    { authenticated: true, failClone: false },
    { authenticated: false, failClone: false },
    { authenticated: true, failClone: true },
  ])('keeps credentials private for $authenticated auth, clone failure $failClone', (scenario) => {
    const root = mkdtempSync(join(tmpdir(), 'contract-auth-test-'))
    try {
      const bin = join(root, 'bin')
      const work = join(root, 'work')
      const scripts = join(root, 'scripts/contract')
      for (const dir of [bin, work, scripts]) mkdirSync(dir, { recursive: true })
      copyFileSync(script, join(scripts, 'bump.sh'))
      const log = join(root, 'git-calls.jsonl')
      // Exercise the actual shell script and askpass, stopping before contract generation.
      writeFileSync(
        join(bin, 'git'),
        `#!${process.execPath}
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
const askpass = process.env.GIT_ASKPASS
let authenticated = false
if (askpass && (args.includes('clone') || args.includes('fetch'))) {
  const ask = (prompt) => spawnSync(askpass, [prompt], { encoding: 'utf8' }).stdout.trim()
  authenticated = ask("Username for 'https://github.com': ") === 'x-access-token'
    && ask("Password for 'https://x-access-token@github.com': ") === process.env.MAILCOW_REST_V2_TOKEN
}
fs.appendFileSync(process.env.TEST_GIT_LOG, JSON.stringify({ args, askpass, authenticated }) + '\\n')
if (args.includes('clone')) {
  if (process.env.TEST_CLONE_FAIL === '1') process.exit(77)
  fs.mkdirSync(args.at(-1) + '/.git', { recursive: true })
} else if (args.includes('rev-parse')) {
  if (args.includes('--quiet')) process.exit(1)
  process.stdout.write('0123456789012345678901234567890123456789\\n')
} else if (args.includes('archive')) {
  process.exit(73)
}
`,
        { mode: 0o700 },
      )
      const result = spawnSync('bash', [join(scripts, 'bump.sh'), 'test-ref'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          TMPDIR: work,
          MAILCOW_REST_V2_DIR: join(root, 'missing-checkout'),
          MAILCOW_REST_V2_TOKEN: scenario.authenticated ? token : '',
          GIT_ASKPASS: '',
          TEST_GIT_LOG: log,
          TEST_CLONE_FAIL: scenario.failClone ? '1' : '0',
        },
      })
      expect(result.status).not.toBe(0)
      const calls = readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as GitCall)
      expect(JSON.stringify(calls)).not.toContain(token)
      expect(result.stdout + result.stderr).not.toContain(token)
      const remoteCalls = calls.filter(
        ({ args }) => args.includes('clone') || args.includes('fetch'),
      )
      expect(remoteCalls).toHaveLength(scenario.failClone ? 1 : 2)
      for (const call of remoteCalls) {
        expect(call.authenticated).toBe(scenario.authenticated)
        if (scenario.authenticated) {
          expect(call.args).toContain('credential.helper=')
          expect(call.askpass).toBeTruthy()
          expect(existsSync(call.askpass!)).toBe(false)
        }
      }
      expect(remoteCalls[0]?.args).toContain('https://github.com/FELDSAM-INC/mailcow-rest-v2.git')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
