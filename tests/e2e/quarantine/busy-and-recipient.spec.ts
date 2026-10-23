import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { itemAction, openItem } from './helpers'

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** Leave through the app, preserving the pending request in the old page instance. */
async function openAnotherItem(page: Page) {
  await page.locator('[data-back-to-list]').click()
  await expect(page).toHaveURL(/\/quarantine$/)
  await page.locator('[data-quarantine-item="29"]').press('Enter')
  await expect(page.locator('[data-item="29"]')).toBeVisible()
}

for (const result of ['available', 'gone'] as const) {
  test(`US2-AS7 busy item: one timed read finds the item ${result}, without resending`, async ({
    page,
    mockApi,
  }) => {
    await page.clock.install()
    await mockApi.use('quarantine-mailbox-user', {
      quarantine: { items: { set: { '2': { inject: { busy: { then: result } } } } } },
    })
    await openItem(page, 2)
    const mark = await mockApi.mark()
    await itemAction(page, 'release')
    await expect(page.locator('[data-outcome]')).toContainText('Another action')
    await expect(page.locator('[data-item-action="release"]')).toBeDisabled()
    expect(await mockApi.countRequests('getQuarantineItem', mark)).toBe(0)
    await page.clock.fastForward(5000)
    await expect.poll(() => mockApi.countRequests('getQuarantineItem', mark)).toBe(1)
    if (result === 'gone') {
      await expect(page).toHaveURL(/\/quarantine$/)
      await expect(page.locator('[data-quarantine-item="2"]')).toHaveCount(0)
    } else {
      await expect(page.locator('[data-outcome]')).toHaveCount(0)
      await expect(page.locator('[data-item="2"]')).toBeVisible()
      await expect(page.locator('[data-item-action="release"]')).toBeEnabled()
    }
    await page.clock.fastForward(10_000)
    expect(await mockApi.countRequests('getQuarantineItem', mark)).toBe(1)
    expect(await mockApi.countRequests('releaseQuarantineItem', mark)).toBe(1)
  })
}

test('US2 busy item: leaving cancels the scheduled read', async ({ page, mockApi }) => {
  await page.clock.install()
  await mockApi.use('quarantine-busy')
  await openItem(page, 1)
  await itemAction(page, 'release')
  await expect(page.locator('[data-outcome]')).toContainText('Another action')
  await openAnotherItem(page)
  const mark = await mockApi.mark()
  await page.clock.fastForward(10_000)
  expect(await mockApi.countRequests('getQuarantineItem', mark)).toBe(0)
  await expect(page.locator('[data-item="29"]')).toBeVisible()
  await expect(page.locator('[data-outcome]')).toHaveCount(0)
})

test('US2 busy item: an old read completing after navigation cannot send the user back', async ({
  page,
  mockApi,
}) => {
  await page.clock.install()
  await mockApi.use('quarantine-busy')
  await openItem(page, 1)
  const read = gate()
  const reached = gate()
  await page.route('**/api/v2/quarantine/1', async (route) => {
    const response = await route.fetch()
    reached.release()
    await read.promise
    await route.fulfill({ response })
  })
  try {
    await itemAction(page, 'release')
    await expect(page.locator('[data-outcome]')).toContainText('Another action')
    await page.clock.fastForward(5000)
    await reached.promise
    await openAnotherItem(page)
    const response = page.waitForResponse('**/api/v2/quarantine/1')
    read.release()
    await response
    await page.clock.fastForward(1000)
    await expect(page).toHaveURL(/\/quarantine\/29$/)
    await expect(page.locator('[data-item="29"]')).toBeVisible()
    await expect(page.locator('[data-outcome]')).toHaveCount(0)
    expect(await mockApi.countRequests('releaseQuarantineItem')).toBe(1)
  } finally {
    read.release()
  }
})

test('US2 item action: a completed delivery response belongs to the page that sent it', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 2)
  const delivery = gate()
  const reached = gate()
  await page.route('**/api/v2/quarantine/2/release', async (route) => {
    const response = await route.fetch()
    reached.release()
    await delivery.promise
    await route.fulfill({ response })
  })
  try {
    await itemAction(page, 'release')
    await reached.promise
    await openAnotherItem(page)
    const response = page.waitForResponse('**/api/v2/quarantine/2/release')
    delivery.release()
    await response
    await expectAccessible()
    await expect(page).toHaveURL(/\/quarantine\/29$/)
    await expect(page.locator('[data-item="29"]')).toBeVisible()
    await expect(page.locator('[data-outcome]')).toHaveCount(0)
    expect(await mockApi.countRequests('releaseQuarantineItem')).toBe(1)
  } finally {
    delivery.release()
  }
})

for (const role of ['admin', 'reseller']) {
  test(`US2-AS8 ${role}: Bob's recipient link opens his mailbox spam filter`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('quarantine-admin', { signedInAs: role })
    await openItem(page, 31)
    const recipient = page.locator('[data-recipient-link]')
    await expect(recipient).toHaveText('bob@example.org')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await recipient.click()
    await expect(page).toHaveURL(/mailboxes\/bob(?:@|%40)example.org#spam-filter$/)
    const section = page.locator('[data-spam-filter-section]')
    await expect(section).toBeVisible()
    await expect(section.getByRole('heading', { level: 2 })).toBeFocused()
  })
}

test('US2 recipient: a mailbox user sees plain text and makes no administrator mailbox lookup', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-mailbox-user')
  await openItem(page, 2)
  await expect(page.locator('[data-field="recipients"]')).toContainText('alice@example.org')
  await expect(page.locator('[data-recipient-link]')).toHaveCount(0)
  expect(await mockApi.countRequests('getMailbox')).toBe(0)
})

for (const recipient of ['meetingroom1@example.org', 'gone@example.org']) {
  test(`FR-006 recipient ${recipient}: a resource or deleted mailbox remains plain text`, async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('quarantine-admin', {
      quarantine: { items: { add: [{ id: 101, recipient }] } },
    })
    const lookup = page.waitForResponse(
      (response) => response.url().includes('/api/v2/mailboxes/') && response.status() === 404,
    )
    await openItem(page, 101)
    await lookup
    await expect(page.locator('[data-field="recipients"]')).toContainText(recipient)
    await expect(page.locator('[data-recipient-link]')).toHaveCount(0)
    await expectAccessible()
    expect(await mockApi.countRequests('getMailbox')).toBe(1)
  })
}
