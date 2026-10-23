import { expect, test } from '../fixtures/test'
import { isNarrow } from '../fixtures/flows'

test('sidebar hover is temporary on desktop and mobile navigation still uses its drawer', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('admin-active')
  await page.goto('domains')
  await expect(page.getByRole('heading', { level: 1, name: 'Domains' })).toBeVisible()
  const toggle = page.locator('[data-navigation-toggle]')
  const sidebar = page.locator('[data-desktop-sidebar]')
  if (isNarrow(page)) {
    await expect(sidebar).toHaveCount(0)
    await toggle.tap()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('link', { name: 'Mailboxes', exact: true }).tap()
    await expect(page).toHaveURL(/\/mailboxes$/)
    await expect(drawer).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    return
  }

  const widthIs = async (width: number) => {
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(width)
    expect((await page.getByRole('banner').boundingBox())?.x).toBe(width)
  }
  await expect(toggle.locator('svg')).toHaveAttribute('viewBox', '0 0 16 12')
  await toggle.click()
  await widthIs(90)
  const domainsLabel = sidebar.locator('[data-nav-item="domains"] span')
  await expect(domainsLabel).toHaveClass(/sr-only/)

  await sidebar.hover({ position: { x: 40, y: 150 } })
  await widthIs(290)
  await expect(domainsLabel).not.toHaveClass(/sr-only/)
  await expect(toggle).toHaveAttribute('aria-label', 'Expand sidebar')
  // Moving across the expanded width must not collapse the sidebar underneath the pointer.
  await sidebar.hover({ position: { x: 250, y: 150 } })
  await widthIs(290)
  await page.mouse.move(900, 450)
  await widthIs(90)

  await sidebar.hover({ position: { x: 40, y: 150 } })
  await widthIs(290)
  await sidebar.getByRole('link', { name: 'Access', exact: true }).click()
  await expect(page).toHaveURL(/\/administrators\/admins$/)
  await page.mouse.move(900, 450)
  await widthIs(90)

  await toggle.click()
  await widthIs(290)
  await sidebar.hover({ position: { x: 40, y: 150 } })
  await page.mouse.move(900, 450)
  await widthIs(290)
  await expect(toggle).toHaveAttribute('aria-label', 'Collapse sidebar')

  // A resize must not leave a stale hover expansion when the desktop sidebar returns.
  await toggle.click()
  await widthIs(90)
  await sidebar.hover({ position: { x: 40, y: 150 } })
  await widthIs(290)
  await page.setViewportSize({ width: 360, height: 780 })
  await expect(sidebar).toHaveCount(0)
  await page.mouse.move(350, 450)
  await page.setViewportSize({ width: 1366, height: 900 })
  await widthIs(90)
})
