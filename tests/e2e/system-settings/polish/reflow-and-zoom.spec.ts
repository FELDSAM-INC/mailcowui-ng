import { expect, test } from '../../fixtures/test'
import { expectFocusVisible, expectReducedMotion, tabTo } from './helpers'

test('T169/T170 short screens retain Sieve confirmation controls and Escape returns focus', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockApi.use('global-sieve-default')
  await page.goto('system/global-sieve-filters')
  const pre = page.locator('[data-global-filter=prefilter]')
  await pre.getByRole('button', { name: 'Edit', exact: true }).click()
  await pre.locator('textarea').fill('# A short screen draft\nkeep;')
  const save = pre.getByRole('button', { name: 'Save changes', exact: true })
  for (const size of [
    { width: 320, height: 780 },
    { width: 320, height: 225 },
    { width: 780, height: 360 },
  ]) {
    await page.setViewportSize(size)
    // Resize may leave the already-focused button below the new viewport. Exercise actual
    // keyboard navigation at each size before checking focus obstruction.
    await page.keyboard.press('Shift+Tab')
    await tabTo(page, save)
    await expectFocusVisible(page)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expectNoHorizontalScroll(page, { widths: [size.width] })
    const bounds = (await dialog.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height)
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
    await tabTo(page, cancel)
    const action = (await cancel.boundingBox())!
    expect(action.y).toBeGreaterThanOrEqual(bounds.y)
    expect(action.y + action.height).toBeLessThanOrEqual(bounds.y + bounds.height)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(save).toBeFocused()
    await expectFocusVisible(page)
    await expectReducedMotion(page)
  }
  expect(await mockApi.countRequests('replaceGlobalSieveFilter')).toBe(0)
  await expect(pre.locator('textarea')).toHaveValue('# A short screen draft\nkeep;')
  await page.setViewportSize({ width: 360, height: 780 })
  await page.evaluate(() => scrollTo(0, 0))
  await expectAccessible()
})
