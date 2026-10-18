// T126: a key's details and its revocation (US7-AS4, AS5, FR-067, FR-068 and the edge cases of a
// key revoked or changed elsewhere).
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { ELSEWHERE_KEY, fixedKeyId, scenarioKey } from '../../mocks/scenarios/api-keys'

const detailPath = `api-keys/${ELSEWHERE_KEY.id}`

async function openDetail(page: Page) {
  await page.goto(detailPath)
  await expect(page.getByRole('heading', { level: 1, name: 'Monitoring' })).toBeVisible()
}

async function revoke(page: Page) {
  await page.getByRole('button', { name: 'Revoke key' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Revoke Monitoring?' })
  await expect(confirm).toContainText(
    'Programs using this key stop working immediately. Revocation cannot be undone.',
  )
  await confirm.getByRole('button', { name: 'Revoke key' }).click()
}

test('US7-AS4 FR-067 the detail shows every attribute and that keys cannot be edited', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('api-key-revoked-elsewhere')
  await openDetail(page)
  await expect(page).toHaveTitle('API key – Example Mail')
  const main = page.getByRole('main')
  for (const term of [
    'Prefix',
    'Owner',
    'Access',
    'Allow API access from these IPs/CIDR network notations',
    'Expires',
    'Status',
    'Created',
    'Created by',
    'Last used',
  ]) {
    await expect(main.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) })).toHaveCount(1)
  }
  await expect(main).toContainText(ELSEWHERE_KEY.prefix)
  await expect(main).toContainText('192.0.2.0/24')
  await expect(main).toContainText('2001:db8::/32')
  await expect(main).toContainText('192.0.2.44')
  await expect(main).toContainText('Read-Only Access')
  await expect(main).toContainText('Active')
  await expect(main).toContainText(
    'Keys cannot be edited. To change the access, networks or expiry, create a new key and revoke this one.',
  )
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('US7-AS5 FR-068 revoking asks for confirmation, then the key shows as revoked with details and stays listed', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-key-revoked-elsewhere')
  await openDetail(page)
  await page.getByRole('button', { name: 'Revoke key' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Revoke Monitoring?' })
  await expect(confirm).toBeVisible()
  await expectAccessible()
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('main')).toContainText('Active')
  await revoke(page)
  const main = page.getByRole('main')
  await expect(main.getByRole('term').filter({ hasText: /^Revoked$/ })).toHaveCount(1)
  await expect(main.getByRole('term').filter({ hasText: /^Revoked by$/ })).toHaveCount(1)
  await expect(
    main
      .getByRole('definition')
      .filter({ hasText: /^admin$/ })
      .first(),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revoke key' })).toHaveCount(0)
  await expect(page.locator('[data-live="polite"]')).toContainText('The key has been revoked.')
  await expectAccessible()
  const ops = (await mockApi.requests()).filter((r) => r.operationId === 'revokeApiKey')
  expect(ops[0]?.headers['if-match']).toBe(ELSEWHERE_KEY.etag)

  await page.getByRole('link', { name: 'Back to API keys' }).click()
  await expect(page.getByRole('main')).toContainText('Monitoring')
  await expect(page.getByRole('main')).toContainText('Revoked')
})

test('Edge: a key revoked by another administrator revokes again successfully and shows the current state', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('api-key-revoked-elsewhere')
  await openDetail(page)
  await mockApi.patch({
    accounts: { otheradmin: { role: 'admin' } },
    apiKeys: [
      {
        ...ELSEWHERE_KEY,
        status: 'revoked',
        revokedAt: '2026-10-01T09:00:00.000Z',
        revokedBy: { username: 'otheradmin' },
      },
    ],
  })
  await revoke(page)
  await expect(
    page.getByRole('main').getByRole('definition').filter({ hasText: 'otheradmin' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revoke key' })).toHaveCount(0)
})

test('Edge: a key changed elsewhere (412) is reloaded and the revocation can be retried', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('api-key-revoked-elsewhere')
  await openDetail(page)
  await mockApi.patch({ apiKeys: [{ ...ELSEWHERE_KEY, etag: '"ak-changed"' }] })
  await revoke(page)
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This item was changed elsewhere. It has been reloaded; please try again.',
  )
  await expect(page.getByRole('main')).toContainText('Active')
  await revoke(page)
  await expect(
    page
      .getByRole('main')
      .getByRole('term')
      .filter({ hasText: /^Revoked$/ }),
  ).toHaveCount(1)
  const tags = (await mockApi.requests())
    .filter((r) => r.operationId === 'revokeApiKey')
    .map((r) => `${r.status} ${r.headers['if-match']}`)
  expect(tags).toEqual([`412 ${ELSEWHERE_KEY.etag}`, '200 "ak-changed"'])
})

test('an unknown key shows "not found" with a way back', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('api-keys-empty', { apiKeys: [scenarioKey(1)] })
  await page.goto(`api-keys/${fixedKeyId(77)}`)
  await expect(page.getByRole('heading', { level: 1, name: 'API key not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to API keys' })).toBeVisible()
  await expectAccessible()
})
