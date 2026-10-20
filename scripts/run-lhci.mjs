// `npm run lhci` (research R26): one Lighthouse collection per mock default scenario, then one
// assertion over all results. `lighthouserc.cjs` cannot restart the servers between URLs, so this
// script starts the mock server and `vite preview` for each collection and stops them afterwards.
// Requires an existing production build (`npm run build`).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bin = (name) => join(root, 'node_modules/.bin', name)
const mockPort = Number(process.env.MOCK_PORT ?? 4010)
const previewPort = Number(process.env.PREVIEW_PORT ?? 4173)
const config = join(root, 'lighthouserc.cjs')

const collections = [
  { url: `http://127.0.0.1:${previewPort}/ng/sign-in`, scenario: 'anonymous-default' },
  { url: `http://127.0.0.1:${previewPort}/ng/`, scenario: 'admin-active' },
  // UI 002 (T104): the domain list as an administrator, 25 of 60 domains.
  { url: `http://127.0.0.1:${previewPort}/ng/domains`, scenario: 'domains-60' },
  // UI 004 T111: the alias list with 60 aliases, as an active administrator.
  { url: `http://127.0.0.1:${previewPort}/ng/aliases`, scenario: 'aliases-60' },
  // UI 010 (T109, SC-013): the DKIM keys as an administrator, 25 of 600 entries.
  { url: `http://127.0.0.1:${previewPort}/ng/dns/dkim-keys`, scenario: 'dns-many' },
  // UI 003 (T127): the mailbox list as an administrator, 25 of 10,000 mailboxes.
  { url: `http://127.0.0.1:${previewPort}/ng/mailboxes`, scenario: 'admin-mailboxes-10k' },
  // UI 009 (T116): the relayhost list as an administrator, 25 of 120 relayhosts.
  {
    url: `http://127.0.0.1:${previewPort}/ng/routing/relayhosts`,
    scenario: 'routing-relayhosts-many',
  },
  // UI 011 (research R22): the dashboard with its charts, polling every 60 s so that Lighthouse's
  // network-idle detection is not defeated. Skipped while the mock lacks the scenario.
  {
    url: `http://127.0.0.1:${previewPort}/ng/operations/dashboard`,
    scenario: 'admin-operations-lighthouse',
    optional: true,
  },
  // UI 006 (T008, SC-010): the quarantine of a mailbox user, 25 of 30 items.
  { url: `http://127.0.0.1:${previewPort}/ng/quarantine`, scenario: 'quarantine-mailbox-user' },
  // The account menu opens Password directly (owner's revised account navigation).
  { url: `http://127.0.0.1:${previewPort}/ng/account/password`, scenario: 'account-mailbox' },
  // UI 013 T176: the shared Customize layout and text-preview controls.
  {
    url: `http://127.0.0.1:${previewPort}/ng/system/customize/ui-texts`,
    scenario: 'settings-admin-defaults',
  },
]

if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('dist/ is missing. Run `npm run build` first.')
  process.exit(1)
}

function start(command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  return child
}

async function waitFor(url, timeoutMs = 30_000, child = undefined) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // The mock server exits at once when it does not know its default scenario.
    if (child && child.exitCode !== null) throw new Error(`exited with ${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    )
  })
}

function stop(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
  })
}

let first = true
for (const { url, scenario, optional } of collections) {
  const mock = start(bin('tsx'), ['--tsconfig', 'tsconfig.vitest.json', 'tests/mocks/server.ts'], {
    MOCK_PORT: String(mockPort),
    MOCK_DEFAULT_SCENARIO: scenario,
  })
  // Bound to IPv4: `localhost` alone may listen on ::1 only, which Node's fetch does not try.
  const preview = start(
    bin('vite'),
    ['preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    { MOCK_API_TARGET: `http://127.0.0.1:${mockPort}` },
  )
  try {
    try {
      await waitFor(`http://127.0.0.1:${mockPort}/__mock/health`, 30_000, mock)
    } catch (error) {
      if (!optional) throw error
      console.log(`\nLighthouse: skipped ${url}: the mock has no scenario ${scenario} yet.`)
      continue
    }
    await waitFor(`http://127.0.0.1:${previewPort}/ng/`)
    const args = ['collect', `--config=${config}`, `--url=${url}`]
    if (process.env.CHROME_PATH) args.push(`--chromePath=${process.env.CHROME_PATH}`)
    if (!first) args.push('--additive')
    console.log(`\nLighthouse: ${url} (scenario ${scenario})`)
    await run(bin('lhci'), args)
    first = false
  } finally {
    await stop(preview)
    await stop(mock)
  }
}

await run(bin('lhci'), ['assert', `--config=${config}`])
await run(bin('lhci'), ['upload', `--config=${config}`])
