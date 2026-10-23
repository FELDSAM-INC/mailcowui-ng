import { expect, test } from '../../fixtures/test'

for (const width of [360, 1366]) {
  test(`preserves yellow accents through save, reload, theme changes and clear at ${width}px`, async ({
    page,
    mockApi,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 })
    await mockApi.use('brand-colours-none')
    await page.goto('system/customize/colours')
    const section = page.locator('#section-brand-colours')
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#brand-colour-light').fill('#FEBC23')
    await page.locator('#brand-colour-dark').focus()
    await expect(page.locator('#brand-colour-light')).toHaveValue('#febc23')
    await expect(page.locator('#brand-colour-light')).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-adjust-colour]')).toHaveCount(0)
    for (const theme of ['light', 'dark']) {
      const preview = page.locator(`[data-brand-preview=${theme}]`)
      await expect(preview.locator('[data-preview-button]')).toHaveCSS(
        'background-color',
        'rgb(254, 188, 35)',
      )
      await expect(preview.locator('[data-preview-button]')).toHaveCSS('color', 'rgb(0, 0, 0)')
      await expect(preview).toContainText('12.4:1')
    }
    await expect(page.locator('[data-brand-preview=light] [data-preview-link]')).not.toHaveCSS(
      'color',
      'rgb(254, 188, 35)',
    )
    await expect(page.locator('[data-brand-preview=dark] [data-preview-link]')).toHaveCSS(
      'color',
      'rgb(254, 188, 35)',
    )
    await section.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(section.locator('form')).toHaveCount(0)
    const writes = (await mockApi.requests()).filter((r) => r.operationId === 'updateBrandColors')
    expect(writes.at(-1)?.body).toEqual({ light: '#febc23' })
    await page.reload()
    await expect(section).toContainText('#febc23')
    await section.getByRole('button', { name: /^Edit / }).click()
    const save = section.getByRole('button', { name: 'Save changes', exact: true })
    for (const dark of [false, true]) {
      await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
      await page.mouse.move(0, 0)
      await expect(save).toHaveCSS('background-color', 'rgb(254, 188, 35)')
      await expect(save).toHaveCSS('color', 'rgb(0, 0, 0)')
      await page.screenshot({
        path: testInfo.outputPath(`yellow-${dark ? 'dark' : 'light'}-${width}.png`),
        fullPage: true,
      })
    }
    await page.locator('#brand-colour-dark').fill('#1d4ed8')
    await save.click()
    await expect(section.locator('form')).toHaveCount(0)
    await expect
      .poll(() =>
        page.locator('html').evaluate((node) => node.style.getPropertyValue('--brand-dark')),
      )
      .toBe('#1d4ed8')
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#brand-colour-dark').fill('')
    await save.click()
    await expect(section.locator('form')).toHaveCount(0)
    await expect
      .poll(() =>
        page.locator('html').evaluate((node) => node.style.getPropertyValue('--brand-dark')),
      )
      .toBe('#febc23')
    await section.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#brand-colour-light').fill('')
    await save.click()
    await expect(section.locator('form')).toHaveCount(0)
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((node) =>
            ['light', 'dark'].flatMap((theme) =>
              ['', '-foreground', '-hover', '-text'].map((suffix) =>
                node.style.getPropertyValue(`--brand-${theme}${suffix}`),
              ),
            ),
          ),
      )
      .toEqual(Array(8).fill(''))
  })
}
