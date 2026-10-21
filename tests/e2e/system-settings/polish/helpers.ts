import type { Locator, Page } from '@playwright/test'
import { expect } from '../../fixtures/test'

/** Reach the control by actual Tab navigation, without programmatically focusing it. */
export async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  for (let step = 0; step < 100; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

export async function customizeLink(page: Page, name: string) {
  const nav = page.getByRole('navigation', { name: 'Customize', exact: true })
  const toggle = nav.getByRole('button')
  if (await toggle.isVisible()) await toggle.click()
  await nav.getByRole('link', { name, exact: true }).click()
}

export async function expectFocusVisible(page: Page) {
  // The shared sticky-bar guard adjusts scroll on the next animation frame, particularly
  // in WebKit. Measure the resulting layout, not the intermediate native focus position.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const barSelector = '[data-sticky-save], [data-section-actions].sticky'
    const sticky = document.querySelector(barSelector)?.getBoundingClientRect()
    return {
      top: box.top,
      bottom: box.bottom,
      header: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
      bottomLimit:
        sticky && sticky.top > 0 && !element.closest(barSelector)
          ? Math.min(innerHeight, sticky.top)
          : innerHeight,
      outlined: parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none',
    }
  })
  expect(focus.top).toBeGreaterThanOrEqual(focus.header - 1)
  expect(focus.bottom).toBeLessThanOrEqual(focus.bottomLimit + 1)
  expect(focus.outlined).toBe(true)
}

export async function expectReducedMotion(page: Page) {
  expect(
    await page.locator('main').evaluate((main) =>
      [main, ...main.querySelectorAll('*')]
        .filter((element) => element.getBoundingClientRect().width > 0)
        .filter((element) => {
          const style = getComputedStyle(element)
          return [style.transitionDuration, style.animationDuration].some((value) =>
            value.split(',').some((duration) => parseFloat(duration) > 0.001),
          )
        })
        .map((element) => element.tagName),
    ),
  ).toEqual([])
}
