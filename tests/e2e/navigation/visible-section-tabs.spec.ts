import { expect, test } from '../fixtures/test'

for (const width of [320, 360, 768, 1366]) {
  test(`short tab groups stay directly accessible on one row at ${width}px`, async ({
    page,
    mockApi,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await mockApi.use('admin-active')
    for (const [path, labels] of [
      ['domains', ['Domains', 'Domain Templates']],
      ['mailboxes', ['Mailboxes', 'Mailbox Templates']],
      ['aliases', ['Aliases', 'Domain aliases']],
    ] as const) {
      await page.goto(path)
      const navigation = page.locator('[data-section-navigation]')
      await expect(navigation.getByRole('button')).toHaveCount(0)
      const links = navigation.getByRole('link')
      await expect(links).toHaveText([...labels])
      for (const link of await links.all()) await expect(link).toBeInViewport({ ratio: 0.99 })
      const boxes = await links.evaluateAll((nodes) =>
        nodes.map((node) => ({
          top: node.getBoundingClientRect().top,
          height: node.getBoundingClientRect().height,
        })),
      )
      expect(boxes[0]!.top).toBe(boxes[1]!.top)
      expect(boxes.every((box) => box.height >= 44)).toBe(true)
      await links.nth(1).click()
      await expect(navigation.getByRole('link', { name: labels[1], exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await page.goBack()
      await expect(navigation.getByRole('link', { name: labels[0], exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
    await page.screenshot({ path: testInfo.outputPath(`short-tabs-${width}.png`), fullPage: true })
  })
}

for (const width of [320, 360]) {
  test(`long and nested tab groups scroll locally and reveal the current tab at ${width}px`, async ({
    page,
    mockApi,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await mockApi.use('admin-active')
    for (const path of [
      'system/rspamd-web-interface',
      'system/customize/app-links',
      'system/rspamd-effective-map',
      'routing/tls-policy-maps',
      'routing/transports',
    ]) {
      await page.goto(path)
      const groups = page.locator('[data-section-navigation]')
      await expect(groups.first()).toBeVisible()
      for (const group of await groups.all()) {
        await expect(group.getByRole('button')).toHaveCount(0)
        const current = group.locator('[aria-current=page]')
        await expect(current).toBeInViewport({ ratio: 0.99 })
        const tops = await group
          .getByRole('link')
          .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().top))
        expect(new Set(tops).size).toBe(1)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
    await page.goto('system/customize/app-links')
    const nested = page.getByRole('navigation', { name: 'Customize', exact: true })
    const before = await page.evaluate(() => window.scrollY)
    await nested.locator('ul').evaluate((list) => {
      list.scrollLeft = 0
    })
    await expect(nested.getByRole('link').first()).toBeInViewport({ ratio: 0.99 })
    await nested.locator('ul').evaluate((list) => {
      list.scrollLeft = list.scrollWidth
    })
    await expect(nested.getByRole('link').last()).toBeInViewport({ ratio: 0.99 })
    expect(await page.evaluate(() => window.scrollY)).toBe(before)
    await nested.getByRole('link').first().focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/system\/customize\/logos$/)
    await expect(nested.getByRole('link').first()).toHaveAttribute('aria-current', 'page')
    await expect(nested.getByRole('link').first()).toBeInViewport({ ratio: 0.99 })
    await page.goBack()
    await expect(nested.getByRole('link').last()).toHaveAttribute('aria-current', 'page')
    await expect(nested.getByRole('link').last()).toBeInViewport({ ratio: 0.99 })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: testInfo.outputPath(`nested-tabs-${width}.png`), fullPage: true })
  })
}

test('account and quarantine navigation uses visible tabs and keeps the active tab visible after resize', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-admin')
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('passkeys')
  const account = page.locator('[data-section-nav]')
  await expect(account.locator('[aria-current=page]')).toHaveText('Passkeys')
  await page.setViewportSize({ width: 360, height: 900 })
  await expect(account.getByRole('button')).toHaveCount(0)
  await expect(account.locator('[aria-current=page]')).toBeInViewport({ ratio: 0.99 })
  await mockApi.use('quarantine-admin')
  await page.goto('quarantine/statistics')
  const quarantine = page.locator('[data-section-navigation]')
  await expect(quarantine.getByRole('button')).toHaveCount(0)
  await expect(quarantine.locator('[aria-current=page]')).toHaveText('Statistics')
  await expect(quarantine.locator('[aria-current=page]')).toBeInViewport({ ratio: 0.99 })
})
