import { expect, test } from '../fixtures/test'

test('aliases show send-as permission without expanding the row', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('aliases-60')
  await page.goto('aliases')
  await expect(
    page.getByRole('columnheader', { name: 'Allow to send as this alias' }),
  ).toBeVisible()
  await expect(page.locator('tbody [data-column="senderAllowed"]').first()).toContainText(/Yes|No/)
  await expect(page.locator('[data-entry-details]')).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('aliases.png') })
})

test('sync jobs keep the active state beside their identity', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('sync-jobs-admin')
  await page.goto('sync-jobs')
  await expect(page.locator('tbody [data-column="id"] [data-active-badge]').first()).toBeVisible()
  await page.setViewportSize({ width: 360, height: 780 })
  await expect(page.locator('[data-card-header] [data-active-badge]').first()).toBeVisible()
})

test('quarantine statistics contain long numbers and labels on narrow screens', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('spam-statistics', {
    quarantine: {
      statistics: {
        rejected: 123456789012,
        softRejected: 123456789012,
        subjectRewritten: 123456789012,
        movedToJunk: 123456789012,
        noAction: 123456789012,
        countedSince: '2026-09-01T00:00:00.000Z',
        spamFilterRunningSince: '2026-10-10T04:30:00.000Z',
      },
    },
  })
  for (const width of [360, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('quarantine/statistics')
    await expect(page.locator('[data-statistics]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(
      await page.locator('[data-statistics] td, [data-statistics] th').evaluateAll((cells) =>
        cells.every((cell) => {
          const style = getComputedStyle(cell)
          return (
            cell.scrollWidth <= cell.clientWidth + 1 &&
            parseFloat(style.paddingLeft) >= 8 &&
            parseFloat(style.paddingRight) >= 8
          )
        }),
      ),
    ).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`statistics-${width}.png`) })
  }
})

test('Rspamd UI has a styled external action and no overview link', async ({ page, mockApi }) => {
  await mockApi.use('settings-admin-defaults')
  await page.goto('system/rspamd-web-interface')
  await expect(page.locator('[data-rspamd-link]')).toBeVisible()
  await expect(page.locator('[data-rspamd-link] svg')).toHaveCount(1)
  await expect(page.locator('main a[href="/ng/system"]')).toHaveCount(0)
})

test('Rspamd rules and effective map use matching sub-tabs', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('rspamd-rules-30')
  await page.goto('system/rspamd-rules')
  const tabs = page.getByRole('navigation', { name: 'Rspamd settings map', exact: true })
  await tabs.getByRole('link', { name: 'Active settings map', exact: true }).click()
  await expect(page).toHaveURL(/rspamd-effective-map$/)
  await expect(
    tabs.getByRole('link', { name: 'Active settings map', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('[data-refresh] svg')).toHaveCount(1)
  await tabs.getByRole('link', { name: 'Rspamd settings map', exact: true }).click()
  await expect(page.locator('[data-list-toolbar] [data-refresh]')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('toolbar.png') })
})

test('app-link editor aligns all three inputs including an added row', async ({
  page,
  mockApi,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await mockApi.use('app-links-three')
  await page.goto('system/customize/app-links')
  await page
    .locator('#section-app-links')
    .getByRole('button', { name: /^Edit / })
    .click()
  await page.locator('[data-add-link]').click()
  const positions = await Promise.all(
    ['name', 'url', 'signedInUrl'].map((field) =>
      page.locator(`#app-link-3-${field}`).boundingBox(),
    ),
  )
  expect(positions.every(Boolean)).toBe(true)
  expect(
    Math.max(...positions.map((box) => box!.y)) - Math.min(...positions.map((box) => box!.y)),
  ).toBeLessThan(2)
  await page.screenshot({ path: test.info().outputPath('app-link-editor.png') })
})

test('global map detail has one back button and browser forward restores the detail', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('filter-maps-13')
  await page.goto('system/filter-maps')
  await page.locator('main a[href^="/ng/system/filter-maps/"]').first().click()
  await expect(page.locator('[data-detail-back]')).toBeVisible()
  const detail = page.url()
  await expect(page.locator('main a[href="/ng/system/filter-maps"]')).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('detail-back.png') })
  await page.locator('[data-detail-back]').click()
  await expect(page).toHaveURL(/\/system\/filter-maps$/)
  await page.goForward()
  await expect(page).toHaveURL(detail)
})

test('Options omit the extra count above the DKIM table', async ({ page, mockApi }) => {
  await mockApi.use('dns-admin')
  await page.goto('dns/dkim-keys')
  await expect(page.locator('[data-list-toolbar] [data-refresh]')).toBeVisible()
  await expect(page.locator('[data-result-count]')).toHaveCount(0)
})

test('login includes default guidance', async ({ page, mockApi }) => {
  await mockApi.use('anonymous-default')
  await page.goto('sign-in')
  await expect(page.locator('[data-sign-in-help]')).toContainText('email address or username')
})
