// UI 008 password secrecy (T042, T050, research R12, FR-029 to FR-035, SC-003): a marker password
// typed into the create form and the edit form appears in exactly one request body each, and never
// in the page, an address, browser storage or history state, nor in a request to another origin.
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import type { MockApi } from '../fixtures/mock-api'

const MARKER = 'Marker-Remote-Pw-8c41'

async function expectNowhere(page: Page, urls: string[]) {
  expect(await page.content()).not.toContain(MARKER)
  for (const url of urls) expect(url).not.toContain(MARKER)
  const stored = await page.evaluate(() =>
    JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), history.state]),
  )
  expect(stored).not.toContain(MARKER)
}

async function bodiesWithMarker(mockApi: MockApi) {
  return (await mockApi.requests())
    .filter((request) => JSON.stringify(request.body ?? '').includes(MARKER))
    .map((request) => request.operationId)
}

function recordOrigins(page: Page): { urls: string[]; foreign: string[] } {
  const seen = { urls: [] as string[], foreign: [] as string[] }
  page.on('framenavigated', (frame) => seen.urls.push(frame.url()))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') seen.foreign.push(url.href)
  })
  return seen
}

test.describe('remote password secrecy', () => {
  test('SC-003 the create flow sends the password once and keeps it out of the page and storage', async ({
    page,
    mockApi,
  }) => {
    const seen = recordOrigins(page)
    await mockApi.use('sync-jobs-user')
    await page.goto('sync-jobs/new')
    await page.locator('#syncjob-create-remoteHost').fill('imap.secret.example')
    await page.locator('#syncjob-create-remoteUser').fill('secret.user')
    await page.locator('#syncjob-create-remotePassword').fill(MARKER)
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/sync-jobs\/\d+$/)
    expect(await bodiesWithMarker(mockApi)).toEqual(['createSyncJob'])
    await expectNowhere(page, seen.urls)
    expect(seen.foreign).toEqual([])
  })

  test('SC-003 the edit flow sends the password once and keeps it out of the page and storage', async ({
    page,
    mockApi,
  }) => {
    const seen = recordOrigins(page)
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs/2?edit=syncjob')
    await page.getByLabel('Password', { exact: true }).fill(MARKER)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    expect(await bodiesWithMarker(mockApi)).toEqual(['updateSyncJob'])
    await page.getByRole('button', { name: 'Edit Edit sync job' }).click()
    await page.getByLabel('Interval (min)').fill('25')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/edit=/)
    const updates = (await mockApi.requests()).filter((r) => r.operationId === 'updateSyncJob')
    expect(updates[1]!.body).not.toHaveProperty('remotePassword')
    await expectNowhere(page, seen.urls)
    await page.goto('sync-jobs/2?edit=syncjob')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    expect(seen.foreign).toEqual([])
  })
})
