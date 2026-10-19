// UI 011 US4 (T089): a queued message's content at its own address — the queue ID, the audit
// notice, the content verbatim as plain text, the first view of a large message and the rest on
// request, Copy of the complete content, full screen on phones and a dialog on wide screens, the
// content requested again on every opening, and a message that left the queue.
import type { Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'
import { expect, test } from '../fixtures/test'

const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

async function contentRequests(mockApi: MockApi) {
  return (await mockApi.requests()).filter(
    (request) => request.operationId === 'getMailQueueMessageContent',
  ).length
}

/** Records what the app copies, in every engine (WebKit grants no clipboard permission). */
async function recordClipboard(page: Page) {
  await page.addInitScript(() => {
    const copied: string[] = []
    Object.defineProperty(window, '__copied', { value: copied })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) },
    })
  })
}

test.describe('queued message content @operations', () => {
  test('US4-AS4 FR-061 the content is shown verbatim with the audit notice and copied whole', async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
    expectTouchTargets,
  }) => {
    await recordClipboard(page)
    await mockApi.use('ops-queue')
    await page.goto('operations/mail-queue')
    await page.locator('[data-show-message="4F2A1B3C9D"]').click()
    await expect(page).toHaveURL(/\/operations\/mail-queue\/messages\/4F2A1B3C9D/)
    const viewer = page.getByRole('dialog', { name: 'ID 4F2A1B3C9D' })
    await expect(viewer).toContainText('Each view of a message is recorded in the audit log.')
    const content = viewer.getByRole('region', { name: 'ID 4F2A1B3C9D' })
    await expect(content).toContainText('<script>alert(1)</script>')
    await expect(content).toContainText('Subject: <b>Quarterly report</b> – Příliš žluťoučký kůň')
    await expect(content.locator('script, b')).toHaveCount(0)
    const box = await viewer.boundingBox()
    const viewport = page.viewportSize()!
    if (isNarrow(page)) expect(box!.width).toBe(viewport.width)
    else expect(box!.width).toBeLessThan(viewport.width)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await expectTouchTargets()
    await viewer.getByRole('button', { name: 'Copy' }).click()
    const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)
    expect(copied[0]).toContain('<script>alert(1)</script>')
    await viewer.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/\/operations\/mail-queue(\?|$)/)
    await expect(page.locator('[data-show-message="4F2A1B3C9D"]')).toBeFocused()
  })

  test('FR-061 SC-011 a 10 MiB message shows its first 256 Ki characters, then the rest, and copies everything', async ({
    page,
    mockApi,
  }) => {
    await recordClipboard(page)
    await mockApi.use('ops-queue')
    await page.goto('operations/mail-queue/messages/C2739415A6')
    const viewer = page.getByRole('dialog', { name: 'ID C2739415A6' })
    const content = viewer.locator('[data-message-content]')
    const started = Date.now()
    await expect(content).toContainText('Ünïcödé line', { timeout: 15_000 })
    expect(Date.now() - started).toBeLessThan(15_000)
    const firstLength = await content.evaluate((element) => element.textContent.length)
    expect(firstLength).toBeLessThanOrEqual(262_144)
    await viewer.getByRole('button', { name: 'Copy' }).click()
    const length = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied[0]!.length,
    )
    expect(length).toBe(10 * 1024 * 1024)
    await viewer.getByRole('button', { name: /^Show the rest \(/ }).click()
    await expect
      .poll(() => content.evaluate((element) => element.textContent.length))
      .toBe(10 * 1024 * 1024)
  })

  test('FR-061 the address opens the viewer directly, and every opening requests the content again', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('ops-queue')
    await page.goto('operations/mail-queue/messages/4F2A1B3C9D')
    await expect(page.getByRole('dialog', { name: 'ID 4F2A1B3C9D' })).toBeVisible()
    await expect(page.locator('main h1')).toHaveText('Queue Manager')
    expect(await contentRequests(mockApi)).toBe(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('[data-show-message="4F2A1B3C9D"]').click()
    await expect(page.getByRole('dialog', { name: 'ID 4F2A1B3C9D' })).toContainText('Subject:')
    expect(await contentRequests(mockApi)).toBe(2)
  })

  test('Edge: a message that left the queue says so and leaves the list', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('ops-queue-vanishing')
    await page.goto('operations/mail-queue')
    await expect(page.locator('[data-entry="7D2E4F6031"]')).toBeVisible()
    await page.locator('[data-show-message="7D2E4F6031"]').click()
    const viewer = page.getByRole('dialog', { name: 'ID 7D2E4F6031' })
    await expect(viewer).toContainText('This message is no longer in the queue.')
    await expectAccessible()
    await viewer.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('[data-entry="7D2E4F6031"]')).toHaveCount(0)
  })
})
