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
  await expect(domainsLabel).toHaveCSS('opacity', '0')

  await sidebar.hover({ position: { x: 40, y: 150 } })
  await widthIs(290)
  await expect(domainsLabel).toHaveCSS('opacity', '1')
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

test('sidebar icons stay in place throughout hover expansion and collapse', async ({
  page,
  mockApi,
}) => {
  test.skip(isNarrow(page), 'desktop hover animation')
  await mockApi.use('admin-active')
  await page.goto('domains')
  const sidebar = page.locator('[data-desktop-sidebar]')
  await page.locator('[data-navigation-toggle]').click()
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(90)

  for (const expanding of [true, false]) {
    const sampling = sidebar.evaluate(async (element) => {
      const frames: { width: number; icons: { x: number; y: number }[] }[] = []
      const start = performance.now()
      while (performance.now() - start < 500) {
        frames.push({
          width: element.getBoundingClientRect().width,
          icons: [...element.querySelectorAll('[data-nav-item] > svg')].map((icon) => {
            const { x, y } = icon.getBoundingClientRect()
            return { x, y }
          }),
        })
        await new Promise(requestAnimationFrame)
      }
      return frames
    })
    await page.mouse.move(expanding ? 40 : 900, 150)
    const frames = await sampling
    expect(frames.some((frame) => frame.width > 90 && frame.width < 290)).toBe(true)
    const initial = frames[0]!.icons
    for (const frame of frames) {
      expect(frame.icons).toHaveLength(initial.length)
      for (const [index, icon] of frame.icons.entries()) {
        expect(Math.abs(icon.x - initial[index]!.x), 'icon horizontal position').toBeLessThan(1)
        expect(Math.abs(icon.y - initial[index]!.y), 'icon vertical position').toBeLessThan(1)
      }
    }
  }

  await sidebar.hover({ position: { x: 40, y: 150 } })
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(290)
  await sidebar.getByRole('button', { name: 'Email configuration', exact: true }).click()
  const domains = sidebar.getByRole('link', { name: 'Domains', exact: true })
  await expect(domains).toBeHidden()
  await page.mouse.move(900, 150)
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(90)
  await expect(domains).toBeHidden()
  await sidebar.hover({ position: { x: 40, y: 150 } })
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(290)
  await expect(domains).toBeHidden()
})
