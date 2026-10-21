import type { Locator } from '@playwright/test'

import { expect, test } from '../fixtures/test'

const lists = [
  { path: 'mailboxes', scenario: 'admin-mailboxes-30' },
  { path: 'domains', scenario: 'domains-60' },
  { path: 'filters', scenario: 'filters-many' },
] as const

async function expectClippedCorners(table: Locator) {
  await table.locator('thead').scrollIntoViewIfNeeded()
  const frame = await table.evaluate((element) => {
    const frame = element.closest('.table-frame')!
    const rect = frame.getBoundingClientRect()
    const style = getComputedStyle(frame)
    const inset = Number.parseFloat(style.borderTopWidth) + 1
    const radius = Number.parseFloat(style.borderTopLeftRadius)
    return {
      radius,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      background: getComputedStyle(document.body).backgroundColor,
      headerBackground: getComputedStyle(element.querySelector('thead')!).backgroundColor,
      // Ensure the header is actually under the pointer; an overlay must not make this pass.
      header: element.contains(document.elementFromPoint(rect.left + radius + 4, rect.top + inset)),
    }
  })
  expect(frame.radius).toBeGreaterThan(0)
  expect(frame.header).toBe(true)
  // WebKit's hit testing ignores rounded overflow corners even when their paint is clipped.
  // Sample the actual screenshot in every engine instead of inferring paint from a DOM hit.
  const screenshot = await table.page().screenshot({
    scale: 'css',
    clip: { x: frame.x, y: frame.y, width: frame.width, height: frame.radius + 4 },
  })
  const pixels = await table.page().evaluate(
    async ({ png, radius }) => {
      const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
      try {
        const image = new Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const pixel = (x: number, y: number) =>
          Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3)
        return {
          left: pixel(2, 2),
          right: pixel(canvas.width - 3, 2),
          header: pixel(radius + 4, 2),
        }
      } finally {
        URL.revokeObjectURL(url)
      }
    },
    { png: screenshot.toString('base64'), radius: frame.radius },
  )
  const rgb = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(Number)
  expect(pixels.left).toEqual(rgb(frame.background))
  expect(pixels.right).toEqual(rgb(frame.background))
  expect(pixels.header).toEqual(rgb(frame.headerBackground))
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} tables clip their corners and share one header style`, async ({
    page,
    mockApi,
  }) => {
    // The mobile projects retain their coarse pointer while displaying the wide table layout.
    await page.setViewportSize({ width: 1366, height: 900 })
    const headers = []
    for (const { path, scenario } of lists) {
      await mockApi.use(scenario, {
        accounts: {
          admin: { preferences: { language: 'en-gb', theme, etag: '"table-theme"' } },
        },
      })
      await page.goto(path)
      const table = page.locator('main table.data-table')
      await expect(table).toBeVisible()
      await expect(table.locator('tbody tr').first()).toBeVisible()
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/)
      await expectClippedCorners(table)
      headers.push(
        await table.locator('thead').evaluate((head) => {
          const row = getComputedStyle(head)
          const cell = getComputedStyle(head.querySelector('th')!)
          return {
            background: row.backgroundColor,
            border: row.borderBottomColor,
            color: cell.color,
            fontSize: cell.fontSize,
            fontWeight: cell.fontWeight,
            padding: cell.padding,
          }
        }),
      )
    }
    expect(headers[1]).toEqual(headers[0])
    expect(headers[2]).toEqual(headers[0])
  })
}

test('table controls are compact with a mouse and retain touch targets on phones and tablets', async ({
  page,
  mockApi,
}, testInfo) => {
  await mockApi.use('admin-mailboxes-30')
  await page.goto('mailboxes')
  const row = page.locator('[data-entry="anna@a.example"]')
  const edit = row.getByRole('link', { name: 'Edit anna@a.example', exact: true })
  await expect(edit).toBeVisible()
  if (testInfo.project.name !== 'desktop-chromium') {
    expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(page.locator('main table')).toHaveCount(0)
  }

  await page.setViewportSize({ width: 1366, height: 900 })
  const table = page.locator('main table.data-table')
  await expect(table).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const compact = await page.evaluate(
    () => matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches,
  )
  expect(compact).toBe(testInfo.project.name === 'desktop-chromium')
  const sort = table.locator('th[data-column="inUse"]').getByRole('button')
  for (const control of [sort, edit]) {
    const height = (await control.boundingBox())!.height
    if (compact) expect(height).toBeCloseTo(32, 0)
    else expect(height).toBeGreaterThanOrEqual(44)
  }

  const login = row.locator('[data-cell="lastMailLogin"]')
  if (compact) {
    await expect(login.locator('details')).not.toHaveAttribute('open')
    await expect(login.locator('ul')).toBeHidden()
    await login.locator('summary').click()
    await expect(login.locator('ul')).toBeVisible()
    await expect(login.locator('[data-login="imap"]')).toBeVisible()
    await expect(login.locator('[data-login="sso"]')).toBeVisible()
    await login.locator('summary').click()
    await expect(login.locator('ul')).toBeHidden()
  } else {
    await expect(login.locator('details')).toHaveCount(0)
    await expect(login.locator('ul')).toBeVisible()
  }

  await sort.click()
  await expect(table.locator('th[data-column="inUse"]')).toHaveAttribute('aria-sort', 'ascending')
  await sort.click()
  await expect(page).toHaveURL(/sort=percentUsed/)
  await expect(page).toHaveURL(/order=desc/)
  await expect(table.locator('tbody [data-entry]').first()).toHaveAttribute(
    'data-entry',
    'bob@a.example',
  )
  await page.getByRole('button', { name: 'Columns', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Created on', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(table.locator('th[data-column="createdAt"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const checkbox = page.getByRole('checkbox', { name: 'Select bob@a.example', exact: true })
  await checkbox.check()
  await expect(checkbox).toBeChecked()
  const target = await checkbox.evaluate((element) => {
    const rect = element.closest('label')!.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })
  for (const size of [target.width, target.height]) {
    if (compact) expect(size).toBeCloseTo(32, 0)
    else expect(size).toBeGreaterThanOrEqual(44)
  }
  await expect(page.getByRole('region', { name: 'Bulk actions' })).toContainText('1 selected')
})

test('Queue Manager has its own System sidebar entry and no System and Containers tabs', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-operations')
  await page.goto('operations/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: 'System & Containers' })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true })
  if (await menu.isVisible()) await menu.click()
  const system = page.getByRole('list', { name: 'System', exact: true })
  await expect(system.getByRole('link')).toHaveText(['System & Containers', 'Queue Manager'])
  await system.getByRole('link', { name: 'Queue Manager', exact: true }).click()
  await expect(page).toHaveURL(/\/operations\/mail-queue$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Queue Manager' })).toBeVisible()
  await expect(page.locator('[data-section-navigation]')).toHaveCount(0)
  if (await menu.isVisible()) await menu.click()
  await expect(system.getByRole('link', { name: 'Queue Manager', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    system.getByRole('link', { name: 'System & Containers', exact: true }),
  ).not.toHaveAttribute('aria-current', 'page')
})
