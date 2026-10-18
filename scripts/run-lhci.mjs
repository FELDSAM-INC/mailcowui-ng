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
  { url: `http://localhost:${previewPort}/ng/sign-in`, scenario: 'anonymous-default' },
  { url: `http://localhost:${previewPort}/ng/`, scenario: 'admin-active' },
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

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
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
for (const { url, scenario } of collections) {
  const mock = start(bin('tsx'), ['tests/mocks/server.ts'], {
    MOCK_PORT: String(mockPort),
    MOCK_DEFAULT_SCENARIO: scenario,
  })
  const preview = start(bin('vite'), ['preview', '--port', String(previewPort), '--strictPort'], {
    MOCK_API_TARGET: `http://127.0.0.1:${mockPort}`,
  })
  try {
    await waitFor(`http://127.0.0.1:${mockPort}/__mock/health`)
    await waitFor(`http://localhost:${previewPort}/ng/`)
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
