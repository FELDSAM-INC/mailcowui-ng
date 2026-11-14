import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
const smoke = workflow.split('\n  smoke:\n')[1]?.split('\n  publish:\n')[0]
assert.ok(smoke, 'The smoke job must exist')
const condition = smoke.match(/^    if: >-\n((?:      .*\n)+)/m)?.[1].trim()
assert.ok(condition, 'The smoke job must have an explicit event/ref condition')

// This is the checked-in workflow expression, evaluated with synthetic GitHub contexts only.
function enabled(event, ref, flag = 'true') {
  return runInNewContext(
    `(${condition})`,
    {
      github: { event_name: event, ref },
      vars: { SMOKE_ENABLED: flag },
      startsWith: (value, prefix) => value.startsWith(prefix),
    },
    { timeout: 100 },
  )
}

test('pull requests never run smoke, including same-repository and target events', () => {
  for (const event of ['pull_request', 'pull_request_target']) {
    for (const ref of ['refs/pull/1/merge', 'refs/heads/main', 'refs/tags/v0.1.0-preview.5']) {
      assert.equal(enabled(event, ref), false)
    }
  }
})

test('manual runs on contributor branches cannot run smoke', () => {
  assert.equal(enabled('workflow_dispatch', 'refs/heads/contributor'), false)
})

test('trusted refs retain manual, scheduled and opt-in smoke coverage', () => {
  assert.equal(enabled('workflow_dispatch', 'refs/heads/main', 'false'), true)
  assert.equal(enabled('schedule', 'refs/heads/main', 'false'), true)
  assert.equal(enabled('push', 'refs/heads/main', 'true'), true)
  assert.equal(enabled('push', 'refs/heads/main', 'false'), false)
  assert.equal(enabled('push', 'refs/tags/v0.1.0-preview.5', 'true'), true)
})

test('public companion checkout does not receive a dedicated secret or persist credentials', () => {
  assert.doesNotMatch(smoke, /secrets\.|\btoken:/)
  const checkouts = smoke.split(/      - uses: actions\/checkout@/).slice(1)
  assert.equal(checkouts.length, 2)
  for (const checkout of checkouts) {
    assert.match(checkout.split('\n      - ')[0], /persist-credentials: false/)
  }
})
