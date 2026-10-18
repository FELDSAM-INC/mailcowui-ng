// `npm run dev:mock` and `npm run preview:mock`: the mock API (tests/mocks/server.ts) together with
// the Vite dev server or `vite preview` (production build with the production CSP), proxying
// /api/v2 to the mock. Stops both when either exits or on Ctrl+C.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2]
if (mode !== 'dev' && mode !== 'preview') {
  console.error('usage: with-mock.mjs dev|preview')
  process.exit(2)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const bin = (name) => join(root, 'node_modules/.bin', name)
const mockPort = process.env.MOCK_PORT ?? '4010'
const target = `http://127.0.0.1:${mockPort}`
const extra = process.argv.slice(3)

const children = [
  spawn(bin('tsx'), ['--tsconfig', 'tsconfig.vitest.json', 'tests/mocks/server.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, MOCK_PORT: mockPort },
  }),
  spawn(
    bin('vite'),
    mode === 'dev' ? extra : ['preview', '--port', process.env.PREVIEW_PORT ?? '4173', ...extra],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, API_PROXY_TARGET: target, MOCK_API_TARGET: target },
    },
  ),
]

let stopping = false
const stopAll = (code) => {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  process.exitCode = code ?? 0
}
for (const child of children) child.on('exit', (code) => stopAll(code ?? 0))
process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
