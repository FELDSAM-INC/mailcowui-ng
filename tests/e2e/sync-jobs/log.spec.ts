// UI 008 US5 the run log (T062): opened from the row menu, verbatim
// and read-only with markers for bidi characters, full screen at 360 px and a dialog on desktop,
// wrapping by default, copying, the empty states and the running notice, markup shown as text,
// fetched only when opened, closed by Back with the list kept, opened by address, and a job gone.
import { expect, test } from '../fixtures/test'
import { clickRowAction } from '../fixtures/row-actions'
import { entry, isNarrow, listReady, requestsOf } from './helpers'

test.describe('sync job run log', () => {
  test('US1-AS5 FR-041 FR-046 row menu opens the log; the list requests none', async ({
    page,
    mockApi,
    expectAccessible,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=erik&sort=id&order=asc')
    await listReady(page)
    expect(await requestsOf(mockApi, 'getSyncJobLog')).toEqual([])
    await clickRowAction(page, entry(page, 12), 'Open logs')
    const dialog = page.getByRole('dialog', { name: 'Log' })
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/log=12/)
    expect(await requestsOf(mockApi, 'getSyncJobLog')).toHaveLength(1)
    await expectAccessible()
    await page.goBack()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(/q=erik/)
    await expect(entry(page, 12).locator('[data-row-action-trigger]')).toBeFocused()
    await clickRowAction(page, entry(page, 12), 'Open logs')
    await expect(page.getByRole('dialog', { name: 'Log' })).toBeVisible()
  })

  test('US5-AS1 FR-042 US5-AS5 verbatim text with its header; markup stays text; bidi marked', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?log=19')
    const dialog = page.getByRole('dialog', { name: 'Log' })
    const region = dialog.getByRole('region', {
      name: 'Log of user19@old-provider.example@imap19.old-provider.example:993',
    })
    await expect(region).toContainText('<script>alert(1)</script>')
    await expect(region).toContainText('&amp; <b>bold</b>')
    expect(await region.locator('script, b').count()).toBe(0)
    await expect(region).toHaveCSS('font-family', /mono/i)
    await expect(dialog).toContainText('alice@example.org')
    await expect(dialog).toContainText('Check log')
    await mockApi.patch({ syncJobs: { changeElsewhere: { id: 19, log: 'name\u202Efdp.exe\n' } } })
    await dialog.getByRole('button', { name: 'Refresh' }).click()
    await expect(region.locator('[data-marker]')).toHaveText('U+202E')
  })

  test('US5-AS2 FR-043 full screen at 360 px, wrapped by default; unwrapped only the log scrolls', async ({
    page,
    mockApi,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?log=20')
    const dialog = page.getByRole('dialog', { name: 'Log' })
    const region = dialog.getByRole('region')
    await expect(region).toHaveCSS('white-space', 'pre-wrap')
    const box = await dialog.boundingBox()
    if (isNarrow(page)) {
      expect(box!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1)
    } else {
      expect(box!.width).toBeLessThan(page.viewportSize()!.width)
    }
    await dialog.getByRole('button', { name: 'Wrap lines' }).click()
    await expect(region).toHaveCSS('white-space', 'pre')
    if (isNarrow(page)) {
      // 120 columns do not fit at 360 px: only the log area scrolls sideways.
      const scroll = await region.evaluate((el) => el.scrollWidth > el.clientWidth)
      expect(scroll).toBe(true)
    }
    await region.focus()
    await page.keyboard.press('ArrowRight')
    await expectNoHorizontalScroll()
  })

  test('US5-AS3 FR-044 "Copy" copies the log and says so', async ({
    page,
    mockApi,
    browserName,
    context,
  }) => {
    await mockApi.use('sync-jobs-admin')
    if (browserName === 'chromium')
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('sync-jobs?log=2')
    const dialog = page.getByRole('dialog', { name: 'Log' })
    await expect(dialog.getByRole('region')).toContainText('Host1')
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await expect(page.locator('[data-live="polite"]')).toHaveText(
      /The log was copied\.|Copying is not available/,
    )
    if (browserName === 'chromium') {
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      expect(copied).toContain('Host1: mail.previous.example says it has CAPABILITY')
    }
  })

  test('US5-AS4 FR-045 never run, no output, and the running notice with Refresh', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?log=1')
    await expect(page.getByRole('dialog').getByText('No log yet.')).toBeVisible()
    await page.goto('sync-jobs?log=18')
    await expect(page.getByRole('dialog').getByText('The run produced no output.')).toBeVisible()
    await page.goto('sync-jobs?log=4')
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByText('A run is in progress. This is the log of the previous run.'),
    ).toBeVisible()
    const before = (await requestsOf(mockApi, 'getSyncJobLog')).length
    await dialog.getByRole('button', { name: 'Refresh' }).click()
    await expect
      .poll(async () => (await requestsOf(mockApi, 'getSyncJobLog')).length)
      .toBe(before + 1)
  })

  test('R17 Close returns the focus; a job deleted meanwhile says it no longer exists', async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('sync-jobs-admin')
    await page.goto('sync-jobs?q=previous')
    await listReady(page)
    const opener = entry(page, 2).locator('[data-row-action-trigger]')
    await clickRowAction(page, entry(page, 2), 'Open logs')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(opener).toBeFocused()
    await mockApi.patch({ syncJobs: { delete: 2 } })
    await page.goto('sync-jobs?log=2')
    await expect(
      page.getByRole('dialog').getByText('This sync job no longer exists.'),
    ).toBeVisible()
  })
})
