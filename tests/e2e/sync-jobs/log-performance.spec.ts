// UI 008 SC-007, FR-046 (T063): a 5 MB log is readable within 3 s of opening with the CPU slowed
// four times, and scrolling it from top to bottom has no long task over 200 ms. Chromium only.
import { expect, test } from '../fixtures/test'

test.describe('large run log', () => {
  test('SC-007 a 5 MB log opens in under 3 s and scrolls without long tasks', async ({
    page,
    mockApi,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CPU throttling needs the Chrome DevTools Protocol')
    test.setTimeout(90_000)
    await mockApi.use('sync-jobs-big-log')
    await page.goto('sync-jobs')
    await page.locator('[data-entry="1"]').waitFor()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.locator('[data-entry="1"] [data-row-action-trigger]').click()
    const started = Date.now()
    await page.getByRole('menuitem', { name: 'Open logs', exact: true }).click()
    const region = page.getByRole('dialog').getByRole('region')
    await expect(region.locator('[data-chunk]').first()).toContainText('msg INBOX/000001', {
      timeout: 3_000,
    })
    expect(Date.now() - started).toBeLessThan(3_000)
    await page.evaluate(() => {
      const w = window as unknown as { __longTasks: number[] }
      w.__longTasks = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__longTasks.push(entry.duration)
      }).observe({ type: 'longtask', buffered: false })
    })
    await region.evaluate(async (element) => {
      const step = element.clientHeight * 4
      for (let top = 0; top < element.scrollHeight; top += step) {
        element.scrollTop = top
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      }
      element.scrollTop = element.scrollHeight
    })
    // Measured before Playwright reads any text: reading 5 MB of text is itself a long task.
    const longest = await page.evaluate(() =>
      Math.max(0, ...(window as unknown as { __longTasks: number[] }).__longTasks),
    )
    expect(longest).toBeLessThan(200)
    await expect(region.locator('[data-chunk]').last()).toContainText('copied to INBOX')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  })
})
