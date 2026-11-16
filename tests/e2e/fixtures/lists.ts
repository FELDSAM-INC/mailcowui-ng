import { expect, type Page } from '@playwright/test'

/** Filter fields live below the toolbar on desktop and in a dialog on mobile. */
export async function openListFilters(page: Page) {
  const panel = page.locator('[data-filter-panel]:visible')
  const toggle = page.locator('[data-filter-toggle]')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(panel).toBeVisible()
  return panel
}

export async function closeListFilters(page: Page) {
  const dialog = page.getByRole('dialog').filter({ has: page.locator('[data-filter-panel]') })
  const open = await dialog.evaluateAll((elements) => {
    const active = elements.find((el) => el.getAttribute('data-state') === 'open')
    if (!(active instanceof HTMLElement)) return false
    // A focused picker can consume Escape. Close the filter dialog itself, while avoiding
    // locator.press waiting on a dialog whose exit animation is already in progress.
    active.focus()
    return true
  })
  if (open) await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
}

/** Exercise the shared table header, or its Columns-menu equivalent on narrow screens. */
export async function sortList(page: Page, key: string, keyboard = false) {
  await closeListFilters(page)
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.locator('[data-list-columns]').click()
    const choice = page.locator(`[data-sort-choice="${key}"]`)
    if (keyboard) {
      await choice.focus()
      await choice.press('Enter')
    } else await choice.click()
  } else {
    const button = page.locator(`[data-sort="${key}"]`)
    await expect(button).toBeAttached()
    if (!(await button.isVisible())) {
      const column = await button.locator('xpath=ancestor::th').getAttribute('data-column')
      await page.locator('[data-list-columns]').click()
      await page.locator(`[data-column-option="${column}"]`).click()
      await page.keyboard.press('Escape')
    }
    if (keyboard) {
      await button.focus()
      await button.press('Enter')
    } else await button.click()
  }
  await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(0)
}

export async function expectListSort(page: Page, key: string, order: 'asc' | 'desc') {
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.locator('[data-list-columns]').click()
    await expect(page.locator(`[data-sort-choice="${key}"]`)).toContainText(
      order === 'asc' ? '▲' : '▼',
    )
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(0)
  } else {
    await expect(
      page.locator('th').filter({ has: page.locator(`[data-sort="${key}"]`) }),
    ).toHaveAttribute('aria-sort', order === 'asc' ? 'ascending' : 'descending')
  }
}
